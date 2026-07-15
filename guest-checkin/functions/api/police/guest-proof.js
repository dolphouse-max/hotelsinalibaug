import { getHotelDriveAccessToken } from "../../_lib/google-drive";

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

function requirePoliceAccess(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.POLICE_ACCESS_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.POLICE_ACCESS_TOKEN;
}

async function logPoliceAccess(db, officerName, guestId, hotelId) {
  const { results } = await db.prepare(`PRAGMA table_info(police_access_logs)`).all();
  const logColumns = new Set((results || []).map((column) => column.name));

  if (logColumns.has("hotel_id")) {
    await db.prepare(
      `INSERT INTO police_access_logs (
         officer_name,
         guest_id,
         hotel_id
       ) VALUES (?1, ?2, ?3)`
    )
      .bind(officerName, guestId, hotelId)
      .run();
    return;
  }

  await db.prepare(
    `INSERT INTO police_access_logs (
       officer_name,
       guest_id
     ) VALUES (?1, ?2)`
  )
    .bind(officerName, guestId)
    .run();
}

export async function onRequestGet(context) {
  if (!requirePoliceAccess(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const url = new URL(context.request.url);
    const officerName = url.searchParams.get("officer_name")?.trim() || "";
    const hotelId = url.searchParams.get("hotel_id")?.trim() || "";
    const guestId = url.searchParams.get("guest_id")?.trim() || "";
    const side = url.searchParams.get("side")?.trim() || "";

    if (!officerName) {
      return badRequest("officer_name is required");
    }

    if (!isSafeHotelId(hotelId) || !isSafeGuestId(guestId)) {
      return badRequest("Valid hotel_id and guest_id are required");
    }

    if (!["front", "back"].includes(side)) {
      return badRequest("side must be front or back");
    }

    const guest = await context.env.DB.prepare(
      `SELECT
         id,
         hotel_id,
         name,
         google_drive_file_id_front,
         google_drive_file_id_back
       FROM guests
       WHERE id = ?1 AND hotel_id = ?2
       LIMIT 1`
    )
      .bind(guestId, hotelId)
      .first();

    if (!guest) {
      return json({ error: "Guest not found" }, { status: 404 });
    }

    const fileId = side === "front" ? guest.google_drive_file_id_front : guest.google_drive_file_id_back;
    if (!fileId) {
      return json({ error: "Requested proof is not available" }, { status: 404 });
    }

    const { accessToken } = await getHotelDriveAccessToken(hotelId, context.env);
    const driveResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      return json({ error: `Unable to load proof file: ${errorText}` }, { status: 502 });
    }

    await logPoliceAccess(context.env.DB, officerName, guestId, hotelId);

    const headers = new Headers();
    headers.set("cache-control", "no-store");
    headers.set("content-type", driveResponse.headers.get("content-type") || "application/octet-stream");
    headers.set("content-disposition", `inline; filename="${guest.name || guest.id}-${side}"`);

    return new Response(driveResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to load guest proof" },
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
