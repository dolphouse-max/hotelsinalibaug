import { requireHotelAdminSession } from "../../_lib/auth";
import { badRequest, json, unauthorized } from "../../_lib/api";

function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
}

async function getHotelNotifications(db, hotelId) {
  const rows = await db.prepare(
    `SELECT
       n.id,
       n.title,
       n.message,
       n.notification_type,
       n.audience_type,
       n.target_hotel_id,
       n.action_url,
       n.created_by,
       n.created_at,
       CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END AS is_seen
     FROM app_notifications n
     INNER JOIN hotels h ON h.id = ?1
     LEFT JOIN hotel_notification_reads r
       ON r.notification_id = n.id
      AND r.hotel_id = h.id
     WHERE
       n.audience_type = 'all_hotels'
       OR (n.audience_type = 'active_hotels' AND h.is_active = 1)
       OR (
         n.audience_type = 'expiring_15_days'
         AND h.is_active = 1
         AND h.subscription_end_date >= date('now')
         AND h.subscription_end_date <= date('now', '+15 day')
       )
       OR (n.audience_type = 'specific_hotel' AND n.target_hotel_id = h.id)
     ORDER BY n.created_at DESC
     LIMIT 40`
  )
    .bind(hotelId)
    .all();

  return rows.results || [];
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const hotelId = url.searchParams.get("hotel_id")?.trim() || "";

  if (!isSafeHotelId(hotelId)) {
    return badRequest("Valid hotel_id is required");
  }

  if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
    return unauthorized();
  }

  const notifications = await getHotelNotifications(context.env.DB, hotelId);
  const unseenCount = notifications.filter((row) => Number(row.is_seen) !== 1).length;

  return json({
    ok: true,
    summary: {
      total: notifications.length,
      unseen: unseenCount,
    },
    notifications,
  });
}

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();
    const action = typeof payload.action === "string" ? payload.action.trim() : "";
    const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";

    if (!isSafeHotelId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    if (action === "mark_seen") {
      const notificationId = typeof payload.notification_id === "string" ? payload.notification_id.trim() : "";

      if (!/^[a-z0-9]{16,64}$/i.test(notificationId)) {
        return badRequest("Valid notification_id is required");
      }

      await context.env.DB.prepare(
        `INSERT INTO hotel_notification_reads (notification_id, hotel_id)
         VALUES (?1, ?2)
         ON CONFLICT(notification_id, hotel_id) DO NOTHING`
      )
        .bind(notificationId, hotelId)
        .run();

      return json({ ok: true });
    }

    if (action === "mark_many_seen") {
      const ids = Array.isArray(payload.notification_ids) ? payload.notification_ids : [];
      const sanitizedIds = ids
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => /^[a-z0-9]{16,64}$/i.test(value));

      if (!sanitizedIds.length) {
        return badRequest("notification_ids are required");
      }

      await context.env.DB.batch(
        sanitizedIds.map((notificationId) =>
          context.env.DB.prepare(
            `INSERT INTO hotel_notification_reads (notification_id, hotel_id)
             VALUES (?1, ?2)
             ON CONFLICT(notification_id, hotel_id) DO NOTHING`
          ).bind(notificationId, hotelId)
        )
      );

      return json({ ok: true, marked: sanitizedIds.length });
    }

    return badRequest("action must be mark_seen or mark_many_seen");
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to update notifications");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, OPTIONS",
    },
  });
