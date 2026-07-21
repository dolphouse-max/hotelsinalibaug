import { decodeBase64Url, encodeBase64Url, signValue, verifySignedValue } from "./crypto";

interface Env {
  DB: D1Database;
  CHECKIN_LINK_SECRET: string;
  SESSION_SECRET?: string;
  ENCRYPTION_KEY?: string;
}

interface CheckinLinkPayload {
  exp: number;
  hotelId: string;
  tokenId: string;
}

const CHECKIN_LINK_LIFETIME_SECONDS = 60 * 60 * 4;

async function ensureCheckinSessionTable(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS hotel_checkin_sessions (
      hotel_id TEXT PRIMARY KEY,
      token_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

async function ensureCheckinSessionTableSafe(env: Env): Promise<boolean> {
  try {
    await ensureCheckinSessionTable(env);
    return true;
  } catch (error) {
    console.error("Unable to ensure hotel_checkin_sessions table", error);
    return false;
  }
}

function getLinkSecret(env: Env): string {
  const secret = env.CHECKIN_LINK_SECRET || env.SESSION_SECRET || env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("Missing required check-in link signing secret.");
  }
  return secret;
}

export async function createCheckinAccessToken(hotelId: string, env: Env): Promise<string> {
  const secret = getLinkSecret(env);
  const tokenId = crypto.randomUUID().replace(/-/g, "");
  const expiresAtIso = new Date(Date.now() + CHECKIN_LINK_LIFETIME_SECONDS * 1000).toISOString();

  const payload: CheckinLinkPayload = {
    exp: Math.floor(Date.now() / 1000) + CHECKIN_LINK_LIFETIME_SECONDS,
    hotelId,
    tokenId,
  };

  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signValue(encodedPayload, secret);

  const tableReady = await ensureCheckinSessionTableSafe(env);
  if (tableReady) {
    try {
      await env.DB.prepare(
        `INSERT INTO hotel_checkin_sessions (
           hotel_id,
           token_id,
           expires_at,
           updated_at
         ) VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
         ON CONFLICT(hotel_id) DO UPDATE SET
           token_id = excluded.token_id,
           expires_at = excluded.expires_at,
           updated_at = CURRENT_TIMESTAMP`
      )
        .bind(hotelId, tokenId, expiresAtIso)
        .run();
    } catch (error) {
      console.error("Unable to persist hotel check-in session", error);
    }
  }

  return `${encodedPayload}.${signature}`;
}

export async function verifyCheckinAccessToken(
  accessToken: string,
  hotelId: string,
  env: Env
): Promise<void> {
  const secret = getLinkSecret(env);

  const [encodedPayload, signature] = accessToken.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid access token");
  }

  const isValid = await verifySignedValue(encodedPayload, signature, secret);
  if (!isValid) {
    throw new Error("Invalid access token");
  }

  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as CheckinLinkPayload;

  if (payload.hotelId !== hotelId) {
    throw new Error("Access token does not match hotel");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Access token expired");
  }

  const tableReady = await ensureCheckinSessionTableSafe(env);
  if (!tableReady) {
    return;
  }

  try {
    const activeSession = await env.DB.prepare(
      `SELECT token_id, expires_at
       FROM hotel_checkin_sessions
       WHERE hotel_id = ?1
       LIMIT 1`
    )
      .bind(hotelId)
      .first<{ token_id: string; expires_at: string }>();

    if (!activeSession) {
      return;
    }

    if (activeSession.token_id !== payload.tokenId) {
      throw new Error("Access token is no longer active");
    }

    if (new Date(activeSession.expires_at).getTime() <= Date.now()) {
      throw new Error("Access token expired");
    }
  } catch (error) {
    if (error instanceof Error && (error.message === "Access token is no longer active" || error.message === "Access token expired")) {
      throw error;
    }
    console.error("Unable to verify hotel check-in session row; using signed-token fallback", error);
  }
}

export function getCheckinLinkLifetimeSeconds(): number {
  return CHECKIN_LINK_LIFETIME_SECONDS;
}
