import { ensureWebsiteInquiryTable, normalizeInquiryPayload } from "../_lib/website-inquiries";

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

export async function onRequestPost(context) {
  try {
    await ensureWebsiteInquiryTable(context.env.DB);
    const payload = normalizeInquiryPayload(await context.request.json());

    const page = await context.env.DB.prepare(
      `SELECT hpp.id, hpp.hotel_id, hpp.slug, hpp.public_title, h.name AS hotel_name
       FROM hotel_public_pages hpp
       INNER JOIN hotels h ON lower(h.id) = lower(hpp.hotel_id)
       WHERE lower(hpp.hotel_id) = lower(?1)
         AND hpp.is_published = 1
       LIMIT 1`
    )
      .bind(payload.hotelId)
      .first();

    if (!page) {
      return badRequest("Published hotel page not found.");
    }

    const result = await context.env.DB.prepare(
      `INSERT INTO hotel_public_inquiries (
         hotel_id,
         public_page_id,
         public_page_slug,
         hotel_name_snapshot,
       page_title_snapshot,
       guest_name,
       guest_phone,
       check_in_date,
       check_out_date,
       total_persons,
       requested_room_type,
       guest_message,
       inquiry_status,
       source_path,
         updated_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, CURRENT_TIMESTAMP)`
    )
      .bind(
        payload.hotelId,
        payload.publicPageId || page.id,
        payload.publicPageSlug || page.slug,
        payload.hotelNameSnapshot || page.hotel_name || "",
        payload.pageTitleSnapshot || page.public_title || "",
        payload.guestName,
        payload.guestPhone,
        payload.checkInDate,
        payload.checkOutDate,
        payload.totalPersons,
        payload.requestedRoomType,
        payload.guestMessage,
        "new",
        payload.sourcePath || new URL(context.request.url).pathname
      )
      .run();

    if (!result.success) {
      throw new Error("Unable to save inquiry.");
    }

    return json({
      ok: true,
      message: `Inquiry sent to ${page.hotel_name || page.public_title || "the hotel"} successfully.`,
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to save inquiry.");
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}
