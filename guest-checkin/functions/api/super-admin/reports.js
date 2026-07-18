import { requireSuperAdminSession } from "../../_lib/auth";

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

function formatDateOffset(daysAgo) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function diffInDays(fromDate, toDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((toDate.getTime() - fromDate.getTime()) / msPerDay);
}

function withSubscriptionMeta(hotel) {
  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const endDate = new Date(`${hotel.subscription_end_date}T00:00:00Z`);
  const daysUntilExpiry = diffInDays(todayDate, endDate);
  const paymentReminderActive = Boolean(hotel.is_active) && daysUntilExpiry >= 0 && daysUntilExpiry <= 15;

  return {
    ...hotel,
    days_until_expiry: daysUntilExpiry,
    payment_reminder_active: paymentReminderActive,
    payment_reminder_message: paymentReminderActive
      ? `Subscription expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}.`
      : null,
  };
}

async function countValue(statement) {
  const row = await statement.first();
  return Number(row?.count || 0);
}

export async function onRequestGet(context) {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  const url = new URL(context.request.url);
  const fromDate = url.searchParams.get("from") || formatDateOffset(29);
  const toDate = url.searchParams.get("to") || formatDateOffset(0);

  if (!isIsoDate(fromDate) || !isIsoDate(toDate) || fromDate > toDate) {
    return badRequest("Valid from and to dates are required");
  }

  const today = formatDateOffset(0);

  const [
    hotelsResult,
    totalHotels,
    activeHotels,
    inactiveHotels,
    totalGuestsInRange,
    currentGuests,
    checkoutsToday,
    activeStaff,
    recentCheckinsResult,
    expiringHotelsResult,
    hotelRegisterResult,
    policeLogsResult,
  ] = await Promise.all([
    context.env.DB.prepare(
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
         hs.email AS admin_email,
         hs.phone AS admin_phone
       FROM hotels h
       LEFT JOIN hotel_staff hs
         ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
       ORDER BY h.created_at DESC`
    ).all(),
    countValue(context.env.DB.prepare(`SELECT COUNT(*) AS count FROM hotels`)),
    countValue(context.env.DB.prepare(`SELECT COUNT(*) AS count FROM hotels WHERE is_active = 1`)),
    countValue(context.env.DB.prepare(`SELECT COUNT(*) AS count FROM hotels WHERE is_active = 0`)),
    countValue(
      context.env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM guests
         WHERE substr(check_in_time, 1, 10) BETWEEN ?1 AND ?2`
      ).bind(fromDate, toDate)
    ),
    countValue(
      context.env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM guests
         WHERE check_out_time IS NULL`
      )
    ),
    countValue(
      context.env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM guests
         WHERE substr(check_out_time, 1, 10) = ?1`
      ).bind(today)
    ),
    countValue(
      context.env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM hotel_staff
         WHERE is_active = 1`
      )
    ),
    context.env.DB.prepare(
      `SELECT
         g.id,
         g.name,
         g.room_number,
         g.phone,
         g.check_in_time,
         g.google_drive_file_id_front,
         g.google_drive_file_id_back,
         h.id AS hotel_id,
         h.name AS hotel_name
       FROM guests g
       INNER JOIN hotels h ON h.id = g.hotel_id
       WHERE substr(g.check_in_time, 1, 10) BETWEEN ?1 AND ?2
       ORDER BY g.check_in_time DESC
       LIMIT 100`
    ).bind(fromDate, toDate).all(),
    context.env.DB.prepare(
      `SELECT
         h.id,
         h.name,
         h.contact,
         h.total_rooms,
         h.occupied_rooms,
         h.subscription_end_date,
         h.is_active,
         hs.email AS admin_email
       FROM hotels h
       LEFT JOIN hotel_staff hs
         ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
       ORDER BY h.subscription_end_date ASC
       LIMIT 200`
    ).all(),
    context.env.DB.prepare(
      `SELECT
         h.id,
         h.name,
         h.contact,
         h.total_rooms,
         h.occupied_rooms,
         h.subscription_start_date,
         h.subscription_end_date,
         h.is_active,
         hs.email AS admin_email,
         hs.phone AS admin_phone
       FROM hotels h
       LEFT JOIN hotel_staff hs
         ON hs.hotel_id = h.id AND hs.role = 'admin' AND hs.is_active = 1
       ORDER BY h.created_at DESC
       LIMIT 500`
    ).all(),
    context.env.DB.prepare(
      `SELECT
         p.id,
         p.officer_name,
         p.guest_id,
         p.hotel_id,
         p.accessed_at,
         h.name AS hotel_name,
         g.name AS guest_name
       FROM police_access_logs p
       INNER JOIN hotels h ON h.id = p.hotel_id
       LEFT JOIN guests g ON g.id = p.guest_id
       ORDER BY p.accessed_at DESC
       LIMIT 200`
    ).all(),
  ]);

  const hotels = (hotelsResult.results || []).map(withSubscriptionMeta);
  const expiringHotels = (expiringHotelsResult.results || [])
    .map((hotel) => withSubscriptionMeta(hotel))
    .filter((hotel) => hotel.days_until_expiry <= 30);
  const reminderHotels = expiringHotels.filter((hotel) => hotel.payment_reminder_active);
  const totalOccupiedRooms = hotels.reduce((sum, hotel) => sum + Number(hotel.occupied_rooms || 0), 0);
  const totalRooms = hotels.reduce((sum, hotel) => sum + Number(hotel.total_rooms || 0), 0);

  return json({
    ok: true,
    filters: {
      from: fromDate,
      to: toDate,
      today,
    },
    summary: {
      total_hotels: totalHotels,
      active_hotels: activeHotels,
      inactive_hotels: inactiveHotels,
      hotels_in_reminder_window: reminderHotels.length,
      hotels_expiring_in_30_days: expiringHotels.length,
      guest_checkins_in_range: totalGuestsInRange,
      current_in_house_guests: currentGuests,
      checkouts_today: checkoutsToday,
      active_staff: activeStaff,
      occupied_rooms: totalOccupiedRooms,
      total_rooms: totalRooms,
    },
    reports: {
      hotels,
      expiring_hotels: expiringHotels,
      recent_guest_checkins: recentCheckinsResult.results || [],
      hotel_register: hotelRegisterResult.results || [],
      police_access_logs: policeLogsResult.results || [],
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
