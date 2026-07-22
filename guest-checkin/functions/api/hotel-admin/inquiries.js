import { requireHotelAdminSession } from "../../_lib/auth";
import { ensureWebsiteInquiryTable } from "../../_lib/website-inquiries";

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function onRequestGet(context) {
  try {
    await ensureWebsiteInquiryTable(context.env.DB);
    const url = new URL(context.request.url);
    const hotelId = normalizeText(url.searchParams.get("hotel_id")).toLowerCase();
    const search = normalizeText(url.searchParams.get("q")).toLowerCase();

    if (!hotelId) {
      return badRequest("Valid hotel_id is required.");
    }
    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    const hotel = await context.env.DB.prepare(
      `SELECT id, name FROM hotels WHERE lower(id) = lower(?1) LIMIT 1`
    ).bind(hotelId).first();

    const query = `
      SELECT
        i.id,
        i.hotel_id,
        i.public_page_slug,
        i.page_title_snapshot,
        i.guest_name,
        i.guest_phone,
        i.check_in_date,
        i.check_out_date,
        i.total_persons,
        i.requested_room_type,
        i.guest_message,
        i.inquiry_status,
        i.source_path,
        i.created_at,
        i.updated_at
      FROM hotel_public_inquiries i
      WHERE lower(i.hotel_id) = lower(?1)
        AND (
          ?2 = ''
          OR lower(i.guest_name) LIKE ?3
          OR lower(i.guest_phone) LIKE ?3
          OR lower(i.guest_message) LIKE ?3
          OR lower(i.requested_room_type) LIKE ?3
        )
      ORDER BY i.created_at DESC
      LIMIT 300`;

    const likeValue = `%${search}%`;
    const inquiries = await context.env.DB.prepare(query).bind(hotelId, search, likeValue).all();

    return json({
      ok: true,
      hotel: hotel || { id: hotelId, name: hotelId },
      inquiries: inquiries.results || [],
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to load inquiries." }, { status: 500 });
  }
}
