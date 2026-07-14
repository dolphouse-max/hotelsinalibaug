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

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function requireSuperAdmin(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.SUPER_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.SUPER_ADMIN_TOKEN;
}

function normalizeHotelPayload(payload) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const contact = typeof payload.contact === "string" ? payload.contact.trim() : "";
  const address = typeof payload.address === "string" ? payload.address.trim() : "";
  const subscriptionStartDate =
    typeof payload.subscription_start_date === "string"
      ? payload.subscription_start_date.trim()
      : "";
  const subscriptionEndDate =
    typeof payload.subscription_end_date === "string"
      ? payload.subscription_end_date.trim()
      : "";
  const isActive = payload.is_active === false || payload.is_active === 0 ? 0 : 1;

  if (!name || !contact || !address) {
    throw new Error("name, contact, and address are required");
  }

  if (!isIsoDate(subscriptionStartDate) || !isIsoDate(subscriptionEndDate)) {
    throw new Error("subscription_start_date and subscription_end_date must be YYYY-MM-DD");
  }

  if (subscriptionEndDate < subscriptionStartDate) {
    throw new Error("subscription_end_date must be on or after subscription_start_date");
  }

  return {
    id: typeof payload.id === "string" ? payload.id.trim() : "",
    name,
    contact,
    address,
    totalRooms: Number.isInteger(payload.total_rooms) ? payload.total_rooms : 0,
    occupiedRooms: Number.isInteger(payload.occupied_rooms) ? payload.occupied_rooms : 0,
    subscriptionStartDate,
    subscriptionEndDate,
    isActive,
  };
}

export async function onRequestPost(context) {
  if (!requireSuperAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const hotel = normalizeHotelPayload(payload);

    if (hotel.occupiedRooms > hotel.totalRooms) {
      return badRequest("occupied_rooms cannot exceed total_rooms");
    }

    const result = await context.env.DB.prepare(
      `INSERT INTO hotels (
         name,
         contact,
         address,
         total_rooms,
         occupied_rooms,
         subscription_start_date,
         subscription_end_date,
         is_active
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       RETURNING id, name, contact, address, total_rooms, occupied_rooms, subscription_start_date, subscription_end_date, is_active`
    )
      .bind(
        hotel.name,
        hotel.contact,
        hotel.address,
        hotel.totalRooms,
        hotel.occupiedRooms,
        hotel.subscriptionStartDate,
        hotel.subscriptionEndDate,
        hotel.isActive
      )
      .first();

    return json({ ok: true, hotel: result }, { status: 201 });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to add hotel");
  }
}

export async function onRequestPut(context) {
  if (!requireSuperAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const hotel = normalizeHotelPayload(payload);

    if (!hotel.id) {
      return badRequest("id is required for updates");
    }

    if (hotel.occupiedRooms > hotel.totalRooms) {
      return badRequest("occupied_rooms cannot exceed total_rooms");
    }

    const result = await context.env.DB.prepare(
      `UPDATE hotels
       SET name = ?1,
           contact = ?2,
           address = ?3,
           total_rooms = ?4,
           occupied_rooms = ?5,
           subscription_start_date = ?6,
           subscription_end_date = ?7,
           is_active = ?8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?9
       RETURNING id, name, contact, address, total_rooms, occupied_rooms, subscription_start_date, subscription_end_date, is_active`
    )
      .bind(
        hotel.name,
        hotel.contact,
        hotel.address,
        hotel.totalRooms,
        hotel.occupiedRooms,
        hotel.subscriptionStartDate,
        hotel.subscriptionEndDate,
        hotel.isActive,
        hotel.id
      )
      .first();

    if (!result) {
      return json({ error: "Hotel not found" }, { status: 404 });
    }

    return json({ ok: true, hotel: result });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to update hotel");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, PUT, OPTIONS",
    },
  });
