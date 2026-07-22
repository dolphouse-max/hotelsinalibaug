import { requireSuperAdminSession } from "../../_lib/auth";
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

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function onRequestGet(context) {
  try {
    if (!(await requireSuperAdminSession(context.request, context.env))) {
      return unauthorized();
    }

    await ensureWebsiteInquiryTable(context.env.DB);
    const url = new URL(context.request.url);
    const hotelQuery = normalizeText(url.searchParams.get("hotel_q")).toLowerCase();
    const search = normalizeText(url.searchParams.get("q")).toLowerCase();

    const query = `
      SELECT
        i.id,
        i.hotel_id,
        i.public_page_slug,
        i.hotel_name_snapshot,
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
        i.updated_at,
        h.name AS hotel_name
      FROM hotel_public_inquiries i
      INNER JOIN hotels h ON lower(h.id) = lower(i.hotel_id)
      WHERE (
        ?1 = ''
        OR lower(i.hotel_id) LIKE ?2
        OR lower(h.name) LIKE ?2
        OR lower(i.hotel_name_snapshot) LIKE ?2
      )
      AND (
        ?3 = ''
        OR lower(i.guest_name) LIKE ?4
        OR lower(i.guest_phone) LIKE ?4
        OR lower(i.guest_message) LIKE ?4
        OR lower(i.requested_room_type) LIKE ?4
      )
      ORDER BY i.created_at DESC
      LIMIT 500`;

    const hotelLike = `%${hotelQuery}%`;
    const searchLike = `%${search}%`;
    const inquiries = await context.env.DB.prepare(query).bind(hotelQuery, hotelLike, search, searchLike).all();

    return json({
      ok: true,
      inquiries: inquiries.results || [],
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to load inquiries." }, { status: 500 });
  }
}
