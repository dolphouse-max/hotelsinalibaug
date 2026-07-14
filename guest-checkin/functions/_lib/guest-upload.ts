import { isSafeId } from "./api";
import { getHotelDriveAccessToken, uploadFileToHotelDrive } from "./google-drive";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
}

function requireText(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${key}`);
  }

  return value.trim();
}

function sanitizeFileName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 120) || "guest-id";
}

function createGuestId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function processGuestUpload(formData: FormData, env: Env): Promise<{
  guestId: string;
  hotelId: string;
  googleDriveFileId: string;
}> {
  const hotelId = requireText(formData, "hotel_id");
  const guestName = requireText(formData, "name");
  const phone = requireText(formData, "phone");
  const idType = requireText(formData, "id_type");
  const idNumber = requireText(formData, "id_number");
  const file = formData.get("file");

  if (!isSafeId(hotelId)) {
    throw new Error("Invalid hotel_id");
  }

  if (!(file instanceof File)) {
    throw new Error("Missing uploaded file");
  }

  if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File is missing or exceeds 10 MB");
  }

  const normalizedContentType = file.type || "application/octet-stream";
  if (!ALLOWED_CONTENT_TYPES.has(normalizedContentType)) {
    throw new Error("Unsupported file type");
  }

  const { accessToken, folderId, hotel } = await getHotelDriveAccessToken(hotelId, env);
  const extension =
    normalizedContentType === "application/pdf" ? "pdf" : normalizedContentType.split("/")[1];
  const driveFileName = sanitizeFileName(
    `${guestName}-${idType}-${Date.now()}.${extension || "bin"}`
  );
  const uploadedFile = await uploadFileToHotelDrive(
    accessToken,
    folderId,
    driveFileName,
    normalizedContentType,
    await file.arrayBuffer()
  );

  const guestId = createGuestId();
  await env.DB.prepare(
    `INSERT INTO guests (
       id,
       hotel_id,
       name,
       phone,
       id_type,
       id_number,
       google_drive_file_id
     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(guestId, hotel.id, guestName, phone, idType, idNumber, uploadedFile.id)
    .run();

  return {
    guestId,
    hotelId: hotel.id,
    googleDriveFileId: uploadedFile.id,
  };
}

export function statusForGuestUploadError(message: string): number {
  if (
    message.includes("Missing") ||
    message.includes("Expected") ||
    message.includes("Unsupported") ||
    message.includes("Invalid")
  ) {
    return 400;
  }

  if (message.includes("not found")) {
    return 404;
  }

  if (message.includes("not connected") || message.includes("expired")) {
    return 409;
  }

  return 500;
}
