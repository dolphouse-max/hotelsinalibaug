import { requireSuperAdminSession } from "../../_lib/auth";
import { badRequest, json, unauthorized } from "../../_lib/api";
import { purgeExpiredHotelMessages } from "../../_lib/hotel-messages";

function isSafeRowId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/i.test(value.trim());
}

export async function onRequestGet(context) {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  await purgeExpiredHotelMessages(context.env.DB);

  const url = new URL(context.request.url);
  const threadId = url.searchParams.get("thread_id")?.trim() || "";
  const hotelQuery = (url.searchParams.get("hotel_q") || "").trim().toLowerCase();

  const threadsResult = await context.env.DB.prepare(
    `SELECT
       t.id,
       t.last_message_at,
       t.created_at,
       ha.id AS hotel_a_id,
       ha.name AS hotel_a_name,
       hb.id AS hotel_b_id,
       hb.name AS hotel_b_name,
       latest.message_text AS latest_message_text,
       latest.sender_hotel_id AS latest_sender_hotel_id,
       latest.created_at AS latest_message_created_at
     FROM hotel_message_threads t
     INNER JOIN hotels ha ON ha.id = t.hotel_a_id
     INNER JOIN hotels hb ON hb.id = t.hotel_b_id
     LEFT JOIN hotel_messages latest
       ON latest.id = (
         SELECT m2.id
         FROM hotel_messages m2
         WHERE m2.thread_id = t.id
         ORDER BY m2.created_at DESC, m2.id DESC
        LIMIT 1
       )
     WHERE latest.created_at >= datetime('now', '-1 day')
     ORDER BY t.last_message_at DESC, t.id DESC`
  ).all();

  let threads = threadsResult.results || [];
  if (hotelQuery) {
    threads = threads.filter((thread) =>
      [thread.hotel_a_id, thread.hotel_a_name, thread.hotel_b_id, thread.hotel_b_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(hotelQuery))
    );
  }

  let messages = [];
  if (threadId) {
    if (!isSafeRowId(threadId)) {
      return badRequest("Valid thread_id is required");
    }

    const messagesResult = await context.env.DB.prepare(
      `SELECT
         m.id,
         m.thread_id,
         m.sender_hotel_id,
         sender.name AS sender_hotel_name,
         m.message_text,
         m.created_at
       FROM hotel_messages m
       INNER JOIN hotels sender ON sender.id = m.sender_hotel_id
       WHERE m.thread_id = ?1
         AND m.created_at >= datetime('now', '-1 day')
       ORDER BY m.created_at ASC, m.id ASC`
    )
      .bind(threadId)
      .all();

    messages = messagesResult.results || [];
  }

  return json({
    ok: true,
    threads,
    messages,
  });
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
