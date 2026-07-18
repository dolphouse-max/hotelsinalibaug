import {
  decodeBase64Url,
  decryptString,
  encryptString,
  encodeBase64Url,
  signValue,
  verifySignedValue,
} from "./crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const HOTEL_FOLDER_NAME = "Alibaug_Guest_Register";

interface MinimalEnv {
  DB: D1Database;
}

interface Env extends MinimalEnv {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
}

interface HotelRecord {
  id: string;
  name: string;
  google_drive_folder_id: string | null;
  encrypted_refresh_token: string | null;
  admin_email: string | null;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
}

interface OAuthState {
  exp: number;
  hotelId: string;
}

function ensureGoogleConfig(env: Env): void {
  const required = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "ENCRYPTION_KEY",
  ] as const;

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

export async function getHotelById(env: MinimalEnv, hotelId: string): Promise<HotelRecord | null> {
  return env.DB.prepare(
    `SELECT
       h.id,
       h.name,
       h.google_drive_folder_id,
       h.encrypted_refresh_token,
       hs.email AS admin_email
     FROM hotels h
     LEFT JOIN hotel_staff hs
       ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
     WHERE h.id = ?1
     LIMIT 1`
  )
    .bind(hotelId)
    .first<HotelRecord>();
}

export async function createOAuthState(hotelId: string, env: Env): Promise<string> {
  ensureGoogleConfig(env);

  const payload: OAuthState = {
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
    hotelId,
  };

  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signValue(encodedPayload, env.GOOGLE_CLIENT_SECRET);
  return `${encodedPayload}.${signature}`;
}

export async function verifyOAuthState(state: string, env: Env): Promise<OAuthState> {
  ensureGoogleConfig(env);

  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid OAuth state.");
  }

  const isValid = await verifySignedValue(
    encodedPayload,
    signature,
    env.GOOGLE_CLIENT_SECRET
  );

  if (!isValid) {
    throw new Error("OAuth state verification failed.");
  }

  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as OAuthState;

  if (!payload.hotelId || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("OAuth state expired or malformed.");
  }

  return payload;
}

export function buildGoogleConsentUrl(hotelId: string, env: Env, originHint?: string): Promise<string> {
  return createOAuthState(hotelId, env).then((state) => {
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", DRIVE_FILE_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);

    if (originHint) {
      url.searchParams.set("login_hint", originHint);
    }

    return url.toString();
  });
}

async function exchangeAuthCodeForTokens(code: string, env: Env): Promise<GoogleTokenResponse> {
  ensureGoogleConfig(env);

  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange auth code: ${errorText}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(
  encryptedRefreshToken: string,
  env: Env
): Promise<GoogleTokenResponse> {
  ensureGoogleConfig(env);

  const refreshToken = await decryptString(encryptedRefreshToken, env.ENCRYPTION_KEY);

  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh access token: ${errorText}`);
  }

  return (await response.json()) as GoogleTokenResponse;
}

async function createHotelDriveFolder(
  accessToken: string
): Promise<{ id: string; webViewLink?: string }> {
  const response = await fetch(`${GOOGLE_DRIVE_FILES_URL}?fields=id,webViewLink`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: HOTEL_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Google Drive folder: ${errorText}`);
  }

  return (await response.json()) as { id: string; webViewLink?: string };
}

export async function connectHotelGoogleDrive(
  hotelId: string,
  code: string,
  env: Env
): Promise<{ folderId: string }> {
  const hotel = await getHotelById(env, hotelId);
  if (!hotel) {
    throw new Error("Hotel not found.");
  }

  const tokenResponse = await exchangeAuthCodeForTokens(code, env);
  const refreshToken = tokenResponse.refresh_token;

  if (!refreshToken) {
    throw new Error("Google did not return a refresh token. Retry consent with prompt=consent.");
  }

  const encryptedRefreshToken = await encryptString(refreshToken, env.ENCRYPTION_KEY);
  const folderId =
    hotel.google_drive_folder_id ||
    (await createHotelDriveFolder(tokenResponse.access_token)).id;

  await env.DB.prepare(
    `UPDATE hotels
     SET encrypted_refresh_token = ?1,
         google_drive_folder_id = ?2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?3`
  )
    .bind(encryptedRefreshToken, folderId, hotelId)
    .run();

  return { folderId };
}

export async function revokeHotelGoogleDrive(hotelId: string, env: Env): Promise<void> {
  const hotel = await getHotelById(env, hotelId);
  if (!hotel?.encrypted_refresh_token) {
    return;
  }

  const refreshToken = await decryptString(hotel.encrypted_refresh_token, env.ENCRYPTION_KEY);
  const response = await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token: refreshToken }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to revoke Google token: ${errorText}`);
  }

  await env.DB.prepare(
    `UPDATE hotels
     SET encrypted_refresh_token = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?1`
  )
    .bind(hotelId)
    .run();
}

export interface GoogleDriveUploadResult {
  id: string;
  name: string;
  mimeType: string;
}

export async function getHotelDriveAccessToken(hotelId: string, env: Env): Promise<{
  accessToken: string;
  folderId: string;
  hotel: HotelRecord;
}> {
  const hotel = await getHotelById(env, hotelId);

  if (!hotel) {
    throw new Error("Hotel not found.");
  }

  if (!hotel.encrypted_refresh_token || !hotel.google_drive_folder_id) {
    throw new Error("Google Drive is not connected for this hotel.");
  }

  const tokenResponse = await refreshGoogleAccessToken(hotel.encrypted_refresh_token, env);

  return {
    accessToken: tokenResponse.access_token,
    folderId: hotel.google_drive_folder_id,
    hotel,
  };
}

export async function uploadFileToHotelDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  contentType: string,
  fileBytes: ArrayBuffer
): Promise<GoogleDriveUploadResult> {
  const boundary = `cf-boundary-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const prefix =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;

  const body = new Blob([prefix, fileBytes, suffix]);

  const response = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload file to Google Drive: ${errorText}`);
  }

  return (await response.json()) as GoogleDriveUploadResult;
}

export async function listHotelDriveFiles(
  accessToken: string,
  folderId: string,
  fileNamePrefix = ""
): Promise<Array<{ id: string; name: string; createdTime: string; modifiedTime: string }>> {
  const url = new URL(GOOGLE_DRIVE_FILES_URL);
  const clauses = [`'${folderId}' in parents`, "trashed = false"];

  if (fileNamePrefix) {
    clauses.push(`name contains '${fileNamePrefix.replace(/'/g, "\\'")}'`);
  }

  url.searchParams.set("q", clauses.join(" and "));
  url.searchParams.set("fields", "files(id,name,createdTime,modifiedTime)");
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set("pageSize", "20");

  const response = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list Google Drive files: ${errorText}`);
  }

  const payload = (await response.json()) as {
    files?: Array<{ id: string; name: string; createdTime: string; modifiedTime: string }>;
  };

  return payload.files || [];
}

export async function downloadHotelDriveFile(
  accessToken: string,
  fileId: string
): Promise<string> {
  const url = new URL(`${GOOGLE_DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");

  const response = await fetch(url.toString(), {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download Google Drive file: ${errorText}`);
  }

  return response.text();
}
