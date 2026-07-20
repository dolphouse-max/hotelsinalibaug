const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const SESSION_COOKIE_NAME = "hia_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const DEFAULT_SUPERADMIN_EMAIL = "gjpatil@gmail.com";
const DEFAULT_FIREBASE_PROJECT_ID = "guest-checkin-542d6";
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let firebaseJwksCache = {
  expiresAt: 0,
  keysByKid: new Map(),
};

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

function decodeBase64UrlText(value) {
  return textDecoder.decode(decodeBase64Url(value));
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
  return crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), textEncoder.encode(value));
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
  const secret = env.SESSION_SECRET || env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing required session secret configuration.");
  }
  return secret;
}

function getCookieAttributes(maxAgeSeconds) {
  return [`Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=${maxAgeSeconds}`].join("; ");
}

function buildSessionCookieValue(session) {
  const payload = {
    ...session,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  return encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
}

function firebaseProjectId(env) {
  return env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
}

function currentUnixTime() {
  return Math.floor(Date.now() / 1000);
}

function parseCacheMaxAge(cacheControl) {
  const match = String(cacheControl || "").match(/max-age=(\d+)/i);
  return match ? Number(match[1]) : 3600;
}

async function getFirebaseJwkByKid(kid) {
  const now = Date.now();
  if (firebaseJwksCache.expiresAt > now && firebaseJwksCache.keysByKid.has(kid)) {
    return firebaseJwksCache.keysByKid.get(kid) || null;
  }

  const response = await fetch(FIREBASE_JWKS_URL);
  if (!response.ok) {
    throw new Error("Unable to load Firebase signing keys.");
  }

  const body = await response.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  const keysByKid = new Map();
  for (const key of keys) {
    if (key?.kid) {
      keysByKid.set(key.kid, key);
    }
  }

  firebaseJwksCache = {
    expiresAt: now + parseCacheMaxAge(response.headers.get("cache-control")) * 1000,
    keysByKid,
  };

  return firebaseJwksCache.keysByKid.get(kid) || null;
}

async function importFirebasePublicKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"]
  );
}

async function ensureAuthTables(db) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS auth_users (
         id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
         firebase_uid TEXT UNIQUE,
         email TEXT NOT NULL UNIQUE,
         role TEXT NOT NULL CHECK (role IN ('super_admin', 'hotel_admin', 'police')),
         hotel_id TEXT,
         display_name TEXT NOT NULL,
         is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
         created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`
    ),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_users(role)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_users_hotel_id ON auth_users(hotel_id)`),
  ]);
}

async function findAuthUserByFirebaseIdentity(db, firebaseUid, email) {
  return db.prepare(
    `SELECT
       id,
       firebase_uid,
       email,
       role,
       hotel_id,
       display_name,
       is_active
     FROM auth_users
     WHERE (firebase_uid IS NOT NULL AND firebase_uid = ?1)
        OR lower(email) = lower(?2)
     LIMIT 1`
  )
    .bind(firebaseUid || null, email)
    .first();
}

export async function listAuthUsers(env) {
  await ensureAuthTables(env.DB);
  const result = await env.DB.prepare(
    `SELECT
       au.id,
       au.firebase_uid,
       au.email,
       au.role,
       au.hotel_id,
       au.display_name,
       au.is_active,
       au.created_at,
       au.updated_at,
       h.name AS hotel_name
     FROM auth_users au
     LEFT JOIN hotels h
       ON lower(h.id) = lower(au.hotel_id)
     ORDER BY
       CASE au.role
         WHEN 'super_admin' THEN 0
         WHEN 'police' THEN 1
         ELSE 2
       END,
       au.created_at DESC`
  ).all();

  return result.results || [];
}

async function upsertAuthUser(env, user) {
  await ensureAuthTables(env.DB);

  const email = normalizeEmail(user.email);
  const role = typeof user.role === "string" ? user.role.trim() : "";
  const hotelId = normalizeHotelId(user.hotel_id);
  const displayName = typeof user.display_name === "string" ? user.display_name.trim() : email;
  const firebaseUid = typeof user.firebase_uid === "string" ? user.firebase_uid.trim() : "";
  const isActive = user.is_active === false || user.is_active === 0 ? 0 : 1;

  if (!["super_admin", "hotel_admin", "police"].includes(role)) {
    throw new Error("role must be super_admin, hotel_admin, or police.");
  }

  if (!email) {
    throw new Error("email is required.");
  }

  if (role === "hotel_admin" && !hotelId) {
    throw new Error("hotel_id is required for hotel_admin users.");
  }

  if (hotelId) {
    const hotel = await env.DB.prepare(
      `SELECT id FROM hotels WHERE lower(id) = lower(?1) LIMIT 1`
    )
      .bind(hotelId)
      .first();

    if (!hotel) {
      throw new Error("Selected hotel was not found.");
    }
  }

  await env.DB.prepare(
    `INSERT INTO auth_users (
       firebase_uid,
       email,
       role,
       hotel_id,
       display_name,
       is_active
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(email) DO UPDATE SET
       firebase_uid = COALESCE(excluded.firebase_uid, auth_users.firebase_uid),
       role = excluded.role,
       hotel_id = excluded.hotel_id,
       display_name = excluded.display_name,
       is_active = excluded.is_active,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(firebaseUid || null, email, role, hotelId || null, displayName, isActive)
    .run();

  return findAuthUserByFirebaseIdentity(env.DB, firebaseUid, email);
}

export async function saveAuthUser(env, user) {
  return upsertAuthUser(env, user);
}

async function verifyFirebaseIdToken(idToken, env) {
  const projectId = firebaseProjectId(env);
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Firebase ID token is malformed.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header;
  let payload;

  try {
    header = JSON.parse(decodeBase64UrlText(encodedHeader));
    payload = JSON.parse(decodeBase64UrlText(encodedPayload));
  } catch {
    throw new Error("Firebase ID token could not be decoded.");
  }

  if (header?.alg !== "RS256" || !header?.kid) {
    throw new Error("Firebase token header is invalid.");
  }

  const jwk = await getFirebaseJwkByKid(header.kid);
  if (!jwk) {
    throw new Error("Firebase signing key was not found.");
  }

  const publicKey = await importFirebasePublicKey(jwk);
  const signedData = textEncoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = decodeBase64Url(encodedSignature);
  const isValid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signedData);
  if (!isValid) {
    throw new Error("Firebase token signature is invalid.");
  }

  const now = currentUnixTime();
  const issuer = `https://securetoken.google.com/${projectId}`;
  if (payload?.iss !== issuer) {
    throw new Error("Firebase token issuer is invalid.");
  }
  if (payload?.aud !== projectId) {
    throw new Error("Firebase token audience is invalid.");
  }
  if (!payload?.sub) {
    throw new Error("Firebase token is missing a user ID.");
  }
  if (!payload?.iat || Number(payload.iat) > now) {
    throw new Error("Firebase token issue time is invalid.");
  }
  if (!payload?.auth_time || Number(payload.auth_time) > now) {
    throw new Error("Firebase token auth_time is invalid.");
  }
  if (!payload?.exp || Number(payload.exp) <= now) {
    throw new Error("Firebase token has expired.");
  }

  return payload;
}

export async function resolveFirebaseSession(env, idToken) {
  if (!idToken) {
    throw new Error("Firebase ID token is required.");
  }

  const claims = await verifyFirebaseIdToken(idToken, env);
  const firebaseUid = String(claims.sub || "").trim();
  const email = normalizeEmail(claims.email);

  if (!email) {
    throw new Error("This Firebase account does not have an email address.");
  }

  if (claims.email_verified !== true) {
    throw new Error("Please verify your email address before using this app.");
  }

  await ensureAuthTables(env.DB);

  const user = await findAuthUserByFirebaseIdentity(env.DB, firebaseUid, email);
  if (!user || Number(user.is_active) !== 1) {
    throw new Error("This Firebase account is not authorized for this app.");
  }

  if (user.role === "hotel_admin" && !normalizeHotelId(user.hotel_id)) {
    throw new Error("This hotel admin account is missing a hotel assignment.");
  }

  await env.DB.prepare(
    `UPDATE auth_users
     SET firebase_uid = ?1,
         display_name = ?2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?3`
  )
    .bind(firebaseUid, String(claims.name || user.display_name || email).trim() || email, user.id)
    .run();

  return {
    login_id: email,
    role: user.role,
    hotel_id: normalizeHotelId(user.hotel_id),
    email,
    display_name: String(claims.name || user.display_name || email).trim() || email,
    firebase_uid: firebaseUid,
  };
}

export function defaultSuperAdminLogin() {
  return DEFAULT_SUPERADMIN_EMAIL;
}

export async function createSessionCookie(session, env) {
  const secret = getSessionSecret(env);
  const value = buildSessionCookieValue(session);
  const signature = await signValue(value, secret);
  return `${SESSION_COOKIE_NAME}=${value}.${signature}; ${getCookieAttributes(SESSION_MAX_AGE_SECONDS)}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; ${getCookieAttributes(0)}`;
}

export async function readSession(request, env) {
  const secret = getSessionSecret(env);
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
    const payload = JSON.parse(textDecoder.decode(decodeBase64Url(payloadPart)));
    if (!payload?.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      login_id: normalizeEmail(payload.login_id),
      role: payload.role,
      hotel_id: normalizeHotelId(payload.hotel_id),
      email: normalizeEmail(payload.email),
      display_name: typeof payload.display_name === "string" ? payload.display_name : "",
      firebase_uid: typeof payload.firebase_uid === "string" ? payload.firebase_uid : "",
      iat: Number(payload.iat || 0),
      exp: Number(payload.exp || 0),
    };
  } catch {
    return null;
  }
}

export async function requireSuperAdminSession(request, env) {
  const session = await readSession(request, env);
  return session?.role === "super_admin" ? session : null;
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

export async function requirePoliceSession(request, env) {
  const session = await readSession(request, env);
  return session?.role === "police" ? session : null;
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
