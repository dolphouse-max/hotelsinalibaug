const textEncoder = new TextEncoder();

const SESSION_COOKIE_NAME = "hia_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const DEFAULT_SUPER_ADMIN_EMAIL = "gjpatil@gmail.com";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeHotelId(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function encodeBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding === 0 ? normalized : normalized + "=".repeat(4 - padding);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signValue(value, secret) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

async function verifyValue(value, signature, secret) {
  const key = await importHmacKey(secret);

  return crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(signature),
    textEncoder.encode(value)
  );
}

function parseCookieHeader(cookieHeader) {
  const cookies = {};

  for (const part of String(cookieHeader || "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) {
      continue;
    }

    cookies[name] = rest.join("=");
  }

  return cookies;
}

function getSessionSecret(env) {
  return env.SESSION_SECRET || env.ENCRYPTION_KEY || env.GOOGLE_CLIENT_SECRET || "";
}

function getCookieAttributes(maxAgeSeconds) {
  return [
    `Path=/`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Max-Age=${maxAgeSeconds}`,
  ].join("; ");
}

function buildSessionCookieValue(session) {
  const payload = {
    ...session,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };

  return encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
}

export function getGoogleClientId(env) {
  return env.GOOGLE_WEB_CLIENT_ID || env.GOOGLE_CLIENT_ID || "";
}

export function getAllowedSuperAdminEmails(env) {
  const configured = String(
    env.SUPER_ADMIN_GOOGLE_EMAILS || env.SUPER_ADMIN_GOOGLE_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL
  );

  return configured
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

export async function verifyGoogleCredential(credential, env) {
  const clientId = getGoogleClientId(env);

  if (!clientId) {
    throw new Error("Google client ID is not configured.");
  }

  const response = await fetch(
    `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(String(credential || ""))}`
  );

  if (!response.ok) {
    throw new Error("Google login could not be verified.");
  }

  const payload = await response.json();
  const email = normalizeEmail(payload.email);
  const emailVerified = String(payload.email_verified || "").toLowerCase() === "true";
  const issuer = String(payload.iss || "");

  if (payload.aud !== clientId) {
    throw new Error("Google login audience mismatch.");
  }

  if (!email || !emailVerified) {
    throw new Error("Google account email is not verified.");
  }

  if (!["accounts.google.com", "https://accounts.google.com"].includes(issuer)) {
    throw new Error("Google login issuer is invalid.");
  }

  return {
    email,
    name: String(payload.name || payload.given_name || email),
    picture: String(payload.picture || ""),
    subject: String(payload.sub || ""),
  };
}

export async function createSessionCookie(session, env) {
  const secret = getSessionSecret(env);

  if (!secret) {
    throw new Error("SESSION_SECRET, ENCRYPTION_KEY, or GOOGLE_CLIENT_SECRET must be configured.");
  }

  const value = buildSessionCookieValue(session);
  const signature = await signValue(value, secret);
  return `${SESSION_COOKIE_NAME}=${value}.${signature}; ${getCookieAttributes(SESSION_MAX_AGE_SECONDS)}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; ${getCookieAttributes(0)}`;
}

export async function readSession(request, env) {
  const secret = getSessionSecret(env);

  if (!secret) {
    return null;
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const rawCookie = cookies[SESSION_COOKIE_NAME];

  if (!rawCookie) {
    return null;
  }

  const [payloadPart, signaturePart] = rawCookie.split(".");
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const valid = await verifyValue(payloadPart, signaturePart, secret);
  if (!valid) {
    return null;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadPart)));
    if (!payload?.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      role: payload.role,
      email: normalizeEmail(payload.email),
      name: typeof payload.name === "string" ? payload.name : "",
      picture: typeof payload.picture === "string" ? payload.picture : "",
      hotel_id: normalizeHotelId(payload.hotel_id),
      sub: typeof payload.sub === "string" ? payload.sub : "",
      iat: Number(payload.iat || 0),
      exp: Number(payload.exp || 0),
    };
  } catch {
    return null;
  }
}

export async function requireSuperAdminSession(request, env) {
  const session = await readSession(request, env);
  if (!session || session.role !== "super_admin") {
    return null;
  }

  return getAllowedSuperAdminEmails(env).includes(session.email) ? session : null;
}

export async function requireHotelAdminSession(request, env, expectedHotelId = "") {
  const session = await readSession(request, env);
  if (!session || session.role !== "hotel_admin" || !session.hotel_id) {
    return null;
  }

  if (expectedHotelId && session.hotel_id !== normalizeHotelId(expectedHotelId)) {
    return null;
  }

  return session;
}

export async function getHotelAdminRecord(env, hotelId) {
  const normalizedHotelId = normalizeHotelId(hotelId);

  if (!normalizedHotelId) {
    return null;
  }

  return env.DB.prepare(
    `SELECT
       h.id,
       h.name,
       h.contact,
       hs.email AS admin_email,
       hs.phone AS admin_phone
     FROM hotels h
     LEFT JOIN hotel_staff hs
       ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
     WHERE lower(h.id) = lower(?1)
     LIMIT 1`
  )
    .bind(normalizedHotelId)
    .first();
}
