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

function requireSuperAdmin(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.SUPER_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.SUPER_ADMIN_TOKEN;
}

export async function onRequestGet(context) {
  if (!requireSuperAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const url = new URL(context.request.url);
    const hotelId = url.searchParams.get("hotel_id")?.trim() || "";
    const guestId = url.searchParams.get("guest_id")?.trim() || "";
    const side = url.searchParams.get("side")?.trim() || "";
    const viewerName = url.searchParams.get("viewer_name")?.trim() || "";
    const reason = url.searchParams.get("reason")?.trim() || "";

    if (!isSafeHotelId(hotelId) || !isSafeGuestId(guestId)) {
      return badRequest("Valid hotel_id and guest_id are required");
    }

    if (!["front", "back"].includes(side)) {
      return badRequest("side must be front or back");
    }

    if (!viewerName) {
      return badRequest("viewer_name is required");
    }

    if (!reason) {
      return badRequest("reason is required");
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

    await context.env.DB.prepare(
      `INSERT INTO super_admin_proof_access_logs (
         viewer_name,
         access_reason,
         hotel_id,
         guest_id,
         document_side
       ) VALUES (?1, ?2, ?3, ?4, ?5)`
    )
      .bind(viewerName, reason, hotelId, guestId, side)
      .run();

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
