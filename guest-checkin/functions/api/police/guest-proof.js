import { requirePoliceSession } from "../../_lib/auth";
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

function isSafeFamilyMemberId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/i.test(value.trim());
}

function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
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
  if (!(await requirePoliceSession(context.request, context.env))) {
    return unauthorized();
  }

  try {
    const url = new URL(context.request.url);
    const officerName = url.searchParams.get("officer_name")?.trim() || "";
    const hotelId = url.searchParams.get("hotel_id")?.trim() || "";
    const guestId = url.searchParams.get("guest_id")?.trim() || "";
    const familyMemberId = url.searchParams.get("family_member_id")?.trim() || "";
    const side = url.searchParams.get("side")?.trim() || "";

    if (!officerName) {
      return badRequest("officer_name is required");
    }

    if (!isSafeHotelId(hotelId) || !isSafeGuestId(guestId)) {
      return badRequest("Valid hotel_id and guest_id are required");
    }

    if (familyMemberId && !isSafeFamilyMemberId(familyMemberId)) {
      return badRequest("Valid family_member_id is required");
    }

    if (!["front", "back"].includes(side)) {
      return badRequest("side must be front or back");
    }

    const proofRecord = familyMemberId
      ? await context.env.DB.prepare(
          `SELECT
             g.id AS guest_id,
             g.hotel_id,
             COALESCE(gfm.full_name, g.name) AS display_name,
             gfm.google_drive_file_id_front,
             gfm.google_drive_file_id_back
           FROM guests g
           INNER JOIN guest_family_members gfm
             ON gfm.guest_id = g.id
            AND gfm.hotel_id = g.hotel_id
           WHERE g.id = ?1
             AND g.hotel_id = ?2
             AND gfm.id = ?3
           LIMIT 1`
        )
          .bind(guestId, hotelId, familyMemberId)
          .first()
      : await context.env.DB.prepare(
          `SELECT
             id AS guest_id,
             hotel_id,
             name AS display_name,
             google_drive_file_id_front,
             google_drive_file_id_back
           FROM guests
           WHERE id = ?1 AND hotel_id = ?2
           LIMIT 1`
        )
          .bind(guestId, hotelId)
          .first();

    if (!proofRecord) {
      return json({ error: familyMemberId ? "Family member proof not found" : "Guest not found" }, { status: 404 });
    }

    const fileId = side === "front" ? proofRecord.google_drive_file_id_front : proofRecord.google_drive_file_id_back;
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
    headers.set("content-disposition", `inline; filename="${proofRecord.display_name || proofRecord.guest_id}-${side}"`);

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
