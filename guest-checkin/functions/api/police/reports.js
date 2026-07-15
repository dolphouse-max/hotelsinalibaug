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

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function requirePoliceAccess(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.POLICE_ACCESS_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.POLICE_ACCESS_TOKEN;
}

function formatDateOffset(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function countValue(statement) {
  const row = await statement.first();
  return Number(row?.count || 0);
}

async function insertPoliceLogs(db, officerName, guests) {
  if (!guests.length) {
    return;
  }

  const statements = guests.map((guest) =>
    db.prepare(
      `INSERT INTO police_access_logs (
         officer_name,
         guest_id,
         hotel_id
       ) VALUES (?1, ?2, ?3)`
    ).bind(officerName, guest.id, guest.hotel_id)
  );

  await db.batch(statements);
}

export async function onRequestGet(context) {
  if (!requirePoliceAccess(context.request, context.env)) {
    return unauthorized();
  }

  const url = new URL(context.request.url);
  const officerName = url.searchParams.get("officer_name")?.trim() || "";
  const hotelId = url.searchParams.get("hotel_id")?.trim() || "";
  const fromDate = url.searchParams.get("from") || formatDateOffset(29);
  const toDate = url.searchParams.get("to") || formatDateOffset(0);

  if (!officerName) {
    return badRequest("officer_name is required");
  }

  if (!isSafeId(hotelId)) {
    return badRequest("Valid hotel_id is required");
  }

  if (!isIsoDate(fromDate) || !isIsoDate(toDate) || fromDate > toDate) {
    return badRequest("Valid from and to dates are required");
  }

  const hotel = await context.env.DB.prepare(
    `SELECT
       h.id,
       h.name,
       h.contact,
       h.address,
       h.total_rooms,
       h.occupied_rooms,
       hs.email AS admin_email,
       hs.phone AS admin_phone
     FROM hotels h
     LEFT JOIN hotel_staff hs
       ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
     WHERE h.id = ?1
     LIMIT 1`
  )
    .bind(hotelId)
    .first();

  if (!hotel) {
    return json({ error: "Hotel not found" }, { status: 404 });
  }

  const [currentGuestsCount, staffCount, currentGuestsResult, guestRegisterResult, staffResult, accessLogsResult] =
    await Promise.all([
      countValue(
        context.env.DB.prepare(
          `SELECT COUNT(*) AS count
           FROM guests
           WHERE hotel_id = ?1
             AND check_out_time IS NULL`
        ).bind(hotelId)
      ),
      countValue(
        context.env.DB.prepare(
          `SELECT COUNT(*) AS count
           FROM hotel_staff
           WHERE hotel_id = ?1
             AND is_active = 1`
        ).bind(hotelId)
      ),
      context.env.DB.prepare(
        `SELECT
           id,
           hotel_id,
           name,
           room_number,
           total_guests,
           phone,
           id_type,
           id_number,
           check_in_time,
           expected_check_out_date
         FROM guests
         WHERE hotel_id = ?1
           AND check_out_time IS NULL
         ORDER BY check_in_time DESC
         LIMIT 100`
      ).bind(hotelId).all(),
      context.env.DB.prepare(
        `SELECT
           id,
           hotel_id,
           name,
           room_number,
           phone,
           id_type,
           id_number,
           check_in_time,
           check_out_time
         FROM guests
         WHERE hotel_id = ?1
           AND substr(check_in_time, 1, 10) BETWEEN ?2 AND ?3
         ORDER BY check_in_time DESC
         LIMIT 200`
      ).bind(hotelId, fromDate, toDate).all(),
      context.env.DB.prepare(
        `SELECT
           id,
           hotel_id,
           full_name,
           role,
           phone,
           email,
           is_active,
           working_since_month,
           working_since_year
         FROM hotel_staff
         WHERE hotel_id = ?1
         ORDER BY
           CASE role
             WHEN 'admin' THEN 0
             WHEN 'manager' THEN 1
             WHEN 'frontdesk' THEN 2
             ELSE 3
           END,
           full_name ASC
         LIMIT 100`
      ).bind(hotelId).all(),
      context.env.DB.prepare(
        `SELECT
           id,
           officer_name,
           guest_id,
           accessed_at
         FROM police_access_logs
         WHERE hotel_id = ?1
         ORDER BY accessed_at DESC
         LIMIT 100`
      ).bind(hotelId).all(),
    ]);

  const currentGuests = currentGuestsResult.results || [];
  await insertPoliceLogs(context.env.DB, officerName, currentGuests);

  return json({
    ok: true,
    officer_name: officerName,
    access_logged_for: currentGuests.length,
    filters: {
      hotel_id: hotelId,
      from: fromDate,
      to: toDate,
    },
    hotel,
    summary: {
      current_in_house_guests: currentGuestsCount,
      active_staff: staffCount,
      occupied_rooms: Number(hotel.occupied_rooms || 0),
      total_rooms: Number(hotel.total_rooms || 0),
    },
    reports: {
      current_guests: currentGuests,
      guest_register: guestRegisterResult.results || [],
      staff_register: staffResult.results || [],
      police_access_logs: accessLogsResult.results || [],
    },
  });
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
