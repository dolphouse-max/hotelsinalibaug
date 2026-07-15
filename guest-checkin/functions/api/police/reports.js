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

function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
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
    return "Hotel records are being updated. Please try again in a minute.";
  }

  return message;
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

async function insertPoliceLogs(db, officerName, guests, logColumns) {
  if (!guests.length) {
    return;
  }

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
  if (!requirePoliceAccess(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const url = new URL(context.request.url);
    const officerName = url.searchParams.get("officer_name")?.trim() || "";
    const hotelId = url.searchParams.get("hotel_id")?.trim() || "";
    const fromDate = url.searchParams.get("from") || formatDateOffset(29);
    const toDate = url.searchParams.get("to") || formatDateOffset(0);

    if (!officerName) {
      return badRequest("officer_name is required");
    }

    if (!isSafeHotelId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    if (!isIsoDate(fromDate) || !isIsoDate(toDate) || fromDate > toDate) {
      return badRequest("Valid from and to dates are required");
    }

    const guestColumns = await getTableColumns(context.env.DB, "guests");
    const staffColumns = await getTableColumns(context.env.DB, "hotel_staff");
    const logColumns = await getTableColumns(context.env.DB, "police_access_logs");
    const joinRoleExpression = staffColumns.has("role") ? "hs.role" : "'staff'";
    const joinActiveExpression = staffColumns.has("is_active") ? "hs.is_active" : "1";
    const staffRoleExpression = staffColumns.has("role") ? "role" : "'staff'";
    const staffActiveExpression = staffColumns.has("is_active") ? "is_active" : "1";
    const currentCheckoutExpression = guestColumns.has("check_out_time") ? "check_out_time" : "NULL";
    const guestCheckInColumn = guestColumns.has("check_in_time") ? "check_in_time" : "created_at";
    const staffNameColumn = staffColumns.has("full_name") ? "full_name" : "id";

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
         ON hs.hotel_id = h.id AND ${joinRoleExpression} = 'admin' AND ${joinActiveExpression} = 1
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
               AND ${currentCheckoutExpression} IS NULL`
          ).bind(hotelId)
        ),
        countValue(
          context.env.DB.prepare(
            `SELECT COUNT(*) AS count
             FROM hotel_staff
             WHERE hotel_id = ?1
               AND ${staffActiveExpression} = 1`
          ).bind(hotelId)
        ),
        context.env.DB.prepare(
          `SELECT
             ${selectColumn(guestColumns, "id")},
             ${selectColumn(guestColumns, "hotel_id")},
             ${selectColumn(guestColumns, "name")},
             ${selectColumn(guestColumns, "room_number")},
             ${selectColumn(guestColumns, "total_guests")},
             ${selectColumn(guestColumns, "phone")},
             ${selectColumn(guestColumns, "id_type")},
             ${selectColumn(guestColumns, "id_number")},
             ${selectColumn(guestColumns, "check_in_time")},
             ${selectColumn(guestColumns, "expected_check_out_date")}
           FROM guests
           WHERE hotel_id = ?1
             AND ${currentCheckoutExpression} IS NULL
           ORDER BY ${guestCheckInColumn} DESC
           LIMIT 100`
        ).bind(hotelId).all(),
        context.env.DB.prepare(
          `SELECT
             ${selectColumn(guestColumns, "id")},
             ${selectColumn(guestColumns, "hotel_id")},
             ${selectColumn(guestColumns, "name")},
             ${selectColumn(guestColumns, "room_number")},
             ${selectColumn(guestColumns, "phone")},
             ${selectColumn(guestColumns, "id_type")},
             ${selectColumn(guestColumns, "id_number")},
             ${selectColumn(guestColumns, "check_in_time")},
             ${selectColumn(guestColumns, "check_out_time")}
           FROM guests
           WHERE hotel_id = ?1
             AND substr(${guestCheckInColumn}, 1, 10) BETWEEN ?2 AND ?3
           ORDER BY ${guestCheckInColumn} DESC
           LIMIT 200`
        ).bind(hotelId, fromDate, toDate).all(),
        context.env.DB.prepare(
          `SELECT
             ${selectColumn(staffColumns, "id")},
             ${selectColumn(staffColumns, "hotel_id")},
             ${selectColumn(staffColumns, "full_name")},
             ${selectColumn(staffColumns, "role")},
             ${selectColumn(staffColumns, "phone")},
             ${selectColumn(staffColumns, "email")},
             ${selectColumn(staffColumns, "is_active")},
             ${selectColumn(staffColumns, "working_since_month")},
             ${selectColumn(staffColumns, "working_since_year")}
           FROM hotel_staff
           WHERE hotel_id = ?1
           ORDER BY
             CASE ${staffRoleExpression}
               WHEN 'admin' THEN 0
               WHEN 'manager' THEN 1
               WHEN 'frontdesk' THEN 2
               ELSE 3
             END,
             ${staffNameColumn} ASC
           LIMIT 100`
        ).bind(hotelId).all(),
        logColumns.has("hotel_id")
          ? context.env.DB.prepare(
              `SELECT
                 ${selectColumn(logColumns, "id")},
                 ${selectColumn(logColumns, "officer_name")},
                 ${selectColumn(logColumns, "guest_id")},
                 ${selectColumn(logColumns, "accessed_at")}
               FROM police_access_logs
               WHERE hotel_id = ?1
               ORDER BY accessed_at DESC
               LIMIT 100`
            ).bind(hotelId).all()
          : context.env.DB.prepare(
              `SELECT
                 p.id,
                 p.officer_name,
                 p.guest_id,
                 p.accessed_at
               FROM police_access_logs p
               INNER JOIN guests g ON g.id = p.guest_id
               WHERE g.hotel_id = ?1
               ORDER BY p.accessed_at DESC
               LIMIT 100`
            ).bind(hotelId).all(),
      ]);

    const currentGuests = currentGuestsResult.results || [];
    await insertPoliceLogs(context.env.DB, officerName, currentGuests, logColumns);

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
  } catch (error) {
    return json(
      { error: databaseErrorMessage(error, "Unable to load police report") },
      { status: 500 }
    );
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
