export function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyToUtc(value) {
  return new Date(`${value}T00:00:00Z`);
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export function databaseErrorMessage(error, fallbackMessage) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (/no such table|no such column/i.test(message)) {
    return "Database schema is out of date. Re-run the latest guest-checkin/schema.sql on D1.";
  }

  return message;
}

export function computeRenewalDates(subscriptionEndDate, planMonths, paymentDate = todayUtcDate()) {
  if (!isIsoDate(subscriptionEndDate) || !isIsoDate(paymentDate)) {
    throw new Error("Subscription dates must be YYYY-MM-DD");
  }

  const currentEnd = dateOnlyToUtc(subscriptionEndDate);
  const payment = dateOnlyToUtc(paymentDate);
  const anchor = currentEnd >= payment ? currentEnd : payment;
  const periodStart = currentEnd >= payment ? addDays(currentEnd, 1) : payment;
  const periodEnd = addMonths(anchor, planMonths);

  return {
    paymentDate,
    periodStartDate: toDateOnly(periodStart),
    periodEndDate: toDateOnly(periodEnd),
    newSubscriptionEndDate: toDateOnly(periodEnd),
  };
}

export async function getHotelSubscriptionSnapshot(db, hotelId) {
  const hotel = await db.prepare(
    `SELECT id, name, is_active, subscription_start_date, subscription_end_date
     FROM hotels
     WHERE id = ?1
     LIMIT 1`
  )
    .bind(hotelId)
    .first();

  if (!hotel) {
    throw new Error("Hotel not found");
  }

  const pendingRequestsResult = await db.prepare(
    `SELECT COUNT(*) AS total
     FROM hotel_renewal_requests
     WHERE hotel_id = ?1 AND status = 'pending'`
  )
    .bind(hotelId)
    .first();

  const lastPayment = await db.prepare(
    `SELECT id, amount_paid, currency_code, plan_months, payment_method, payment_reference,
            payment_date, period_start_date, period_end_date, note, recorded_at
     FROM hotel_subscription_payments
     WHERE hotel_id = ?1
     ORDER BY payment_date DESC, recorded_at DESC
     LIMIT 1`
  )
    .bind(hotelId)
    .first();

  return {
    hotel,
    pendingRenewalRequests: Number(pendingRequestsResult?.total || 0),
    lastPayment: lastPayment || null,
  };
}
