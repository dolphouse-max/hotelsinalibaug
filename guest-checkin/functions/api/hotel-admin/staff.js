import { requireHotelAdminSession } from "../../_lib/auth";

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(body), { ...init, headers });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

function isSafeId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/i.test(value.trim());
}

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function requireText(payload, key) {
  const value = typeof payload[key] === "string" ? payload[key].trim() : "";

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function optionalText(payload, key) {
  const value = typeof payload[key] === "string" ? payload[key].trim() : "";
  return value || null;
}

function integerOrNull(value, key, min = 0) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (!Number.isInteger(value) || value < min) {
    throw new Error(`Invalid ${key}`);
  }

  return value;
}

async function getTableColumns(db, tableName) {
  const { results } = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  return new Set((results || []).map((column) => column.name));
}

function selectColumn(columns, columnName) {
  return columns.has(columnName) ? columnName : `NULL AS ${columnName}`;
}

function databaseErrorMessage(error, fallbackMessage) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (/no such table|no such column/i.test(message)) {
    return "Database schema is out of date. Re-run the latest guest-checkin/schema.sql on D1.";
  }

  return message;
}

function normalizeStaffPayload(payload) {
  const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";
  const staffId = typeof payload.staff_id === "string" ? payload.staff_id.trim() : typeof payload.id === "string" ? payload.id.trim() : "";
  const fullName = requireText(payload, "full_name");
  const email = optionalText(payload, "email");
  const phone = requireText(payload, "phone");
  const whatsappPhone = payload.whatsapp_same_as_mobile ? phone : requireText(payload, "whatsapp_phone");
  const role = typeof payload.role === "string" ? payload.role.trim().toLowerCase() : "staff";
  const isActive = payload.is_active === false || payload.is_active === 0 ? 0 : 1;
  const sex = requireText(payload, "sex");
  const age = integerOrNull(payload.age, "age", 0);
  const workingSinceMonth = requireText(payload, "working_since_month");
  const workingSinceYear = integerOrNull(payload.working_since_year, "working_since_year", 1900);
  const addressLine1 = requireText(payload, "address_line_1");
  const addressCity = requireText(payload, "address_city");
  const addressPinCode = requireText(payload, "address_pin_code");
  const vehicleType = requireText(payload, "vehicle_type");
  const vehicleNumber = vehicleType === "None" ? null : requireText(payload, "vehicle_number");
  const frontFileId = optionalText(payload, "google_drive_file_id_front");
  const backFileId = optionalText(payload, "google_drive_file_id_back");

  if (!isSafeId(hotelId)) {
    throw new Error("Valid hotel_id is required");
  }

  if (email && !isEmail(email)) {
    throw new Error("email must be valid");
  }

  if (!["admin", "manager", "frontdesk", "staff", "kitchen", "waiter", "housekeeping", "security"].includes(role)) {
    throw new Error("role must be one of admin, manager, frontdesk, staff, kitchen, waiter, housekeeping, or security");
  }

  if (!["Male", "Female", "Other"].includes(sex)) {
    throw new Error("sex must be Male, Female, or Other");
  }

  if (!["None", "Car", "Motor Bike"].includes(vehicleType)) {
    throw new Error("vehicle_type must be None, Car, or Motor Bike");
  }

  return {
    hotelId,
    staffId,
    fullName,
    email,
    phone,
    whatsappPhone,
    sex,
    age,
    workingSinceMonth,
    workingSinceYear,
    addressLine1,
    addressCity,
    addressPinCode,
    vehicleType,
    vehicleNumber,
    role,
    isActive,
    frontFileId,
    backFileId,
  };
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const hotelId = url.searchParams.get("hotel_id");

    if (!isSafeId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    const columns = await getTableColumns(context.env.DB, "hotel_staff");
    const selectedColumns = [
      "id",
      "hotel_id",
      "full_name",
      "age",
      "sex",
      "working_since_month",
      "working_since_year",
      "email",
      "phone",
      "whatsapp_phone",
      "address_line_1",
      "address_city",
      "address_pin_code",
      "vehicle_type",
      "vehicle_number",
      "role",
      "is_active",
      "google_drive_file_id_front",
      "google_drive_file_id_back",
      "created_at",
      "updated_at",
    ]
      .map((columnName) => selectColumn(columns, columnName))
      .join(",\n       ");

    const roleColumn = columns.has("role") ? "role" : "'staff'";
    const nameColumn = columns.has("full_name") ? "full_name" : "id";

    const { results } = await context.env.DB.prepare(
      `SELECT
       ${selectedColumns}
     FROM hotel_staff
     WHERE hotel_id = ?1
     ORDER BY
       CASE ${roleColumn}
         WHEN 'admin' THEN 0
         WHEN 'manager' THEN 1
         WHEN 'frontdesk' THEN 2
         ELSE 3
       END,
       ${nameColumn} ASC`
    )
      .bind(hotelId.trim())
      .all();

    return json({ ok: true, staff: results || [] });
  } catch (error) {
    return json(
      { error: databaseErrorMessage(error, "Unable to load staff") },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const staff = normalizeStaffPayload(payload);
    const staffId = crypto.randomUUID().replace(/-/g, "");

    if (!(await requireHotelAdminSession(context.request, context.env, staff.hotelId))) {
      return unauthorized();
    }

    const result = await context.env.DB.prepare(
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
       is_active
       , google_drive_file_id_front,
       google_drive_file_id_back
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
       RETURNING id, hotel_id, full_name, age, sex, working_since_month, working_since_year, email, phone, whatsapp_phone, address_line_1, address_city, address_pin_code, vehicle_type, vehicle_number, role, is_active, google_drive_file_id_front, google_drive_file_id_back, created_at, updated_at`
    )
      .bind(
        staffId,
        staff.hotelId,
        staff.fullName,
        staff.age,
        staff.sex,
        staff.workingSinceMonth,
        staff.workingSinceYear,
        staff.email,
        staff.phone,
        staff.whatsappPhone,
        staff.addressLine1,
        staff.addressCity,
        staff.addressPinCode,
        staff.vehicleType,
        staff.vehicleNumber,
        staff.role,
        staff.isActive,
        staff.frontFileId,
        staff.backFileId
      )
      .first();

    return json({ ok: true, staff: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add staff";
    const status = message.includes("UNIQUE constraint failed") ? 409 : 400;
    return json({ error: message }, { status });
  }
}

export async function onRequestPut(context) {
  try {
    const payload = await context.request.json();
    const staff = normalizeStaffPayload(payload);

    if (!isSafeId(staff.staffId)) {
      return badRequest("Valid staff_id is required");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, staff.hotelId))) {
      return unauthorized();
    }

    const result = await context.env.DB.prepare(
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
           google_drive_file_id_front = COALESCE(?16, google_drive_file_id_front),
           google_drive_file_id_back = COALESCE(?17, google_drive_file_id_back),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?18 AND hotel_id = ?19
       RETURNING id, hotel_id, full_name, age, sex, working_since_month, working_since_year, email, phone, whatsapp_phone, address_line_1, address_city, address_pin_code, vehicle_type, vehicle_number, role, is_active, google_drive_file_id_front, google_drive_file_id_back, created_at, updated_at`
    )
      .bind(
        staff.fullName,
        staff.age,
        staff.sex,
        staff.workingSinceMonth,
        staff.workingSinceYear,
        staff.email,
        staff.phone,
        staff.whatsappPhone,
        staff.addressLine1,
        staff.addressCity,
        staff.addressPinCode,
        staff.vehicleType,
        staff.vehicleNumber,
        staff.role,
        staff.isActive,
        staff.frontFileId,
        staff.backFileId,
        staff.staffId,
        staff.hotelId
      )
      .first();

    if (!result) {
      return json({ error: "Staff member not found" }, { status: 404 });
    }

    return json({ ok: true, staff: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update staff";
    const status = message.includes("UNIQUE constraint failed") ? 409 : 400;
    return json({ error: message }, { status });
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, PUT, OPTIONS",
    },
  });
