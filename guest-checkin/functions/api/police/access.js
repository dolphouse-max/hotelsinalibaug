import { requirePoliceSession } from "../../_lib/auth";

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

function isSafeGuestId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/i.test(value.trim());
}

function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
}

async function insertPoliceLogs(db, officerName, guests) {
  if (!guests.length) {
    return;
  }

  const { results } = await db.prepare(`PRAGMA table_info(police_access_logs)`).all();
  const logColumns = new Set((results || []).map((column) => column.name));
  const supportsHotelId = logColumns.has("hotel_id");

  const statements = guests.map((guest) =>
    supportsHotelId
      ? db.prepare(
          `INSERT INTO police_access_logs (
             officer_name,
             guest_id,
             hotel_id
           ) VALUES (?1, ?2, ?3)`
        ).bind(officerName, guest.id, guest.hotel_id)
      : db.prepare(
          `INSERT INTO police_access_logs (
             officer_name,
             guest_id
           ) VALUES (?1, ?2)`
        ).bind(officerName, guest.id)
  );

  await db.batch(statements);
}

export async function onRequestGet(context) {
  if (!(await requirePoliceSession(context.request, context.env))) {
    return unauthorized();
  }

  const url = new URL(context.request.url);
  const officerName = url.searchParams.get("officer_name")?.trim() || "";
  const hotelId = url.searchParams.get("hotel_id")?.trim() || "";
  const guestId = url.searchParams.get("guest_id")?.trim() || "";

  if (!officerName) {
    return badRequest("officer_name is required");
  }

  if (!isSafeHotelId(hotelId)) {
    return badRequest("Valid hotel_id is required");
  }

  if (guestId && !isSafeGuestId(guestId)) {
    return badRequest("Invalid guest_id");
  }

  let query = `
    SELECT
      g.id,
      g.hotel_id,
      h.name AS hotel_name,
      g.name,
      g.phone,
      g.id_type,
      g.id_number,
      g.google_drive_file_id_front,
      g.google_drive_file_id_back,
      g.check_in_time,
      g.check_out_time,
      g.created_at,
      g.updated_at
    FROM guests g
    INNER JOIN hotels h ON h.id = g.hotel_id
    WHERE g.hotel_id = ?1
  `;
  const bindings = [hotelId];

  if (guestId) {
    query += " AND g.id = ?2";
    bindings.push(guestId);
  }

  query += " ORDER BY g.check_in_time DESC";

  const { results } = await context.env.DB.prepare(query).bind(...bindings).all();
  const guests = results || [];

  await insertPoliceLogs(context.env.DB, officerName, guests);

  return json({
    ok: true,
    officer_name: officerName,
    guests,
    access_logged_for: guests.length,
  });
}

export async function onRequestPost(context) {
  if (!(await requirePoliceSession(context.request, context.env))) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const officerName = typeof payload.officer_name === "string" ? payload.officer_name.trim() : "";
    const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";
    const guestId = typeof payload.guest_id === "string" ? payload.guest_id.trim() : "";

    if (!officerName) {
      return badRequest("officer_name is required");
    }

    if (!isSafeHotelId(hotelId) || !isSafeGuestId(guestId)) {
      return badRequest("Valid hotel_id and guest_id are required");
    }

    const guest = await context.env.DB.prepare(
      `SELECT
         g.id,
         g.hotel_id,
         h.name AS hotel_name,
         g.name,
         g.phone,
         g.id_type,
         g.id_number,
         g.google_drive_file_id_front,
         g.google_drive_file_id_back,
         g.check_in_time,
         g.check_out_time,
         g.created_at,
         g.updated_at
       FROM guests g
       INNER JOIN hotels h ON h.id = g.hotel_id
       WHERE g.hotel_id = ?1 AND g.id = ?2
       LIMIT 1`
    )
      .bind(hotelId, guestId)
      .first();

    if (!guest) {
      return json({ error: "Guest not found" }, { status: 404 });
    }

    await insertPoliceLogs(context.env.DB, officerName, [guest]);

    return json({ ok: true, officer_name: officerName, guest, access_logged_for: 1 });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to process police access request");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, OPTIONS",
    },
  });
