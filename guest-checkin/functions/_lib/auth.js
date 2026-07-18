const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const SESSION_COOKIE_NAME = "hia_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const PBKDF2_ITERATIONS = 100000;
const DEFAULT_SUPERADMIN_LOGIN = "gjpatil@gmail.com";
const DEFAULT_POLICE_LOGIN = "alibaug-police";
const DEFAULT_POLICE_PASSWORD = "AlibaugPolice@2026!Secure";

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeHotelId(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeLoginId(value) {
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
  return crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), textEncoder.encode(value));
}

async function derivePasswordHash(password, salt) {
  const importedKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: decodeBase64Url(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    importedKey,
    256
  );
  return encodeBase64Url(new Uint8Array(bits));
}

function randomSalt() {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)));
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
  return env.SESSION_SECRET || env.ENCRYPTION_KEY || env.GOOGLE_CLIENT_SECRET || "hia_default_session_secret";
}

function getCookieAttributes(maxAgeSeconds) {
  return [`Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Max-Age=${maxAgeSeconds}`].join("; ");
}

async function ensureAuthTables(db) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS auth_accounts (
         login_id TEXT PRIMARY KEY,
         role TEXT NOT NULL CHECK (role IN ('super_admin', 'hotel_admin', 'police')),
         hotel_id TEXT,
         email TEXT,
         display_name TEXT NOT NULL,
         password_salt TEXT NOT NULL,
         password_hash TEXT NOT NULL,
         must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
         created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
         password_changed_at TEXT
       )`
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS auth_reset_requests (
         id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
         role TEXT NOT NULL CHECK (role IN ('super_admin', 'hotel_admin', 'police')),
         login_id TEXT NOT NULL,
         contact_value TEXT,
         status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
         note TEXT,
         created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
         resolved_at TEXT
       )`
    ),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_accounts_role ON auth_accounts(role)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_accounts_hotel_id ON auth_accounts(hotel_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_reset_requests_status ON auth_reset_requests(status)`),
  ]);
}

async function findAuthAccount(db, loginId) {
  return db.prepare(
    `SELECT
       login_id,
       role,
       hotel_id,
       email,
       display_name,
       password_salt,
       password_hash,
       must_change_password
     FROM auth_accounts
     WHERE lower(login_id) = lower(?1)
     LIMIT 1`
  )
    .bind(loginId)
    .first();
}

async function insertAuthAccountIfMissing(db, account) {
  const salt = randomSalt();
  const passwordHash = await derivePasswordHash(account.password, salt);

  await db.prepare(
    `INSERT OR IGNORE INTO auth_accounts (
       login_id,
       role,
       hotel_id,
       email,
       display_name,
       password_salt,
       password_hash,
       must_change_password
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  )
    .bind(
      account.login_id,
      account.role,
      account.hotel_id || null,
      account.email || null,
      account.display_name,
      salt,
      passwordHash,
      account.must_change_password ? 1 : 0
    )
    .run();
}

async function updatePasswordForLogin(db, loginId, password, mustChangePassword = false) {
  const salt = randomSalt();
  const passwordHash = await derivePasswordHash(password, salt);
  await db.prepare(
    `UPDATE auth_accounts
     SET password_salt = ?1,
         password_hash = ?2,
         must_change_password = ?3,
         updated_at = CURRENT_TIMESTAMP,
         password_changed_at = CURRENT_TIMESTAMP
     WHERE lower(login_id) = lower(?4)`
  )
    .bind(salt, passwordHash, mustChangePassword ? 1 : 0, loginId)
    .run();
}

async function recordResetRequest(db, role, loginId, contactValue, status, note) {
  await db.prepare(
    `INSERT INTO auth_reset_requests (
       role,
       login_id,
       contact_value,
       status,
       note,
       resolved_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, CASE WHEN ?4 = 'resolved' THEN CURRENT_TIMESTAMP ELSE NULL END)`
  )
    .bind(role, loginId, contactValue || null, status, note || null)
    .run();
}

function buildSessionCookieValue(session) {
  const payload = {
    ...session,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  return encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
}

function policeInitialPassword(env) {
  return env.POLICE_INITIAL_PASSWORD || DEFAULT_POLICE_PASSWORD;
}

export function defaultSuperAdminLogin() {
  return DEFAULT_SUPERADMIN_LOGIN;
}

export function defaultPoliceLogin() {
  return DEFAULT_POLICE_LOGIN;
}

export function defaultPolicePassword(env) {
  return policeInitialPassword(env);
}

async function ensureSuperAdminAccount(env) {
  await ensureAuthTables(env.DB);
  await insertAuthAccountIfMissing(env.DB, {
    login_id: DEFAULT_SUPERADMIN_LOGIN,
    role: "super_admin",
    display_name: "Superadmin",
    email: DEFAULT_SUPERADMIN_LOGIN,
    password: DEFAULT_SUPERADMIN_LOGIN,
    must_change_password: true,
  });
}

async function ensurePoliceAccount(env) {
  await ensureAuthTables(env.DB);
  await insertAuthAccountIfMissing(env.DB, {
    login_id: DEFAULT_POLICE_LOGIN,
    role: "police",
    display_name: "Alibaug Police",
    email: null,
    password: policeInitialPassword(env),
    must_change_password: true,
  });
}

export async function ensureHotelAdminAccount(env, hotelId) {
  await ensureAuthTables(env.DB);
  const normalizedHotelId = normalizeHotelId(hotelId);
  if (!normalizedHotelId) {
    return null;
  }

  const hotel = await env.DB.prepare(
    `SELECT
       h.id,
       h.name,
       hs.email AS admin_email
     FROM hotels h
     LEFT JOIN hotel_staff hs
       ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
     WHERE lower(h.id) = lower(?1)
     LIMIT 1`
  )
    .bind(normalizedHotelId)
    .first();

  if (!hotel) {
    return null;
  }

  await insertAuthAccountIfMissing(env.DB, {
    login_id: normalizeHotelId(hotel.id),
    role: "hotel_admin",
    hotel_id: normalizeHotelId(hotel.id),
    display_name: `${hotel.name} Admin`,
    email: normalizeEmail(hotel.admin_email),
    password: normalizeHotelId(hotel.id),
    must_change_password: true,
  });

  return hotel;
}

export async function ensureDefaultAccountForRole(env, role, loginId = "") {
  if (role === "super_admin") {
    await ensureSuperAdminAccount(env);
    return findAuthAccount(env.DB, DEFAULT_SUPERADMIN_LOGIN);
  }

  if (role === "police") {
    await ensurePoliceAccount(env);
    return findAuthAccount(env.DB, DEFAULT_POLICE_LOGIN);
  }

  if (role === "hotel_admin") {
    await ensureHotelAdminAccount(env, loginId);
    return findAuthAccount(env.DB, normalizeHotelId(loginId));
  }

  return null;
}

export async function verifyPasswordForRole(env, role, loginId, password) {
  await ensureDefaultAccountForRole(env, role, loginId);
  const normalizedLoginId =
    role === "hotel_admin" ? normalizeHotelId(loginId) : normalizeLoginId(loginId);
  const account = await findAuthAccount(env.DB, normalizedLoginId);

  if (!account || account.role !== role) {
    return null;
  }

  const expectedHash = await derivePasswordHash(password, account.password_salt);
  if (expectedHash !== account.password_hash) {
    return null;
  }

  return {
    login_id: normalizeLoginId(account.login_id),
    role: account.role,
    hotel_id: normalizeHotelId(account.hotel_id),
    email: normalizeEmail(account.email),
    display_name: account.display_name,
    must_change_password: Number(account.must_change_password) === 1,
  };
}

export async function changePasswordForSession(env, session, currentPassword, newPassword) {
  const account = await findAuthAccount(env.DB, session.login_id);
  if (!account) {
    throw new Error("Account not found.");
  }

  const currentHash = await derivePasswordHash(currentPassword, account.password_salt);
  if (currentHash !== account.password_hash) {
    throw new Error("Current password is incorrect.");
  }

  await updatePasswordForLogin(env.DB, account.login_id, newPassword, false);
}

export async function resetPasswordFromForgot(env, role, loginId, contactValue) {
  await ensureAuthTables(env.DB);
  const normalizedLoginId = role === "hotel_admin" ? normalizeHotelId(loginId) : normalizeLoginId(loginId);
  const normalizedContact = normalizeLoginId(contactValue);

  if (role === "super_admin") {
    await ensureSuperAdminAccount(env);
    if (normalizedLoginId !== DEFAULT_SUPERADMIN_LOGIN || normalizedContact !== DEFAULT_SUPERADMIN_LOGIN) {
      throw new Error("Superadmin recovery details do not match.");
    }

    await updatePasswordForLogin(env.DB, DEFAULT_SUPERADMIN_LOGIN, DEFAULT_SUPERADMIN_LOGIN, true);
    await recordResetRequest(env.DB, role, normalizedLoginId, normalizedContact, "resolved", "Reset to default superadmin login ID.");
    return {
      message: "Superadmin password reset to the login ID. Please log in and change it immediately.",
    };
  }

  if (role === "hotel_admin") {
    const hotel = await ensureHotelAdminAccount(env, normalizedLoginId);
    if (!hotel) {
      throw new Error("Hotel account not found.");
    }

    const adminEmail = normalizeEmail(hotel.admin_email);
    if (!adminEmail || normalizedContact !== adminEmail) {
      throw new Error("Registered hotel admin Gmail does not match.");
    }

    await updatePasswordForLogin(env.DB, normalizedLoginId, normalizedLoginId, true);
    await recordResetRequest(env.DB, role, normalizedLoginId, normalizedContact, "resolved", "Reset to default hotel login ID.");
    return {
      message: "Hotel password reset to the Hotel ID. Please log in and change it immediately.",
    };
  }

  if (role === "police") {
    await recordResetRequest(env.DB, role, normalizedLoginId, normalizedContact, "pending", "Police password reset requested.");
    throw new Error("Police password resets must be done by superadmin.");
  }

  throw new Error("Unsupported role.");
}

export async function resetPasswordAsSuperAdmin(env, role, loginId) {
  await ensureAuthTables(env.DB);

  if (role === "police") {
    await ensurePoliceAccount(env);
    await updatePasswordForLogin(env.DB, DEFAULT_POLICE_LOGIN, policeInitialPassword(env), true);
    await recordResetRequest(env.DB, role, DEFAULT_POLICE_LOGIN, null, "resolved", "Superadmin reset police password to initial value.");
    return {
      message: "Police password reset to the initial police password.",
    };
  }

  if (role === "hotel_admin") {
    const hotel = await ensureHotelAdminAccount(env, loginId);
    if (!hotel) {
      throw new Error("Hotel account not found.");
    }

    await updatePasswordForLogin(env.DB, normalizeHotelId(loginId), normalizeHotelId(loginId), true);
    await recordResetRequest(env.DB, role, normalizeHotelId(loginId), null, "resolved", "Superadmin reset hotel password to hotel ID.");
    return {
      message: "Hotel password reset to the Hotel ID.",
    };
  }

  throw new Error("Only hotel and police passwords can be reset here.");
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
      login_id: normalizeLoginId(payload.login_id),
      role: payload.role,
      hotel_id: normalizeHotelId(payload.hotel_id),
      email: normalizeEmail(payload.email),
      display_name: typeof payload.display_name === "string" ? payload.display_name : "",
      must_change_password: Boolean(payload.must_change_password),
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
