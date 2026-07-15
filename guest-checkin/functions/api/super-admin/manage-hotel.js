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

function methodNotAllowed() {
  return json({ error: "Method not allowed" }, { status: 405 });
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
}

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function diffInDays(fromDate, toDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((toDate.getTime() - fromDate.getTime()) / msPerDay);
}

function getSubscriptionMeta(subscriptionEndDate, isActive) {
  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endDate = new Date(`${subscriptionEndDate}T00:00:00Z`);
  const daysUntilExpiry = diffInDays(todayDate, endDate);
  const paymentReminderActive = Boolean(isActive) && daysUntilExpiry >= 0 && daysUntilExpiry <= 15;

  return {
    days_until_expiry: daysUntilExpiry,
    payment_reminder_active: paymentReminderActive,
    payment_reminder_message: paymentReminderActive
      ? `Subscription expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}. Payment collection should start now.`
      : null,
  };
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
  const contact =
    typeof payload.contact === "string"
      ? payload.contact.trim()
      : typeof payload.mobile_number === "string"
        ? payload.mobile_number.trim()
        : "";
  const address = typeof payload.address === "string" ? payload.address.trim() : "";
  const gmailId =
    typeof payload.gmail_id === "string"
      ? payload.gmail_id.trim().toLowerCase()
      : typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";
  const isActive = payload.is_active === false || payload.is_active === 0 ? 0 : 1;
  const hotelId =
    typeof payload.hotel_id === "string"
      ? payload.hotel_id.trim()
      : typeof payload.id === "string"
        ? payload.id.trim()
        : "";

  if (!name || !contact || !gmailId || !hotelId) {
    throw new Error("hotel_id, name, mobile_number/contact, and gmail_id are required");
  }

  if (!isSafeHotelId(hotelId)) {
    throw new Error("hotel_id must start with a letter and contain only letters and numbers");
  }

  if (!isEmail(gmailId)) {
    throw new Error("gmail_id must be a valid email address");
  }

  const subscriptionStartDate = typeof payload.subscription_start_date === "string"
    ? payload.subscription_start_date.trim()
    : toDateOnly(new Date());
  const subscriptionEndDate = typeof payload.subscription_end_date === "string"
    ? payload.subscription_end_date.trim()
    : toDateOnly(addMonths(new Date(`${subscriptionStartDate}T00:00:00Z`), 3));

  if (!isIsoDate(subscriptionStartDate) || !isIsoDate(subscriptionEndDate)) {
    throw new Error("subscription_start_date and subscription_end_date must be YYYY-MM-DD");
  }

  if (subscriptionEndDate < subscriptionStartDate) {
    throw new Error("subscription_end_date must be on or after subscription_start_date");
  }

  return {
    id: hotelId,
    name,
    contact,
    address,
    gmailId,
    totalRooms: Number.isInteger(payload.total_rooms) ? payload.total_rooms : 0,
    occupiedRooms: Number.isInteger(payload.occupied_rooms) ? payload.occupied_rooms : 0,
    subscriptionStartDate,
    subscriptionEndDate,
    isActive,
  };
}

function withSubscriptionMeta(hotel) {
  return {
    ...hotel,
    ...getSubscriptionMeta(hotel.subscription_end_date, hotel.is_active),
  };
}

export async function onRequestGet(context) {
  if (!requireSuperAdmin(context.request, context.env)) {
    return unauthorized();
  }

  const results = await context.env.DB.prepare(
    `SELECT
       h.id,
       h.name,
       h.contact,
       h.address,
       h.total_rooms,
       h.occupied_rooms,
       h.subscription_start_date,
       h.subscription_end_date,
       h.is_active,
       h.created_at,
       h.updated_at,
       hs.full_name AS admin_name,
       hs.email AS admin_email,
       hs.phone AS admin_phone
     FROM hotels h
     LEFT JOIN hotel_staff hs
       ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
     ORDER BY h.created_at DESC`
  ).all();

  const hotels = (results.results || []).map(withSubscriptionMeta);
  return json({ ok: true, hotels });
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

    const staffId = crypto.randomUUID().replace(/-/g, "");

    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO hotels (
           id,
           name,
           contact,
           address,
           total_rooms,
           occupied_rooms,
           subscription_start_date,
           subscription_end_date,
           is_active
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
      ).bind(
        hotel.id,
        hotel.name,
        hotel.contact,
        hotel.address,
        hotel.totalRooms,
        hotel.occupiedRooms,
        hotel.subscriptionStartDate,
        hotel.subscriptionEndDate,
        hotel.isActive
      ),
      context.env.DB.prepare(
        `INSERT INTO hotel_staff (
           id,
           hotel_id,
           full_name,
           email,
           phone,
           role,
           is_active
         ) VALUES (?1, ?2, ?3, ?4, ?5, 'admin', 1)`
      ).bind(staffId, hotel.id, `${hotel.name} Admin`, hotel.gmailId, hotel.contact),
    ]);

    const result = await context.env.DB.prepare(
      `SELECT
         h.id,
         h.name,
         h.contact,
         h.address,
         h.total_rooms,
         h.occupied_rooms,
         h.subscription_start_date,
         h.subscription_end_date,
         h.is_active,
         hs.full_name AS admin_name,
         hs.email AS admin_email,
         hs.phone AS admin_phone
       FROM hotels h
       LEFT JOIN hotel_staff hs
         ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
       WHERE h.id = ?1
       LIMIT 1`
    )
      .bind(hotel.id)
      .first();

    return json({ ok: true, hotel: withSubscriptionMeta(result) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add hotel";
    const status = message.includes("UNIQUE constraint failed") ? 409 : 400;
    return json({ error: message }, { status });
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

    if (hotel.gmailId) {
      await context.env.DB.prepare(
        `UPDATE hotel_staff
         SET email = ?1,
             phone = ?2,
             updated_at = CURRENT_TIMESTAMP
         WHERE hotel_id = ?3 AND role = 'admin'`
      )
        .bind(hotel.gmailId, hotel.contact, hotel.id)
        .run();
    }

    const hydrated = await context.env.DB.prepare(
      `SELECT
         h.id,
         h.name,
         h.contact,
         h.address,
         h.total_rooms,
         h.occupied_rooms,
         h.subscription_start_date,
         h.subscription_end_date,
         h.is_active,
         hs.full_name AS admin_name,
         hs.email AS admin_email,
         hs.phone AS admin_phone
       FROM hotels h
       LEFT JOIN hotel_staff hs
         ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
       WHERE h.id = ?1
       LIMIT 1`
    )
      .bind(hotel.id)
      .first();

    return json({ ok: true, hotel: withSubscriptionMeta(hydrated) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to update hotel");
  }
}

export const onRequest = () => methodNotAllowed();

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, PUT, OPTIONS",
    },
  });
