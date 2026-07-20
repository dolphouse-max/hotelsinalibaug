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

function databaseErrorMessage(error, fallbackMessage) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (/no such table|no such column/i.test(message)) {
    return "Guest records are being updated. Please try again in a minute.";
  }

  return message;
}

function formatDateOffset(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function getTableColumns(db, tableName) {
  const { results } = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  return new Set((results || []).map((column) => column.name));
}

async function tableExists(db, tableName) {
  const row = await db.prepare(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table' AND name = ?1
     LIMIT 1`
  ).bind(tableName).first();
  return Boolean(row?.name);
}

function selectColumn(columns, columnName) {
  return columns.has(columnName) ? columnName : `NULL AS ${columnName}`;
}

function searchableGuestColumn(columns, columnName) {
  return columns.has(columnName) ? `lower(COALESCE(g.${columnName}, ''))` : "''";
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
  if (!(await requirePoliceSession(context.request, context.env))) {
    return unauthorized();
  }

  try {
    const url = new URL(context.request.url);
    const officerName = url.searchParams.get("officer_name")?.trim() || "";
    const query = url.searchParams.get("q")?.trim() || "";
    const fromDate = url.searchParams.get("from") || formatDateOffset(29);
    const toDate = url.searchParams.get("to") || formatDateOffset(0);

    if (!officerName) {
      return badRequest("officer_name is required");
    }

    if (query.length < 2) {
      return badRequest("Please enter at least 2 characters to search.");
    }

    if (!isIsoDate(fromDate) || !isIsoDate(toDate) || fromDate > toDate) {
      return badRequest("Valid from and to dates are required.");
    }

    const guestColumns = await getTableColumns(context.env.DB, "guests");
    const logColumns = await getTableColumns(context.env.DB, "police_access_logs");
    const familyMembersTableExists = await tableExists(context.env.DB, "guest_family_members");
    const guestCheckInColumn = guestColumns.has("check_in_time") ? "g.check_in_time" : "g.created_at";
    const guestDateColumn = guestColumns.has("check_in_time") ? "g.check_in_time" : "g.created_at";
    const guestNameSearch = searchableGuestColumn(guestColumns, "name");
    const guestPhoneSearch = searchableGuestColumn(guestColumns, "phone");
    const guestVehicleSearch = searchableGuestColumn(guestColumns, "vehicle_number");
    const searchTerm = `%${query.toLowerCase()}%`;
    const familyMemberSearch = familyMembersTableExists
      ? `OR EXISTS (
           SELECT 1
           FROM guest_family_members gfm
           WHERE gfm.guest_id = g.id
             AND lower(gfm.full_name) LIKE ?1
         )`
      : "";
    const familyMemberCountSelect = familyMembersTableExists
      ? `(SELECT COUNT(*) FROM guest_family_members gfm WHERE gfm.guest_id = g.id) AS family_member_count`
      : "0 AS family_member_count";
    const familyMemberNamesSelect = familyMembersTableExists
      ? `(SELECT GROUP_CONCAT(gfm.full_name, ', ') FROM guest_family_members gfm WHERE gfm.guest_id = g.id) AS family_member_names`
      : "NULL AS family_member_names";
    const familyMembersJsonSelect = familyMembersTableExists
      ? `COALESCE((
           SELECT json_group_array(
             json_object(
               'id', gfm.id,
               'full_name', gfm.full_name,
               'age', gfm.age,
               'sex', gfm.sex,
               'id_type', gfm.id_type,
               'google_drive_file_id_front', gfm.google_drive_file_id_front,
               'google_drive_file_id_back', gfm.google_drive_file_id_back
             )
           )
           FROM guest_family_members gfm
           WHERE gfm.guest_id = g.id
         ), '[]') AS family_members_json`
      : "'[]' AS family_members_json";

    const result = await context.env.DB.prepare(
      `SELECT
         ${selectColumn(guestColumns, "id").replace(/^id\b/, "g.id")},
         ${selectColumn(guestColumns, "hotel_id").replace(/^hotel_id\b/, "g.hotel_id")},
         ${selectColumn(guestColumns, "name").replace(/^name\b/, "g.name")},
         ${selectColumn(guestColumns, "room_number").replace(/^room_number\b/, "g.room_number")},
         ${selectColumn(guestColumns, "phone").replace(/^phone\b/, "g.phone")},
         ${selectColumn(guestColumns, "id_type").replace(/^id_type\b/, "g.id_type")},
         ${selectColumn(guestColumns, "id_number").replace(/^id_number\b/, "g.id_number")},
         ${selectColumn(guestColumns, "vehicle_number").replace(/^vehicle_number\b/, "g.vehicle_number")},
         ${selectColumn(guestColumns, "check_in_time").replace(/^check_in_time\b/, "g.check_in_time")},
         ${selectColumn(guestColumns, "check_out_time").replace(/^check_out_time\b/, "g.check_out_time")},
         ${selectColumn(guestColumns, "google_drive_file_id_front").replace(/^google_drive_file_id_front\b/, "g.google_drive_file_id_front")},
         ${selectColumn(guestColumns, "google_drive_file_id_back").replace(/^google_drive_file_id_back\b/, "g.google_drive_file_id_back")},
         ${familyMemberCountSelect},
         ${familyMemberNamesSelect},
         ${familyMembersJsonSelect},
         h.name AS hotel_name
       FROM guests g
       INNER JOIN hotels h ON lower(h.id) = lower(g.hotel_id)
       WHERE
         (
           ${guestNameSearch} LIKE ?1
           OR ${guestPhoneSearch} LIKE ?1
           OR ${guestVehicleSearch} LIKE ?1
           ${familyMemberSearch}
         )
         AND substr(${guestDateColumn}, 1, 10) BETWEEN ?2 AND ?3
       ORDER BY ${guestCheckInColumn} DESC
       LIMIT 150`
    )
      .bind(searchTerm, fromDate, toDate)
      .all();

    const guests = result.results || [];
    await insertPoliceLogs(context.env.DB, officerName, guests, logColumns);

    return json({
      ok: true,
      officer_name: officerName,
      query,
      filters: {
        from: fromDate,
        to: toDate,
      },
      count: guests.length,
      guests,
    });
  } catch (error) {
    return json(
      { error: databaseErrorMessage(error, "Unable to search guests") },
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
