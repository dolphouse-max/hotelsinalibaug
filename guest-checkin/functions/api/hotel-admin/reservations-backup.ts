import { badRequest, isSafeId, json, unauthorized } from "../../_lib/api";
import {
  downloadHotelDriveFile,
  getHotelDriveAccessToken,
  listHotelDriveFiles,
  uploadFileToHotelDrive,
} from "../../_lib/google-drive";

interface Env {
  DB: D1Database;
  HOTEL_ADMIN_TOKEN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
}

function requireHotelAdmin(request: Request, env: Env): boolean {
  const authHeader = request.headers.get("authorization");

  if (!env.HOTEL_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.HOTEL_ADMIN_TOKEN;
}

function isSafeGoogleDriveFileId(value: string | null): value is string {
  return Boolean(value) && /^[a-zA-Z0-9_-]{10,200}$/.test(value);
}

const BACKUP_PREFIX = "reservations_backup_";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  const url = new URL(context.request.url);
  const hotelId = url.searchParams.get("hotel_id");
  const fileId = url.searchParams.get("file_id");

  if (!isSafeId(hotelId)) {
    return badRequest("Invalid hotel_id");
  }

  try {
    const { accessToken, folderId } = await getHotelDriveAccessToken(hotelId, context.env);

    if (fileId) {
      if (!isSafeGoogleDriveFileId(fileId)) {
        return badRequest("Invalid file_id");
      }

      const raw = await downloadHotelDriveFile(accessToken, fileId);
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return badRequest("Backup file is not a valid reservation list");
      }

      return json({
        ok: true,
        hotelId,
        records: parsed,
      });
    }

    const files = await listHotelDriveFiles(accessToken, folderId, BACKUP_PREFIX);
    return json({
      ok: true,
      hotelId,
      backups: files,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to load reservation backups" },
      { status: 500 }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";
    const records = Array.isArray(payload.records) ? payload.records : null;

    if (!isSafeId(hotelId)) {
      return badRequest("Invalid hotel_id");
    }

    if (!records) {
      return badRequest("records array is required");
    }

    const backupJson = JSON.stringify(records, null, 2);
    const backupDate = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${BACKUP_PREFIX}${hotelId}_${backupDate}.json`;
    const { accessToken, folderId } = await getHotelDriveAccessToken(hotelId, context.env);

    const upload = await uploadFileToHotelDrive(
      accessToken,
      folderId,
      fileName,
      "application/json",
      new TextEncoder().encode(backupJson).buffer
    );

    return json({
      ok: true,
      hotelId,
      backup: upload,
    }, { status: 201 });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to upload reservation backup" },
      { status: 500 }
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, OPTIONS",
    },
  });
