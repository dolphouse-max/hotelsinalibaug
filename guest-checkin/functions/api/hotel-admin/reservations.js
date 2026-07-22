import { requireHotelAdminSession } from "../../_lib/auth";

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHotelId(value) {
  return normalizeText(value).toLowerCase();
}

function isSafeHotelId(value) {
  return /^[a-z][a-z0-9]{5,63}$/.test(String(value || ""));
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizePositiveInteger(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }
  return Math.floor(numeric);
}

function normalizeNonNegativeAmount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

async function ensureReservationTable(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS hotel_future_reservations (
        id TEXT PRIMARY KEY,
        hotel_id TEXT NOT NULL,
        booking_type TEXT NOT NULL DEFAULT 'future',
        booking_source TEXT NOT NULL DEFAULT 'direct',
        guest_name TEXT NOT NULL,
        guest_phone TEXT,
        total_guests INTEGER NOT NULL DEFAULT 1 CHECK (total_guests >= 1),
        room_count INTEGER NOT NULL DEFAULT 1 CHECK (room_count >= 1),
        check_in_date TEXT NOT NULL,
        check_out_date TEXT NOT NULL,
        room_plan TEXT,
        advance_payment REAL NOT NULL DEFAULT 0 CHECK (advance_payment >= 0),
        booking_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_future_reservations_hotel_id ON hotel_future_reservations(hotel_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_future_reservations_dates ON hotel_future_reservations(check_in_date, check_out_date)`),
  ]);
}

function normalizeReservationRecord(record, hotelId, index) {
  const id = normalizeText(record?.id) || `reservation_${Date.now()}_${index}`;
  const checkInDate = normalizeText(record?.check_in_date);
  const checkOutDate = normalizeText(record?.check_out_date);

  if (!normalizeText(record?.guest_name)) {
    throw new Error("Each reservation needs a guest name.");
  }

  if (!isIsoDate(checkInDate) || !isIsoDate(checkOutDate)) {
    throw new Error("Reservation dates must use YYYY-MM-DD format.");
  }

  if (checkOutDate <= checkInDate) {
    throw new Error("Reservation check-out date must be after check-in date.");
  }

  return {
    id,
    hotel_id: hotelId,
    booking_type: normalizeText(record?.booking_type) || "future",
    booking_source: normalizeText(record?.booking_source) || "direct",
    guest_name: normalizeText(record?.guest_name),
    guest_phone: normalizeText(record?.guest_phone),
    total_guests: normalizePositiveInteger(record?.total_guests, 1),
    room_count: normalizePositiveInteger(record?.room_count, 1),
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    room_plan: normalizeText(record?.room_plan),
    advance_payment: normalizeNonNegativeAmount(record?.advance_payment),
    booking_note: normalizeText(record?.booking_note),
    created_at: normalizeText(record?.created_at) || new Date().toISOString(),
  };
}

async function listReservations(db, hotelId) {
  const result = await db.prepare(
    `SELECT
       id,
       hotel_id,
       booking_type,
       booking_source,
       guest_name,
       guest_phone,
       total_guests,
       room_count,
       check_in_date,
       check_out_date,
       room_plan,
       advance_payment,
       booking_note,
       created_at,
       updated_at
     FROM hotel_future_reservations
     WHERE lower(hotel_id) = lower(?1)
     ORDER BY check_in_date ASC, created_at ASC`
  ).bind(hotelId).all();

  return result.results || [];
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const hotelId = normalizeHotelId(url.searchParams.get("hotel_id"));

    if (!isSafeHotelId(hotelId)) {
      return badRequest("Valid hotel_id is required.");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    await ensureReservationTable(context.env.DB);
    const reservations = await listReservations(context.env.DB, hotelId);
    return json({ ok: true, reservations });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to load reservations." }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const hotelId = normalizeHotelId(payload?.hotel_id);

    if (!isSafeHotelId(hotelId)) {
      return badRequest("Valid hotel_id is required.");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    await ensureReservationTable(context.env.DB);
    const inputRecords = Array.isArray(payload?.records) ? payload.records : [];
    const normalized = inputRecords.map((record, index) => normalizeReservationRecord(record, hotelId, index));

    const statements = [
      context.env.DB.prepare(`DELETE FROM hotel_future_reservations WHERE lower(hotel_id) = lower(?1)`).bind(hotelId),
      ...normalized.map((record) =>
        context.env.DB.prepare(
          `INSERT INTO hotel_future_reservations (
             id,
             hotel_id,
             booking_type,
             booking_source,
             guest_name,
             guest_phone,
             total_guests,
             room_count,
             check_in_date,
             check_out_date,
             room_plan,
             advance_payment,
             booking_note,
             created_at
           ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
        ).bind(
          record.id,
          record.hotel_id,
          record.booking_type,
          record.booking_source,
          record.guest_name,
          record.guest_phone || null,
          record.total_guests,
          record.room_count,
          record.check_in_date,
          record.check_out_date,
          record.room_plan || null,
          record.advance_payment,
          record.booking_note || null,
          record.created_at
        )
      ),
    ];

    await context.env.DB.batch(statements);
    const reservations = await listReservations(context.env.DB, hotelId);
    return json({ ok: true, reservations });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to save reservations.");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, OPTIONS",
    },
  });
