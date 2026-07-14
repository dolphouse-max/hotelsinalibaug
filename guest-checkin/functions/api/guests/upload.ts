import { badRequest, isSafeId, json, requireReadToken } from "../../_lib/api";
import { getHotelDriveAccessToken, uploadFileToHotelDrive } from "../../_lib/google-drive";

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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authError = requireReadToken(context);
  if (authError) {
    return authError;
  }

  const contentType = context.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("Expected multipart/form-data");
  }

  try {
    const formData = await context.request.formData();
    const hotelId = requireText(formData, "hotel_id");
    const guestName = requireText(formData, "name");
    const phone = requireText(formData, "phone");
    const idType = requireText(formData, "id_type");
    const idNumber = requireText(formData, "id_number");
    const file = formData.get("file");

    if (!isSafeId(hotelId)) {
      return badRequest("Invalid hotel_id");
    }

    if (!(file instanceof File)) {
      return badRequest("Missing uploaded file");
    }

    if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
      return badRequest("File is missing or exceeds 10 MB");
    }

    const normalizedContentType = file.type || "application/octet-stream";
    if (!ALLOWED_CONTENT_TYPES.has(normalizedContentType)) {
      return badRequest("Unsupported file type");
    }

    const { accessToken, folderId, hotel } = await getHotelDriveAccessToken(hotelId, context.env);
    const extension = normalizedContentType === "application/pdf" ? "pdf" : normalizedContentType.split("/")[1];
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
    await context.env.DB.prepare(
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
      .bind(
        guestId,
        hotel.id,
        guestName,
        phone,
        idType,
        idNumber,
        uploadedFile.id
      )
      .run();

    return json({
      ok: true,
      guestId,
      hotelId: hotel.id,
      googleDriveFileId: uploadedFile.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload guest document";
    const status =
      message.includes("Missing") || message.includes("Expected") || message.includes("Unsupported")
        ? 400
        : message.includes("not found")
          ? 404
          : message.includes("not connected")
            ? 409
            : 500;

    console.error("Guest upload failed", error);
    return json({ error: message }, { status });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
