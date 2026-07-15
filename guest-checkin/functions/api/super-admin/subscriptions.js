import { badRequest, json, unauthorized } from "../../_lib/api";
import {
  computeRenewalDates,
  databaseErrorMessage,
  getHotelSubscriptionSnapshot,
  isIsoDate,
  todayUtcDate,
} from "../../_lib/subscription-ledger";

function requireSuperAdmin(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.SUPER_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.SUPER_ADMIN_TOKEN;
}

function isSafeId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/i.test(value.trim());
}

async function listSubscriptions(db, hotelId = "") {
  const requestWhere = hotelId ? "WHERE r.hotel_id = ?1" : "";
  const paymentWhere = hotelId ? "WHERE p.hotel_id = ?1" : "";
  const bindValues = hotelId ? [hotelId] : [];

  const [requestsResult, paymentsResult] = await Promise.all([
    db.prepare(
      `SELECT r.id, r.hotel_id, h.name AS hotel_name, h.subscription_end_date, h.is_active,
              r.requested_months, r.requested_end_date, r.note, r.status, r.resolved_note, r.created_at, r.resolved_at
       FROM hotel_renewal_requests r
       INNER JOIN hotels h ON h.id = r.hotel_id
       ${requestWhere}
       ORDER BY
         CASE r.status WHEN 'pending' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
         r.created_at DESC
       LIMIT 40`
    )
      .bind(...bindValues)
      .all(),
    db.prepare(
      `SELECT p.id, p.hotel_id, h.name AS hotel_name, p.renewal_request_id, p.amount_paid, p.currency_code,
              p.plan_months, p.payment_method, p.payment_reference, p.payment_date, p.period_start_date,
              p.period_end_date, p.note, p.recorded_at
       FROM hotel_subscription_payments p
       INNER JOIN hotels h ON h.id = p.hotel_id
       ${paymentWhere}
       ORDER BY p.payment_date DESC, p.recorded_at DESC
       LIMIT 40`
    )
      .bind(...bindValues)
      .all(),
  ]);

  const pendingCount = (requestsResult.results || []).filter((item) => item.status === "pending").length;

  return {
    ok: true,
    summary: {
      pending_requests: pendingCount,
      recent_payments: (paymentsResult.results || []).length,
    },
    requests: requestsResult.results || [],
    payments: paymentsResult.results || [],
  };
}

export async function onRequestGet(context) {
  if (!requireSuperAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const url = new URL(context.request.url);
    const hotelId = url.searchParams.get("hotel_id")?.trim() || "";

    if (hotelId && !isSafeId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    return json(await listSubscriptions(context.env.DB, hotelId));
  } catch (error) {
    return json(
      { error: databaseErrorMessage(error, "Unable to load subscription queue") },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  if (!requireSuperAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const action = typeof payload.action === "string" ? payload.action.trim() : "";

    if (action === "record_payment") {
      const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";
      const requestId = typeof payload.request_id === "string" ? payload.request_id.trim() : "";
      const amountPaid = Number(payload.amount_paid);
      const planMonths = Number(payload.plan_months);
      const paymentMethod = typeof payload.payment_method === "string" ? payload.payment_method.trim() : "";
      const paymentReference = typeof payload.payment_reference === "string" ? payload.payment_reference.trim() : "";
      const note = typeof payload.note === "string" ? payload.note.trim() : "";
      const paymentDate = typeof payload.payment_date === "string" && payload.payment_date.trim()
        ? payload.payment_date.trim()
        : todayUtcDate();

      if (!isSafeId(hotelId)) {
        return badRequest("Valid hotel_id is required");
      }

      if (requestId && !isSafeId(requestId)) {
        return badRequest("request_id is invalid");
      }

      if (!Number.isFinite(amountPaid) || amountPaid < 0) {
        return badRequest("amount_paid must be a valid positive number");
      }

      if (!Number.isInteger(planMonths) || planMonths < 1 || planMonths > 24) {
        return badRequest("plan_months must be between 1 and 24");
      }

      if (!paymentMethod) {
        return badRequest("payment_method is required");
      }

      if (!isIsoDate(paymentDate)) {
        return badRequest("payment_date must be YYYY-MM-DD");
      }

      const snapshot = await getHotelSubscriptionSnapshot(context.env.DB, hotelId);
      const renewalDates = computeRenewalDates(snapshot.hotel.subscription_end_date, planMonths, paymentDate);
      const paymentId = crypto.randomUUID().replace(/-/g, "");

      const batchStatements = [
        context.env.DB.prepare(
          `INSERT INTO hotel_subscription_payments (
             id,
             hotel_id,
             renewal_request_id,
             amount_paid,
             currency_code,
             plan_months,
             payment_method,
             payment_reference,
             payment_date,
             period_start_date,
             period_end_date,
             note
           ) VALUES (?1, ?2, ?3, ?4, 'INR', ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
        ).bind(
          paymentId,
          hotelId,
          requestId || null,
          amountPaid,
          planMonths,
          paymentMethod,
          paymentReference || null,
          paymentDate,
          renewalDates.periodStartDate,
          renewalDates.periodEndDate,
          note || null
        ),
        context.env.DB.prepare(
          `UPDATE hotels
           SET subscription_end_date = ?1,
               is_active = 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?2`
        ).bind(renewalDates.newSubscriptionEndDate, hotelId),
      ];

      if (requestId) {
        batchStatements.push(
          context.env.DB.prepare(
            `UPDATE hotel_renewal_requests
             SET status = 'completed',
                 resolved_note = ?1,
                 resolved_at = CURRENT_TIMESTAMP
             WHERE id = ?2 AND hotel_id = ?3`
          ).bind(note || `Payment recorded via ${paymentMethod}`, requestId, hotelId)
        );
      }

      await context.env.DB.batch(batchStatements);

      const payment = await context.env.DB.prepare(
        `SELECT id, hotel_id, renewal_request_id, amount_paid, currency_code, plan_months, payment_method,
                payment_reference, payment_date, period_start_date, period_end_date, note, recorded_at
         FROM hotel_subscription_payments
         WHERE id = ?1
         LIMIT 1`
      )
        .bind(paymentId)
        .first();

      const updatedHotel = await context.env.DB.prepare(
        `SELECT id, name, subscription_start_date, subscription_end_date, is_active
         FROM hotels
         WHERE id = ?1
         LIMIT 1`
      )
        .bind(hotelId)
        .first();

      return json({
        ok: true,
        payment,
        hotel: updatedHotel,
      }, { status: 201 });
    }

    if (action === "dismiss_request") {
      const requestId = typeof payload.request_id === "string" ? payload.request_id.trim() : "";
      const resolvedNote = typeof payload.resolved_note === "string" ? payload.resolved_note.trim() : "";

      if (!isSafeId(requestId)) {
        return badRequest("Valid request_id is required");
      }

      const request = await context.env.DB.prepare(
        `UPDATE hotel_renewal_requests
         SET status = 'dismissed',
             resolved_note = ?1,
             resolved_at = CURRENT_TIMESTAMP
         WHERE id = ?2
         RETURNING id, hotel_id, requested_months, status, resolved_note, resolved_at`
      )
        .bind(resolvedNote || "Dismissed by super admin", requestId)
        .first();

      if (!request) {
        return json({ error: "Renewal request not found" }, { status: 404 });
      }

      return json({ ok: true, request });
    }

    return badRequest("action must be record_payment or dismiss_request");
  } catch (error) {
    return json(
      { error: databaseErrorMessage(error, "Unable to update subscription queue") },
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
