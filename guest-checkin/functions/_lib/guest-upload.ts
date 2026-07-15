import { isSafeId } from "./api";
import { getHotelDriveAccessToken, uploadFileToHotelDrive } from "./google-drive";
import { assertHotelCanAcceptGuestUploads } from "./hotel-subscription";

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

function optionalText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requireNumber(formData: FormData, key: string, minimum = 0): number {
  const raw = requireText(formData, key);
  const numeric = Number(raw);

  if (!Number.isFinite(numeric) || numeric < minimum) {
    throw new Error(`Invalid ${key}`);
  }

  return Math.floor(numeric);
}

function sanitizeFileName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 120) || "guest-id";
}

function createGuestId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function requireUploadFile(formData: FormData, key: string): File {
  const value = formData.get(key);

  if (!(value instanceof File)) {
    throw new Error(`Missing ${key}`);
  }

  if (!value.size || value.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${key} is missing or exceeds 10 MB`);
  }

  const normalizedContentType = value.type || "application/octet-stream";
  if (!ALLOWED_CONTENT_TYPES.has(normalizedContentType)) {
    throw new Error(`Unsupported ${key} type`);
  }

  return value;
}

async function uploadProofFile(
  accessToken: string,
  folderId: string,
  file: File,
  baseName: string,
  suffix: string
): Promise<string> {
  const normalizedContentType = file.type || "application/octet-stream";
  const extension =
    normalizedContentType === "application/pdf" ? "pdf" : normalizedContentType.split("/")[1];
  const driveFileName = sanitizeFileName(
    `${baseName}-${suffix}-${Date.now()}.${extension || "bin"}`
  );
  const uploadedFile = await uploadFileToHotelDrive(
    accessToken,
    folderId,
    driveFileName,
    normalizedContentType,
    await file.arrayBuffer()
  );

  return uploadedFile.id;
}

function normalizeWhatsapp(formData: FormData, mobileKey: string, whatsappKey: string, sameKey: string) {
  const mobile = requireText(formData, mobileKey);
  const sameAsMobile = requireText(formData, sameKey).toLowerCase() === "true";
  const whatsapp = sameAsMobile ? mobile : requireText(formData, whatsappKey);

  return { mobile, whatsapp };
}

export async function processGuestUpload(formData: FormData, env: Env): Promise<{
  guestId: string;
  hotelId: string;
  googleDriveFileIdFront: string;
  googleDriveFileIdBack: string;
}> {
  const hotelId = requireText(formData, "hotel_id");
  const guestName = requireText(formData, "name");
  const age = requireNumber(formData, "age", 0);
  const sex = requireText(formData, "sex");
  const totalGuests = requireNumber(formData, "total_guests", 1);
  const roomNumber = requireText(formData, "room_number");
  const expectedCheckOutDate = requireText(formData, "expected_check_out_date");
  const addressLine1 = requireText(formData, "address_line_1");
  const addressCity = requireText(formData, "address_city");
  const addressPinCode = requireText(formData, "address_pin_code");
  const { mobile, whatsapp } = normalizeWhatsapp(formData, "phone", "whatsapp_phone", "whatsapp_same_as_mobile");
  const email = optionalText(formData, "email");
  const vehicleType = requireText(formData, "vehicle_type");
  const vehicleNumber = vehicleType === "None" ? null : requireText(formData, "vehicle_number");
  const comingFrom = requireText(formData, "coming_from");
  const goingTo = requireText(formData, "going_to");
  const idType = requireText(formData, "id_type");
  const idNumber = optionalText(formData, "id_number") || "Captured from uploaded ID proof";
  const idFrontFile = requireUploadFile(formData, "id_front_file");
  const idBackFile = requireUploadFile(formData, "id_back_file");

  if (!isSafeId(hotelId)) {
    throw new Error("Invalid hotel_id");
  }

  if (!["Male", "Female", "Other"].includes(sex)) {
    throw new Error("Invalid sex");
  }

  if (!["None", "Car", "Motor Bike"].includes(vehicleType)) {
    throw new Error("Invalid vehicle_type");
  }

  await assertHotelCanAcceptGuestUploads(hotelId, env);

  const { accessToken, folderId, hotel } = await getHotelDriveAccessToken(hotelId, env);
  const baseFileName = `${guestName}-${idType}`;
  const frontFileId = await uploadProofFile(accessToken, folderId, idFrontFile, baseFileName, "front");
  const backFileId = await uploadProofFile(accessToken, folderId, idBackFile, baseFileName, "back");

  const guestId = createGuestId();
  await env.DB.prepare(
    `INSERT INTO guests (
       id,
       hotel_id,
       name,
       age,
       sex,
       total_guests,
       room_number,
       expected_check_out_date,
       address_line_1,
       address_city,
       address_pin_code,
       phone,
       whatsapp_phone,
       email,
       vehicle_type,
       vehicle_number,
       coming_from,
       going_to,
       id_type,
       id_number,
       google_drive_file_id_front,
       google_drive_file_id_back
     ) VALUES (
       ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22
     )`
  )
    .bind(
      guestId,
      hotel.id,
      guestName,
      age,
      sex,
      totalGuests,
      roomNumber,
      expectedCheckOutDate,
      addressLine1,
      addressCity,
      addressPinCode,
      mobile,
      whatsapp,
      email,
      vehicleType,
      vehicleNumber,
      comingFrom,
      goingTo,
      idType,
      idNumber,
      frontFileId,
      backFileId
    )
    .run();

  return {
    guestId,
    hotelId: hotel.id,
    googleDriveFileIdFront: frontFileId,
    googleDriveFileIdBack: backFileId,
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

  if (
    message.includes("not connected") ||
    message.includes("expired") ||
    message.includes("inactive") ||
    message.includes("not started")
  ) {
    return 409;
  }

  return 500;
}
