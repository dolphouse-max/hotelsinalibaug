import { badRequest, json, unauthorized } from "../../_lib/api";
import { sendPushToSubscription } from "../../_lib/push";

function requireSuperAdmin(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.SUPER_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.SUPER_ADMIN_TOKEN;
}

function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
}

function normalizePayload(payload) {
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  const notificationType = typeof payload.notification_type === "string" ? payload.notification_type.trim() : "general";
  const audienceType = typeof payload.audience_type === "string" ? payload.audience_type.trim() : "active_hotels";
  const targetHotelId = typeof payload.target_hotel_id === "string" ? payload.target_hotel_id.trim() : "";
  const actionUrl = typeof payload.action_url === "string" ? payload.action_url.trim() : "";
  const createdBy = typeof payload.created_by === "string" ? payload.created_by.trim() : "";

  if (!title || !message || !createdBy) {
    throw new Error("title, message, and created_by are required");
  }

  if (!["general", "reminder", "greeting"].includes(notificationType)) {
    throw new Error("notification_type must be general, reminder, or greeting");
  }

  if (!["all_hotels", "active_hotels", "expiring_15_days", "specific_hotel"].includes(audienceType)) {
    throw new Error("audience_type is invalid");
  }

  if (audienceType === "specific_hotel" && !isSafeHotelId(targetHotelId)) {
    throw new Error("target_hotel_id is required for specific_hotel notifications");
  }

  if (actionUrl && !actionUrl.startsWith("/")) {
    throw new Error("action_url must start with /");
  }

  return {
    title,
    message,
    notificationType,
    audienceType,
    targetHotelId: audienceType === "specific_hotel" ? targetHotelId : null,
    actionUrl: actionUrl || null,
    createdBy,
  };
}

export async function onRequestGet(context) {
  if (!requireSuperAdmin(context.request, context.env)) {
    return unauthorized();
  }

  const results = await context.env.DB.prepare(
    `SELECT
       n.id,
       n.title,
       n.message,
       n.notification_type,
       n.audience_type,
       n.target_hotel_id,
       h.name AS target_hotel_name,
       n.action_url,
       n.created_by,
       n.created_at
     FROM app_notifications n
     LEFT JOIN hotels h ON h.id = n.target_hotel_id
     ORDER BY n.created_at DESC
     LIMIT 60`
  ).all();

  return json({ ok: true, notifications: results.results || [] });
}

export async function onRequestPost(context) {
  if (!requireSuperAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = normalizePayload(await context.request.json());
    const id = crypto.randomUUID().replace(/-/g, "");

    await context.env.DB.prepare(
      `INSERT INTO app_notifications (
         id,
         title,
         message,
         notification_type,
         audience_type,
         target_hotel_id,
         action_url,
         created_by
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
      .bind(
        id,
        payload.title,
        payload.message,
        payload.notificationType,
        payload.audienceType,
        payload.targetHotelId,
        payload.actionUrl,
        payload.createdBy
      )
      .run();

    const notification = await context.env.DB.prepare(
      `SELECT
         n.id,
         n.title,
         n.message,
         n.notification_type,
         n.audience_type,
         n.target_hotel_id,
         h.name AS target_hotel_name,
         n.action_url,
         n.created_by,
         n.created_at
       FROM app_notifications n
       LEFT JOIN hotels h ON h.id = n.target_hotel_id
       WHERE n.id = ?1
       LIMIT 1`
    )
      .bind(id)
      .first();

    const targetSubscriptionsResult = await context.env.DB.prepare(
      `SELECT DISTINCT
         ps.endpoint,
         ps.p256dh,
         ps.auth
       FROM push_subscriptions ps
       INNER JOIN hotels h ON h.id = ps.hotel_id
       WHERE
         ?1 = 'all_hotels'
         OR (?1 = 'active_hotels' AND h.is_active = 1)
         OR (
           ?1 = 'expiring_15_days'
           AND h.is_active = 1
           AND h.subscription_end_date >= date('now')
           AND h.subscription_end_date <= date('now', '+15 day')
         )
         OR (?1 = 'specific_hotel' AND h.id = ?2)`
    )
      .bind(payload.audienceType, payload.targetHotelId)
      .all();

    const pushPayload = {
      title: payload.title,
      message: payload.message,
      action_url: payload.actionUrl || "/hotel-admin-home.html",
      notification_id: id,
    };

    for (const subscription of targetSubscriptionsResult.results || []) {
      try {
        await sendPushToSubscription(context.env, subscription, pushPayload);
      } catch (error) {
        const statusCode = Number(error?.statusCode || error?.status || 0);
        if (statusCode === 404 || statusCode === 410) {
          await context.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?1`)
            .bind(subscription.endpoint)
            .run();
        } else {
          console.error("Failed to send push notification", error);
        }
      }
    }

    return json({ ok: true, notification }, { status: 201 });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to create notification");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, OPTIONS",
    },
  });
