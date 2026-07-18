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

async function recalculateOccupiedRooms(db, hotelId) {
  const current = await db.prepare(
    `SELECT COUNT(DISTINCT room_number) AS occupied_rooms
     FROM guests
     WHERE hotel_id = ?1
       AND check_out_time IS NULL`
  )
    .bind(hotelId)
    .first();

  const occupiedRooms = Number(current?.occupied_rooms || 0);

  await db.prepare(
    `UPDATE hotels
     SET occupied_rooms = ?1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?2`
  )
    .bind(occupiedRooms, hotelId)
    .run();

  return occupiedRooms;
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const hotelId = url.searchParams.get("hotel_id");
    const status = (url.searchParams.get("status") || "current").trim().toLowerCase();
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();

    if (!isSafeId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    const columns = await getTableColumns(context.env.DB, "guests");
    const clauses = ["hotel_id = ?1"];
    const bindings = [hotelId.trim()];
    const checkoutExpression = columns.has("check_out_time")
      ? "check_out_time"
      : "NULL";

    if (status === "current") {
      clauses.push(`${checkoutExpression} IS NULL`);
    } else if (status === "checked_out") {
      clauses.push(`${checkoutExpression} IS NOT NULL`);
    } else if (status !== "all") {
      return badRequest("status must be current, checked_out, or all");
    }

    if (query) {
      const roomExpression = columns.has("room_number") ? "room_number" : "''";
      clauses.push(`(lower(name) LIKE ?2 OR lower(${roomExpression}) LIKE ?2 OR lower(id) LIKE ?2 OR lower(phone) LIKE ?2)`);
      bindings.push(`%${query}%`);
    }

    const selectedColumns = [
      "id",
      "hotel_id",
      "name",
      "age",
      "sex",
      "total_guests",
      "room_number",
      "check_in_time",
      "expected_check_out_date",
      "phone",
      "whatsapp_phone",
      "coming_from",
      "going_to",
      "id_type",
      "id_number",
      "check_out_time",
    ]
      .map((columnName) => selectColumn(columns, columnName))
      .join(",\n       ");

    const checkInColumn = columns.has("check_in_time") ? "check_in_time" : "created_at";

    const { results } = await context.env.DB.prepare(
      `SELECT
       ${selectedColumns}
     FROM guests
     WHERE ${clauses.join(" AND ")}
     ORDER BY
       CASE WHEN ${checkoutExpression} IS NULL THEN 0 ELSE 1 END,
       ${checkInColumn} DESC`
    )
      .bind(...bindings)
      .all();

    return json({ ok: true, guests: results || [] });
  } catch (error) {
    return json(
      { error: databaseErrorMessage(error, "Unable to load current guests") },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";
    const guestId = typeof payload.guest_id === "string" ? payload.guest_id.trim() : "";

    if (!isSafeId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    if (!isSafeId(guestId)) {
      return badRequest("Valid guest_id is required");
    }

    const guest = await context.env.DB.prepare(
      `SELECT id, hotel_id, name, room_number, check_out_time
       FROM guests
       WHERE id = ?1 AND hotel_id = ?2
       LIMIT 1`
    )
      .bind(guestId, hotelId)
      .first();

    if (!guest) {
      return json({ error: "Guest not found" }, { status: 404 });
    }

    if (guest.check_out_time) {
      return json({ error: "Guest is already checked out" }, { status: 409 });
    }

    const updated = await context.env.DB.prepare(
      `UPDATE guests
       SET check_out_time = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1 AND hotel_id = ?2
       RETURNING
         id,
         hotel_id,
         name,
         room_number,
         check_in_time,
         expected_check_out_date,
         check_out_time`
    )
      .bind(guestId, hotelId)
      .first();

    const occupiedRooms = await recalculateOccupiedRooms(context.env.DB, hotelId);

    return json({
      ok: true,
      guest: updated,
      occupied_rooms: occupiedRooms,
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to check out guest");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, OPTIONS",
    },
  });
