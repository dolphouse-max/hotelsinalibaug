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

function requireHotelAdmin(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.HOTEL_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.HOTEL_ADMIN_TOKEN;
}

export async function onRequestPut(context) {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const contact = typeof payload.contact === "string" ? payload.contact.trim() : "";
    const address = typeof payload.address === "string" ? payload.address.trim() : "";
    const totalRooms = Number.isInteger(payload.total_rooms) ? payload.total_rooms : 0;
    const occupiedRooms = Number.isInteger(payload.occupied_rooms) ? payload.occupied_rooms : 0;

    if (!isSafeId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    if (!name || !contact || !address) {
      return badRequest("name, contact, and address are required");
    }

    if (totalRooms < 0 || occupiedRooms < 0 || occupiedRooms > totalRooms) {
      return badRequest("room metrics are invalid");
    }

    const result = await context.env.DB.prepare(
      `UPDATE hotels
       SET name = ?1,
           contact = ?2,
           address = ?3,
           total_rooms = ?4,
           occupied_rooms = ?5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?6
       RETURNING id, name, contact, address, total_rooms, occupied_rooms, subscription_start_date, subscription_end_date, is_active`
    )
      .bind(name, contact, address, totalRooms, occupiedRooms, hotelId)
      .first();

    if (!result) {
      return json({ error: "Hotel not found" }, { status: 404 });
    }

    return json({ ok: true, hotel: result });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to update hotel profile");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "PUT, OPTIONS",
    },
  });
