import { isSafeId } from "./api";
import { getHotelDriveAccessToken, uploadFileToHotelDrive } from "./google-drive";
import { assertHotelCanAcceptUploads } from "./hotel-subscription";

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

interface StaffRecord {
  id: string;
  hotel_id: string;
  full_name: string;
  age: number | null;
  sex: string;
  working_since_month: string;
  working_since_year: number | null;
  email: string | null;
  phone: string;
  whatsapp_phone: string | null;
  address_line_1: string;
  address_city: string;
  address_pin_code: string;
  vehicle_type: string;
  vehicle_number: string | null;
  role: string;
  is_active: number;
  google_drive_file_id_front: string | null;
  google_drive_file_id_back: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffEmailRecord {
  id: string;
  full_name: string;
  role: string;
}

const STAFF_PLACEHOLDER_EMAIL_DOMAIN = "no-email.hotelsinalibaug.in";

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

function optionalEmail(formData: FormData, key: string): string | null {
  const value = optionalText(formData, key);
  return value ? value.toLowerCase() : null;
}

function buildPlaceholderEmail(hotelId: string, staffId: string): string {
  return `${hotelId}.${staffId}@${STAFF_PLACEHOLDER_EMAIL_DOMAIN}`.toLowerCase();
}

function isPlaceholderEmail(value: string | null): boolean {
  return Boolean(value) && String(value).toLowerCase().endsWith(`@${STAFF_PLACEHOLDER_EMAIL_DOMAIN}`);
}

function normalizeEmailForResponse<T extends StaffRecord>(staff: T): T {
  if (!isPlaceholderEmail(staff.email)) {
    return staff;
  }

  return {
    ...staff,
    email: null,
  };
}

function optionalNumber(formData: FormData, key: string, minimum = 0): number | null {
  const value = optionalText(formData, key);
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < minimum) {
    throw new Error(`Invalid ${key}`);
  }

  return Math.floor(numeric);
}

function requireUploadFile(formData: FormData, key: string): File {
  const value = formData.get(key);
  if (!(value instanceof File)) {
    throw new Error(`Missing ${key}`);
  }

  validateUploadFile(value, key);
  return value;
}

function optionalUploadFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File) || !value.size) {
    return null;
  }

  validateUploadFile(value, key);
  return value;
}

function validateUploadFile(file: File, key: string): void {
  if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${key} is missing or exceeds 10 MB`);
  }

  const normalizedContentType = file.type || "application/octet-stream";
  if (!ALLOWED_CONTENT_TYPES.has(normalizedContentType)) {
    throw new Error(`Unsupported ${key} type`);
  }
}

function sanitizeFileName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 120) || "staff-id";
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

function requireRole(formData: FormData): string {
  const value = requireText(formData, "role").toLowerCase();
  if (!["admin", "manager", "frontdesk", "staff", "kitchen", "waiter", "housekeeping", "security"].includes(value)) {
    throw new Error("role must be one of admin, manager, frontdesk, staff, kitchen, waiter, housekeeping, or security");
  }

  return value;
}

function requireSex(formData: FormData): string {
  const value = requireText(formData, "sex");
  if (!["Male", "Female", "Other"].includes(value)) {
    throw new Error("sex must be Male, Female, or Other");
  }

  return value;
}

function requireVehicleType(formData: FormData): string {
  const value = requireText(formData, "vehicle_type");
  if (!["None", "Car", "Motor Bike"].includes(value)) {
    throw new Error("vehicle_type must be None, Car, or Motor Bike");
  }

  return value;
}

function requireActiveFlag(formData: FormData): number {
  const value = optionalText(formData, "is_active");
  return value === "0" || value === "false" ? 0 : 1;
}

async function getExistingStaff(env: Env, hotelId: string, staffId: string): Promise<StaffRecord | null> {
  return env.DB.prepare(
    `SELECT
       id,
       hotel_id,
       full_name,
       age,
       sex,
       working_since_month,
       working_since_year,
       email,
       phone,
       whatsapp_phone,
       address_line_1,
       address_city,
       address_pin_code,
       vehicle_type,
       vehicle_number,
       role,
       is_active,
       google_drive_file_id_front,
       google_drive_file_id_back,
       created_at,
       updated_at
     FROM hotel_staff
     WHERE id = ?1 AND hotel_id = ?2
     LIMIT 1`
  )
    .bind(staffId, hotelId)
    .first<StaffRecord>();
}

async function findStaffByEmail(
  env: Env,
  hotelId: string,
  email: string,
  excludeStaffId = ""
): Promise<StaffEmailRecord | null> {
  return env.DB.prepare(
    `SELECT
       id,
       full_name,
       role
     FROM hotel_staff
     WHERE lower(hotel_id) = lower(?1)
       AND lower(email) = lower(?2)
       AND (?3 = '' OR id <> ?3)
     LIMIT 1`
  )
    .bind(hotelId, email, excludeStaffId)
    .first<StaffEmailRecord>();
}

export async function processStaffUpload(formData: FormData, env: Env): Promise<{
  created: boolean;
  staff: StaffRecord;
}> {
  const hotelId = requireText(formData, "hotel_id");
  const staffId = optionalText(formData, "staff_id");
  const fullName = requireText(formData, "full_name");
  const age = optionalNumber(formData, "age", 0);
  const sex = requireSex(formData);
  const workingSinceMonth = requireText(formData, "working_since_month");
  const workingSinceYear = optionalNumber(formData, "working_since_year", 1900);
  const email = optionalEmail(formData, "email");
  const { mobile, whatsapp } = normalizeWhatsapp(
    formData,
    "phone",
    "whatsapp_phone",
    "whatsapp_same_as_mobile"
  );
  const addressLine1 = requireText(formData, "address_line_1");
  const addressCity = requireText(formData, "address_city");
  const addressPinCode = requireText(formData, "address_pin_code");
  const vehicleType = requireVehicleType(formData);
  const vehicleNumber = vehicleType === "None" ? null : requireText(formData, "vehicle_number");
  const role = requireRole(formData);
  const isActive = requireActiveFlag(formData);

  if (!isSafeId(hotelId)) {
    throw new Error("Invalid hotel_id");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("email must be valid");
  }

  if (staffId && !isSafeId(staffId)) {
    throw new Error("Invalid staff_id");
  }

  await assertHotelCanAcceptUploads(hotelId, env);

  const existing = staffId ? await getExistingStaff(env, hotelId, staffId) : null;
  if (staffId && !existing) {
    throw new Error("Staff member not found");
  }

  if (email) {
    const emailOwner = await findStaffByEmail(env, hotelId, email, existing?.id || "");
    if (emailOwner) {
      throw new Error(
        `This email is already used for ${emailOwner.full_name} (${emailOwner.role}) in this hotel. Use a different email or leave the email field blank.`
      );
    }
  }

  const createMode = !existing;
  const frontFile = createMode
    ? requireUploadFile(formData, "id_front_file")
    : optionalUploadFile(formData, "id_front_file");
  const backFile = createMode
    ? requireUploadFile(formData, "id_back_file")
    : optionalUploadFile(formData, "id_back_file");

  const { accessToken, folderId } = await getHotelDriveAccessToken(hotelId, env);
  const baseName = `${fullName}-${role}`;
  const frontFileId =
    frontFile ? await uploadProofFile(accessToken, folderId, frontFile, baseName, "front") : existing?.google_drive_file_id_front || null;
  const backFileId =
    backFile ? await uploadProofFile(accessToken, folderId, backFile, baseName, "back") : existing?.google_drive_file_id_back || null;

  if (!frontFileId || !backFileId) {
    throw new Error("Both staff ID proof images are required");
  }

  if (createMode) {
    const newStaffId = crypto.randomUUID().replace(/-/g, "");
    const storedEmail = email || buildPlaceholderEmail(hotelId, newStaffId);
    const result = await env.DB.prepare(
      `INSERT INTO hotel_staff (
         id,
         hotel_id,
         full_name,
         age,
         sex,
         working_since_month,
         working_since_year,
         email,
         phone,
         whatsapp_phone,
         address_line_1,
         address_city,
         address_pin_code,
         vehicle_type,
         vehicle_number,
         role,
         is_active,
         google_drive_file_id_front,
         google_drive_file_id_back
       ) VALUES (
         ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19
       )
       RETURNING
         id,
         hotel_id,
         full_name,
         age,
         sex,
         working_since_month,
         working_since_year,
         email,
         phone,
         whatsapp_phone,
         address_line_1,
         address_city,
         address_pin_code,
         vehicle_type,
         vehicle_number,
         role,
         is_active,
         google_drive_file_id_front,
         google_drive_file_id_back,
         created_at,
         updated_at`
    )
      .bind(
        newStaffId,
        hotelId,
        fullName,
        age,
        sex,
        workingSinceMonth,
        workingSinceYear,
        storedEmail,
        mobile,
        whatsapp,
        addressLine1,
        addressCity,
        addressPinCode,
        vehicleType,
        vehicleNumber,
        role,
        isActive,
        frontFileId,
        backFileId
      )
      .first<StaffRecord>();

    if (!result) {
      throw new Error("Unable to save staff member");
    }

    return { created: true, staff: normalizeEmailForResponse(result) };
  }

  const storedEmail = email || buildPlaceholderEmail(hotelId, existing.id);
  const updated = await env.DB.prepare(
    `UPDATE hotel_staff
     SET full_name = ?1,
         age = ?2,
         sex = ?3,
         working_since_month = ?4,
         working_since_year = ?5,
         email = ?6,
         phone = ?7,
         whatsapp_phone = ?8,
         address_line_1 = ?9,
         address_city = ?10,
         address_pin_code = ?11,
         vehicle_type = ?12,
         vehicle_number = ?13,
         role = ?14,
         is_active = ?15,
         google_drive_file_id_front = ?16,
         google_drive_file_id_back = ?17,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?18 AND hotel_id = ?19
     RETURNING
       id,
       hotel_id,
       full_name,
       age,
       sex,
       working_since_month,
       working_since_year,
       email,
       phone,
       whatsapp_phone,
       address_line_1,
       address_city,
       address_pin_code,
       vehicle_type,
       vehicle_number,
       role,
       is_active,
       google_drive_file_id_front,
       google_drive_file_id_back,
       created_at,
       updated_at`
  )
    .bind(
      fullName,
      age,
      sex,
      workingSinceMonth,
      workingSinceYear,
      storedEmail,
      mobile,
      whatsapp,
      addressLine1,
      addressCity,
      addressPinCode,
      vehicleType,
      vehicleNumber,
      role,
      isActive,
      frontFileId,
      backFileId,
      existing.id,
      hotelId
    )
    .first<StaffRecord>();

  if (!updated) {
    throw new Error("Staff member not found");
  }

  return { created: false, staff: normalizeEmailForResponse(updated) };
}

export function statusForStaffUploadError(message: string): number {
  if (
    message.includes("Missing") ||
    message.includes("Expected") ||
    message.includes("Unsupported") ||
    message.includes("Invalid") ||
    message.includes("required") ||
    message.includes("must be valid")
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

  if (message.includes("UNIQUE constraint failed")) {
    return 409;
  }

  return 500;
}
