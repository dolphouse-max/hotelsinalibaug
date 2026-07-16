import { sendPushToSubscription } from "./push";

const REMINDER_DAYS = [15, 7, 3, 1];

export async function runSubscriptionReminderCycle(env, createdBy = "System Reminder") {
  const hotelsResult = await env.DB.prepare(
    `SELECT
       h.id,
       h.name,
       h.subscription_end_date
     FROM hotels h
     WHERE h.is_active = 1
       AND h.subscription_end_date IN (
         date('now', '+15 day'),
         date('now', '+7 day'),
         date('now', '+3 day'),
         date('now', '+1 day')
       )`
  ).all();

  const hotels = hotelsResult.results || [];
  const sent = [];
  const skipped = [];

  for (const hotel of hotels) {
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const endDate = new Date(`${hotel.subscription_end_date}T00:00:00Z`);
    const reminderDay = Math.ceil((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    if (!REMINDER_DAYS.includes(reminderDay)) {
      continue;
    }

    const existing = await env.DB.prepare(
      `SELECT hotel_id
       FROM subscription_reminder_deliveries
       WHERE hotel_id = ?1
         AND reminder_day = ?2
         AND subscription_end_date = ?3
       LIMIT 1`
    )
      .bind(hotel.id, reminderDay, hotel.subscription_end_date)
      .first();

    if (existing) {
      skipped.push({
        hotel_id: hotel.id,
        hotel_name: hotel.name,
        reason: `Reminder for ${reminderDay} day window already sent.`,
      });
      continue;
    }

    const title = reminderDay === 1
      ? "Subscription expires tomorrow"
      : `Subscription expires in ${reminderDay} days`;
    const message = `${hotel.name}: your subscription ends on ${hotel.subscription_end_date}. Please renew to keep the hotel account active.`;
    const notificationId = crypto.randomUUID().replace(/-/g, "");

    await env.DB.prepare(
      `INSERT INTO app_notifications (
         id,
         title,
         message,
         notification_type,
         audience_type,
         target_hotel_id,
         action_url,
         created_by
       ) VALUES (?1, ?2, ?3, 'reminder', 'specific_hotel', ?4, '/hotel-admin-renewal.html', ?5)`
    )
      .bind(notificationId, title, message, hotel.id, createdBy)
      .run();

    await env.DB.prepare(
      `INSERT INTO subscription_reminder_deliveries (
         hotel_id,
         reminder_day,
         subscription_end_date,
         notification_id
       ) VALUES (?1, ?2, ?3, ?4)`
    )
      .bind(hotel.id, reminderDay, hotel.subscription_end_date, notificationId)
      .run();

    const subscriptions = await env.DB.prepare(
      `SELECT endpoint, p256dh, auth
       FROM push_subscriptions
       WHERE hotel_id = ?1`
    )
      .bind(hotel.id)
      .all();

    let deliveredPushCount = 0;
    for (const subscription of subscriptions.results || []) {
      try {
        await sendPushToSubscription(env, subscription, {
          title,
          message,
          action_url: "/hotel-admin-renewal.html",
          notification_id: notificationId,
        });
        deliveredPushCount += 1;
      } catch (error) {
        const statusCode = Number(error?.statusCode || error?.status || 0);
        if (statusCode === 404 || statusCode === 410) {
          await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?1`)
            .bind(subscription.endpoint)
            .run();
        } else {
          console.error("Failed to send scheduled push reminder", error);
        }
      }
    }

    sent.push({
      hotel_id: hotel.id,
      hotel_name: hotel.name,
      reminder_day: reminderDay,
      subscription_end_date: hotel.subscription_end_date,
      push_deliveries: deliveredPushCount,
    });
  }

  return {
    ok: true,
    summary: {
      eligible_hotels: hotels.length,
      sent: sent.length,
      skipped: skipped.length,
    },
    sent,
    skipped,
  };
}
