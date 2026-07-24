import { requireHotelAdminSession } from "../../_lib/auth";
import { badRequest, json, unauthorized } from "../../_lib/api";
import { purgeExpiredHotelMessages } from "../../_lib/hotel-messages";

function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
}

function isSafeRowId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/i.test(value.trim());
}

function normalizeThreadPair(hotelIdA, hotelIdB) {
  return [hotelIdA, hotelIdB].sort((left, right) => left.localeCompare(right));
}

async function loadDirectory(db, hotelId) {
  const result = await db.prepare(
    `SELECT id, name, contact
     FROM hotels
     WHERE id <> ?1
       AND is_active = 1
     ORDER BY name ASC
     LIMIT 500`
  )
    .bind(hotelId)
    .all();

  return result.results || [];
}

async function loadHotel(db, hotelId) {
  return db.prepare(
    `SELECT id, name
     FROM hotels
     WHERE id = ?1 AND is_active = 1
     LIMIT 1`
  ).bind(hotelId).first();
}

async function loadThreads(db, hotelId) {
  const result = await db.prepare(
    `SELECT
       t.id,
       t.hotel_a_id,
       t.hotel_b_id,
       t.last_message_at,
       t.created_at,
       other.id AS other_hotel_id,
       other.name AS other_hotel_name,
       other.contact AS other_hotel_contact,
       latest.id AS latest_message_id,
       latest.message_text AS latest_message_text,
       latest.sender_hotel_id AS latest_sender_hotel_id,
       latest.created_at AS latest_message_created_at,
       (
         SELECT COUNT(*)
         FROM hotel_messages m
         LEFT JOIN hotel_message_reads r
           ON r.message_id = m.id
          AND r.hotel_id = ?1
         WHERE m.thread_id = t.id
           AND m.sender_hotel_id <> ?1
           AND r.message_id IS NULL
       ) AS unread_count
     FROM hotel_message_threads t
     INNER JOIN hotels other
       ON other.id = CASE
         WHEN t.hotel_a_id = ?1 THEN t.hotel_b_id
         ELSE t.hotel_a_id
       END
     LEFT JOIN hotel_messages latest
       ON latest.id = (
         SELECT m2.id
         FROM hotel_messages m2
         WHERE m2.thread_id = t.id
         ORDER BY m2.created_at DESC, m2.id DESC
         LIMIT 1
       )
     WHERE t.hotel_a_id = ?1 OR t.hotel_b_id = ?1
       AND latest.created_at >= datetime('now', '-1 day')
     ORDER BY t.last_message_at DESC, t.id DESC`
  )
    .bind(hotelId)
    .all();

  return result.results || [];
}

async function loadThreadMessages(db, hotelId, threadId) {
  const thread = await db.prepare(
    `SELECT id, hotel_a_id, hotel_b_id
     FROM hotel_message_threads
     WHERE id = ?1
       AND (hotel_a_id = ?2 OR hotel_b_id = ?2)
     LIMIT 1`
  )
    .bind(threadId, hotelId)
    .first();

  if (!thread) {
    throw new Error("Thread not found");
  }

  const messagesResult = await db.prepare(
    `SELECT
       m.id,
       m.thread_id,
       m.sender_hotel_id,
       sender.name AS sender_hotel_name,
       m.message_text,
       m.created_at,
       CASE WHEN r.message_id IS NULL THEN 0 ELSE 1 END AS is_seen_by_me
     FROM hotel_messages m
     INNER JOIN hotels sender ON sender.id = m.sender_hotel_id
     LEFT JOIN hotel_message_reads r
       ON r.message_id = m.id
      AND r.hotel_id = ?2
     WHERE m.thread_id = ?1
       AND m.created_at >= datetime('now', '-1 day')
     ORDER BY m.created_at ASC, m.id ASC`
  )
    .bind(threadId, hotelId)
    .all();

  return {
    thread,
    messages: messagesResult.results || [],
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const hotelId = url.searchParams.get("hotel_id")?.trim() || "";
  const threadId = url.searchParams.get("thread_id")?.trim() || "";

  if (!isSafeHotelId(hotelId)) {
    return badRequest("Valid hotel_id is required");
  }

  if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
    return unauthorized();
  }

  try {
    await purgeExpiredHotelMessages(context.env.DB);

    const [directory, threads, hotel] = await Promise.all([
      loadDirectory(context.env.DB, hotelId),
      loadThreads(context.env.DB, hotelId),
      loadHotel(context.env.DB, hotelId),
    ]);

    let threadDetails = null;
    if (threadId) {
      if (!isSafeRowId(threadId)) {
        return badRequest("Valid thread_id is required");
      }
      threadDetails = await loadThreadMessages(context.env.DB, hotelId, threadId);
    }

    return json({
      ok: true,
      directory,
      threads,
      hotel: hotel || null,
      thread: threadDetails?.thread || null,
      messages: threadDetails?.messages || [],
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to load messages");
  }
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

    if (action === "send_room_request") {
      await purgeExpiredHotelMessages(context.env.DB);

      const roomType = typeof payload.room_type === "string" ? payload.room_type.trim() : "";
      const peopleCount = Number(payload.people_count);
      if (!["room", "family_room"].includes(roomType)) {
        return badRequest("Valid room_type is required");
      }
      if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 99) {
        return badRequest("people_count must be between 1 and 99");
      }

      const recipients = await loadDirectory(context.env.DB, hotelId);
      const messageText = `ROOM_REQUEST|${roomType}|${peopleCount}`;
      let sentCount = 0;
      for (const recipient of recipients) {
        const [hotelAId, hotelBId] = normalizeThreadPair(hotelId, recipient.id);
        let thread = await context.env.DB.prepare(
          `SELECT id FROM hotel_message_threads WHERE hotel_a_id = ?1 AND hotel_b_id = ?2 LIMIT 1`
        ).bind(hotelAId, hotelBId).first();
        if (!thread) {
          const threadId = crypto.randomUUID().replace(/-/g, "");
          await context.env.DB.prepare(
            `INSERT INTO hotel_message_threads (id, hotel_a_id, hotel_b_id) VALUES (?1, ?2, ?3)`
          ).bind(threadId, hotelAId, hotelBId).run();
          thread = { id: threadId };
        }
        const messageId = crypto.randomUUID().replace(/-/g, "");
        await context.env.DB.batch([
          context.env.DB.prepare(
            `INSERT INTO hotel_messages (id, thread_id, sender_hotel_id, message_text) VALUES (?1, ?2, ?3, ?4)`
          ).bind(messageId, thread.id, hotelId, messageText),
          context.env.DB.prepare(
            `INSERT INTO hotel_message_reads (message_id, hotel_id) VALUES (?1, ?2)`
          ).bind(messageId, hotelId),
          context.env.DB.prepare(
            `UPDATE hotel_message_threads SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?1`
          ).bind(thread.id),
        ]);
        sentCount += 1;
      }
      return json({ ok: true, sent_count: sentCount }, { status: 201 });
    }

    if (action === "confirm_room_available") {
      await purgeExpiredHotelMessages(context.env.DB);
      const requestMessageId = typeof payload.request_message_id === "string" ? payload.request_message_id.trim() : "";
      const priceValue = payload.price === "" || payload.price == null ? null : Number(payload.price);
      if (!isSafeRowId(requestMessageId)) return badRequest("Valid request_message_id is required");
      if (priceValue !== null && (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > 10000000)) {
        return badRequest("Price must be a valid amount");
      }
      const requestMessage = await context.env.DB.prepare(
        `SELECT m.id, m.thread_id, m.sender_hotel_id, m.message_text
         FROM hotel_messages m
         INNER JOIN hotel_message_threads t ON t.id = m.thread_id
         WHERE m.id = ?1 AND (t.hotel_a_id = ?2 OR t.hotel_b_id = ?2)
         LIMIT 1`
      ).bind(requestMessageId, hotelId).first();
      if (!requestMessage || requestMessage.sender_hotel_id === hotelId || !requestMessage.message_text.startsWith("ROOM_REQUEST|")) {
        return badRequest("Room request not found");
      }
      const existing = await context.env.DB.prepare(
        `SELECT id FROM hotel_messages WHERE thread_id = ?1 AND sender_hotel_id = ?2 AND message_text LIKE ?3 LIMIT 1`
      ).bind(requestMessage.thread_id, hotelId, `ROOM_AVAILABLE|${requestMessageId}|%`).first();
      if (existing) return badRequest("You have already confirmed availability for this request");
      const messageId = crypto.randomUUID().replace(/-/g, "");
      const messageText = `ROOM_AVAILABLE|${requestMessageId}|${priceValue === null ? "" : priceValue}`;
      await context.env.DB.batch([
        context.env.DB.prepare(`INSERT INTO hotel_messages (id, thread_id, sender_hotel_id, message_text) VALUES (?1, ?2, ?3, ?4)`).bind(messageId, requestMessage.thread_id, hotelId, messageText),
        context.env.DB.prepare(`INSERT INTO hotel_message_reads (message_id, hotel_id) VALUES (?1, ?2)`).bind(messageId, hotelId),
        context.env.DB.prepare(`UPDATE hotel_message_threads SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?1`).bind(requestMessage.thread_id),
      ]);
      return json({ ok: true, message_id: messageId }, { status: 201 });
    }

    if (action === "mark_thread_read") {
      await purgeExpiredHotelMessages(context.env.DB);

      const threadId = typeof payload.thread_id === "string" ? payload.thread_id.trim() : "";

      if (!isSafeRowId(threadId)) {
        return badRequest("Valid thread_id is required");
      }

      const unreadMessages = await context.env.DB.prepare(
        `SELECT m.id
         FROM hotel_messages m
         INNER JOIN hotel_message_threads t ON t.id = m.thread_id
         LEFT JOIN hotel_message_reads r
           ON r.message_id = m.id
          AND r.hotel_id = ?2
         WHERE m.thread_id = ?1
           AND (t.hotel_a_id = ?2 OR t.hotel_b_id = ?2)
           AND m.sender_hotel_id <> ?2
           AND r.message_id IS NULL`
      )
        .bind(threadId, hotelId)
        .all();

      await context.env.DB.batch(
        (unreadMessages.results || []).map((message) =>
          context.env.DB.prepare(
            `INSERT INTO hotel_message_reads (message_id, hotel_id)
             VALUES (?1, ?2)
             ON CONFLICT(message_id, hotel_id) DO NOTHING`
          ).bind(message.id, hotelId)
        )
      );

      return json({ ok: true, marked: (unreadMessages.results || []).length });
    }

    return badRequest("action must be send_room_request, confirm_room_available or mark_thread_read");
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to update messages");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, OPTIONS",
    },
  });
