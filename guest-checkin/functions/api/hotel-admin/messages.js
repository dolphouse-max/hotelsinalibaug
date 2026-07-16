import { badRequest, json, unauthorized } from "../../_lib/api";

function requireHotelAdmin(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.HOTEL_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.HOTEL_ADMIN_TOKEN;
}

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
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  const url = new URL(context.request.url);
  const hotelId = url.searchParams.get("hotel_id")?.trim() || "";
  const threadId = url.searchParams.get("thread_id")?.trim() || "";

  if (!isSafeHotelId(hotelId)) {
    return badRequest("Valid hotel_id is required");
  }

  try {
    const [directory, threads] = await Promise.all([
      loadDirectory(context.env.DB, hotelId),
      loadThreads(context.env.DB, hotelId),
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
      thread: threadDetails?.thread || null,
      messages: threadDetails?.messages || [],
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to load messages");
  }
}

export async function onRequestPost(context) {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const action = typeof payload.action === "string" ? payload.action.trim() : "";
    const hotelId = typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "";

    if (!isSafeHotelId(hotelId)) {
      return badRequest("Valid hotel_id is required");
    }

    if (action === "send_message") {
      const recipientHotelId = typeof payload.recipient_hotel_id === "string" ? payload.recipient_hotel_id.trim() : "";
      const messageText = typeof payload.message_text === "string" ? payload.message_text.trim() : "";

      if (!isSafeHotelId(recipientHotelId) || recipientHotelId === hotelId) {
        return badRequest("Valid recipient_hotel_id is required");
      }

      if (!messageText) {
        return badRequest("message_text is required");
      }

      const [hotelAId, hotelBId] = normalizeThreadPair(hotelId, recipientHotelId);
      let thread = await context.env.DB.prepare(
        `SELECT id
         FROM hotel_message_threads
         WHERE hotel_a_id = ?1 AND hotel_b_id = ?2
         LIMIT 1`
      )
        .bind(hotelAId, hotelBId)
        .first();

      if (!thread) {
        const threadId = crypto.randomUUID().replace(/-/g, "");
        await context.env.DB.prepare(
          `INSERT INTO hotel_message_threads (id, hotel_a_id, hotel_b_id)
           VALUES (?1, ?2, ?3)`
        )
          .bind(threadId, hotelAId, hotelBId)
          .run();
        thread = { id: threadId };
      }

      const messageId = crypto.randomUUID().replace(/-/g, "");
      await context.env.DB.batch([
        context.env.DB.prepare(
          `INSERT INTO hotel_messages (id, thread_id, sender_hotel_id, message_text)
           VALUES (?1, ?2, ?3, ?4)`
        ).bind(messageId, thread.id, hotelId, messageText),
        context.env.DB.prepare(
          `INSERT INTO hotel_message_reads (message_id, hotel_id)
           VALUES (?1, ?2)`
        ).bind(messageId, hotelId),
        context.env.DB.prepare(
          `UPDATE hotel_message_threads
           SET last_message_at = CURRENT_TIMESTAMP
           WHERE id = ?1`
        ).bind(thread.id),
      ]);

      return json({ ok: true, thread_id: thread.id, message_id: messageId }, { status: 201 });
    }

    if (action === "mark_thread_read") {
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

    return badRequest("action must be send_message or mark_thread_read");
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
