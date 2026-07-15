import { badRequest, json, unauthorized } from "../../_lib/api";
import {
  computeRenewalDates,
  databaseErrorMessage,
  getHotelSubscriptionSnapshot,
} from "../../_lib/subscription-ledger";

function requireHotelAdmin(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.HOTEL_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.HOTEL_ADMIN_TOKEN;
}

function isSafeId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/i.test(value.trim());
}

async function loadSubscriptionData(db, hotelId) {
  const snapshot = await getHotelSubscriptionSnapshot(db, hotelId);
  const requestsResult = await db.prepare(
    `SELECT id, hotel_id, requested_months, requested_end_date, note, status, resolved_note, created_at, resolved_at
     FROM hotel_renewal_requests
     WHERE hotel_id = ?1
     ORDER BY created_at DESC
     LIMIT 10`
  )
    .bind(hotelId)
    .all();

  const paymentsResult = await db.prepare(
    `SELECT id, hotel_id, renewal_request_id, amount_paid, currency_code, plan_months, payment_method,
            payment_reference, payment_date, period_start_date, period_end_date, note, recorded_at
     FROM hotel_subscription_payments
     WHERE hotel_id = ?1
     ORDER BY payment_date DESC, recorded_at DESC
     LIMIT 10`
  )
    .bind(hotelId)
    .all();

  return {
    ok: true,
    hotel: snapshot.hotel,
    summary: {
      pending_renewal_requests: snapshot.pendingRenewalRequests,
      last_payment: snapshot.lastPayment,
    },
    requests: requestsResult.results || [],
    payments: paymentsResult.results || [],
  };
}

export async function onRequestGet(context) {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const url = new URL(context.request.url);
    const hotelId = url.searchParams.get("hotel_id")?.trim() || "";

    if (!isSafeId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    return json(await loadSubscriptionData(context.env.DB, hotelId));
  } catch (error) {
    return json(
      { error: databaseErrorMessage(error, "Unable to load subscription data") },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";
    const requestedMonths = Number(payload.requested_months);
    const note = typeof payload.note === "string" ? payload.note.trim() : "";

    if (!isSafeId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    if (!Number.isInteger(requestedMonths) || requestedMonths < 1 || requestedMonths > 24) {
      return badRequest("requested_months must be between 1 and 24");
    }

    const snapshot = await getHotelSubscriptionSnapshot(context.env.DB, hotelId);
    const preview = computeRenewalDates(snapshot.hotel.subscription_end_date, requestedMonths);
    const requestId = crypto.randomUUID().replace(/-/g, "");

    const request = await context.env.DB.prepare(
      `INSERT INTO hotel_renewal_requests (
         id,
         hotel_id,
         requested_months,
         requested_end_date,
         note,
         status
       ) VALUES (?1, ?2, ?3, ?4, ?5, 'pending')
       RETURNING id, hotel_id, requested_months, requested_end_date, note, status, resolved_note, created_at, resolved_at`
    )
      .bind(requestId, hotelId, requestedMonths, preview.newSubscriptionEndDate, note || null)
      .first();

    return json({
      ok: true,
      request,
      summary: {
        projected_subscription_end_date: preview.newSubscriptionEndDate,
      },
    }, { status: 201 });
  } catch (error) {
    return json(
      { error: databaseErrorMessage(error, "Unable to create renewal request") },
      { status: 500 }
    );
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, OPTIONS",
    },
  });
