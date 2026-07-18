import { requireHotelAdminSession } from "../../_lib/auth";
import { badRequest, json, unauthorized } from "../../_lib/api";
import { getVapidPublicKey } from "../../_lib/push";

function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
}

function normalizeSubscriptionPayload(payload) {
  const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";
  const endpoint = typeof payload.endpoint === "string" ? payload.endpoint.trim() : "";
  const p256dh = typeof payload.p256dh === "string" ? payload.p256dh.trim() : "";
  const auth = typeof payload.auth === "string" ? payload.auth.trim() : "";
  const userAgent = typeof payload.user_agent === "string" ? payload.user_agent.trim() : "";

  if (!isSafeHotelId(hotelId)) {
    throw new Error("Valid hotel_id is required");
  }

  if (!endpoint || !p256dh || !auth) {
    throw new Error("endpoint, p256dh, and auth are required");
  }

  return { hotelId, endpoint, p256dh, auth, userAgent: userAgent || null };
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

  try {
    return json({
      ok: true,
      vapidPublicKey: getVapidPublicKey(context.env),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to load VAPID key" }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const payload = normalizeSubscriptionPayload(await context.request.json());

    if (!(await requireHotelAdminSession(context.request, context.env, payload.hotelId))) {
      return unauthorized();
    }

    await context.env.DB.prepare(
      `INSERT INTO push_subscriptions (
         hotel_id,
         endpoint,
         p256dh,
         auth,
         user_agent,
         updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
       ON CONFLICT(endpoint) DO UPDATE SET
         hotel_id = excluded.hotel_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         updated_at = CURRENT_TIMESTAMP`
    )
      .bind(payload.hotelId, payload.endpoint, payload.p256dh, payload.auth, payload.userAgent)
      .run();

    return json({ ok: true });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to save push subscription");
  }
}

export async function onRequestDelete(context) {
  try {
    const payload = await context.request.json();
    const endpoint = typeof payload.endpoint === "string" ? payload.endpoint.trim() : "";
    const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";

    if (!endpoint) {
      return badRequest("endpoint is required");
    }

    if (!isSafeHotelId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    await context.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?1`)
      .bind(endpoint)
      .run();

    return json({ ok: true });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to delete push subscription");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, DELETE, OPTIONS",
    },
  });
