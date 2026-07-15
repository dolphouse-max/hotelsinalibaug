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

function requireHotelAdmin(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.HOTEL_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.HOTEL_ADMIN_TOKEN;
}

function formatDateOffset(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function getSubscriptionMeta(subscriptionEndDate, isActive) {
  if (!isIsoDate(subscriptionEndDate)) {
    return {
      days_until_expiry: null,
      payment_reminder_active: false,
      payment_reminder_message: null,
    };
  }

  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endDate = new Date(`${subscriptionEndDate}T00:00:00Z`);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilExpiry = Math.ceil((endDate.getTime() - todayDate.getTime()) / msPerDay);
  const reminderActive = Boolean(isActive) && daysUntilExpiry >= 0 && daysUntilExpiry <= 15;

  return {
    days_until_expiry: daysUntilExpiry,
    payment_reminder_active: reminderActive,
    payment_reminder_message: reminderActive
      ? `Your free trial ends in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}. Please complete your subscription payment.`
      : null,
  };
}

async function countValue(statement) {
  const row = await statement.first();
  return Number(row?.count || 0);
}

export async function onRequestGet(context) {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  const url = new URL(context.request.url);
  const hotelId = url.searchParams.get("hotel_id");
  const fromDate = url.searchParams.get("from") || formatDateOffset(29);
  const toDate = url.searchParams.get("to") || formatDateOffset(0);

  if (!isSafeId(hotelId)) {
    return badRequest("Valid hotel_id is required");
  }

  if (!isIsoDate(fromDate) || !isIsoDate(toDate) || fromDate > toDate) {
    return badRequest("Valid from and to dates are required");
  }

  const hotel = await context.env.DB.prepare(
    `SELECT id, name, total_rooms, occupied_rooms, subscription_start_date, subscription_end_date, is_active
     FROM hotels
     WHERE id = ?1
     LIMIT 1`
  )
    .bind(hotelId.trim())
    .first();

  if (!hotel) {
    return json({ error: "Hotel not found" }, { status: 404 });
  }

  const today = formatDateOffset(0);

  const [
    totalCheckins,
    currentGuestsCount,
    checkoutsTodayCount,
    activeStaffCount,
    todayCheckinsResult,
    currentGuestsResult,
    checkoutsTodayResult,
    registerResult,
    staffResult,
  ] = await Promise.all([
    countValue(
      context.env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM guests
         WHERE hotel_id = ?1
           AND substr(check_in_time, 1, 10) BETWEEN ?2 AND ?3`
      ).bind(hotel.id, fromDate, toDate)
    ),
    countValue(
      context.env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM guests
         WHERE hotel_id = ?1
           AND check_out_time IS NULL`
      ).bind(hotel.id)
    ),
    countValue(
      context.env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM guests
         WHERE hotel_id = ?1
           AND substr(check_out_time, 1, 10) = ?2`
      ).bind(hotel.id, today)
    ),
    countValue(
      context.env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM hotel_staff
         WHERE hotel_id = ?1
           AND is_active = 1`
      ).bind(hotel.id)
    ),
    context.env.DB.prepare(
      `SELECT id, name, room_number, total_guests, phone, check_in_time
       FROM guests
       WHERE hotel_id = ?1
         AND substr(check_in_time, 1, 10) = ?2
       ORDER BY check_in_time DESC
       LIMIT 50`
    ).bind(hotel.id, today).all(),
    context.env.DB.prepare(
      `SELECT id, name, room_number, total_guests, phone, check_in_time, expected_check_out_date
       FROM guests
       WHERE hotel_id = ?1
         AND check_out_time IS NULL
       ORDER BY check_in_time DESC
       LIMIT 100`
    ).bind(hotel.id).all(),
    context.env.DB.prepare(
      `SELECT id, name, room_number, phone, check_in_time, check_out_time
       FROM guests
       WHERE hotel_id = ?1
         AND substr(check_out_time, 1, 10) = ?2
       ORDER BY check_out_time DESC
       LIMIT 50`
    ).bind(hotel.id, today).all(),
    context.env.DB.prepare(
      `SELECT id, name, room_number, phone, id_type, id_number, check_in_time, check_out_time
       FROM guests
       WHERE hotel_id = ?1
         AND substr(check_in_time, 1, 10) BETWEEN ?2 AND ?3
       ORDER BY check_in_time DESC
       LIMIT 200`
    ).bind(hotel.id, fromDate, toDate).all(),
    context.env.DB.prepare(
      `SELECT id, full_name, role, phone, is_active, working_since_month, working_since_year
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
    ).bind(hotel.id).all(),
  ]);

  return json({
    ok: true,
    filters: {
      hotel_id: hotel.id,
      from: fromDate,
      to: toDate,
      today,
    },
    hotel: {
      ...hotel,
      ...getSubscriptionMeta(hotel.subscription_end_date, hotel.is_active),
    },
    summary: {
      total_checkins_in_range: totalCheckins,
      current_in_house_guests: currentGuestsCount,
      checkouts_today: checkoutsTodayCount,
      active_staff: activeStaffCount,
      occupied_rooms: Number(hotel.occupied_rooms || 0),
      total_rooms: Number(hotel.total_rooms || 0),
    },
    reports: {
      todays_checkins: todayCheckinsResult.results || [],
      current_guests: currentGuestsResult.results || [],
      checkouts_today: checkoutsTodayResult.results || [],
      guest_register: registerResult.results || [],
      staff: staffResult.results || [],
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
