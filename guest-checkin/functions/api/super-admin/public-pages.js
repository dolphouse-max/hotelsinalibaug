import { requireSuperAdminSession } from "../../_lib/auth";
import {
  ensurePublicPageTables,
  normalizePublicPagePayload,
} from "../../_lib/public-pages";

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

async function getHotel(env, hotelId) {
  return env.DB.prepare(
    `SELECT id, name, contact, address, total_rooms
     FROM hotels
     WHERE lower(id) = lower(?1)
     LIMIT 1`
  )
    .bind(hotelId)
    .first();
}

async function listPages(env) {
  const result = await env.DB.prepare(
    `SELECT
       hpp.id,
       hpp.hotel_id,
       h.name AS hotel_name,
       h.total_rooms,
       hpp.category,
       hpp.slug,
       hpp.public_title,
       hpp.meta_title,
       hpp.meta_description,
       hpp.short_description,
       hpp.room_count_display,
       hpp.beach_distance_meters,
       hpp.beach_distance_label,
       hpp.is_published,
       hpp.sort_order,
       hpp.updated_at,
       (
         SELECT COUNT(*)
         FROM hotel_public_page_photos p
         WHERE p.public_page_id = hpp.id
           AND p.is_active = 1
       ) AS photo_count
     FROM hotel_public_pages hpp
     INNER JOIN hotels h
       ON lower(h.id) = lower(hpp.hotel_id)
     ORDER BY hpp.sort_order ASC, hpp.updated_at DESC`
  ).all();

  return result.results || [];
}

async function getPageDetails(env, pageId, hotelId) {
  const page = pageId
    ? await env.DB.prepare(
        `SELECT hpp.*, h.name AS hotel_name, h.total_rooms
         FROM hotel_public_pages hpp
         INNER JOIN hotels h
           ON lower(h.id) = lower(hpp.hotel_id)
         WHERE hpp.id = ?1
         LIMIT 1`
      )
        .bind(pageId)
        .first()
    : await env.DB.prepare(
        `SELECT hpp.*, h.name AS hotel_name, h.total_rooms
         FROM hotel_public_pages hpp
         INNER JOIN hotels h
           ON lower(h.id) = lower(hpp.hotel_id)
         WHERE lower(hpp.hotel_id) = lower(?1)
         LIMIT 1`
      )
        .bind(hotelId)
        .first();

  if (!page) {
    return null;
  }

  const photos = await env.DB.prepare(
    `SELECT
       id,
       public_page_id,
       hotel_id,
       google_drive_file_id,
       file_name,
       alt_text,
       caption,
       photo_order,
       is_cover,
       is_active,
       created_at,
       updated_at
     FROM hotel_public_page_photos
     WHERE public_page_id = ?1
     ORDER BY is_cover DESC, photo_order ASC, created_at ASC`
  )
    .bind(page.id)
    .all();

  return {
    ...page,
    photos: photos.results || [],
  };
}

export async function onRequestGet(context) {
  try {
    if (!(await requireSuperAdminSession(context.request, context.env))) {
      return unauthorized();
    }

    const url = new URL(context.request.url);
    const pageId = url.searchParams.get("id")?.trim() || "";
    const hotelId = url.searchParams.get("hotel_id")?.trim() || "";

    if (pageId || hotelId) {
      const page = await getPageDetails(context.env, pageId, hotelId);
      if (!page) {
        return json({ error: "Public page not found." }, { status: 404 });
      }
      return json({ ok: true, page });
    }

    const pages = await listPages(context.env);
    return json({ ok: true, pages });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to load public pages." },
      { status: 500 }
    );
  }
}

export async function onRequestPost(context) {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  try {
    await ensurePublicPageTables(context.env.DB);
    const payload = await context.request.json();
    const hotelId = String(payload.hotel_id || "").trim().toLowerCase();
    const hotel = await getHotel(context.env, hotelId);

    if (!hotel) {
      return badRequest("Selected hotel was not found.");
    }

    const normalized = normalizePublicPagePayload(payload, hotel.name);
    const existingByHotel = await context.env.DB.prepare(
      `SELECT id, slug
       FROM hotel_public_pages
       WHERE lower(hotel_id) = lower(?1)
       LIMIT 1`
    )
      .bind(normalized.hotelId)
      .first();

    const existingBySlug = await context.env.DB.prepare(
      `SELECT id, hotel_id
       FROM hotel_public_pages
       WHERE lower(slug) = lower(?1)
       LIMIT 1`
    )
      .bind(normalized.slug)
      .first();

    if (existingBySlug && existingBySlug.id !== existingByHotel?.id) {
      return badRequest("This slug is already used by another hotel page.");
    }

    const viewer = "superadmin";

    if (existingByHotel) {
      const result = await context.env.DB.prepare(
        `UPDATE hotel_public_pages
         SET category = ?2,
             slug = ?3,
             public_title = ?4,
             meta_title = ?5,
             meta_description = ?6,
             hero_heading = ?7,
             hero_subheading = ?8,
             short_description = ?9,
             full_description = ?10,
             address_line_1 = ?11,
             address_village = ?12,
             address_taluka = ?13,
             address_district = ?14,
             address_pincode = ?15,
             primary_phone = ?16,
             secondary_phone = ?17,
             whatsapp_number = ?18,
             inquiry_email = ?19,
             website_url = ?20,
             google_maps_embed_url = ?21,
             google_maps_place_url = ?22,
             check_in_time = ?23,
             check_out_time = ?24,
             room_count_display = ?25,
             beach_distance_meters = ?26,
             beach_distance_label = ?27,
             room_types_json = ?28,
             amenities_json = ?29,
             faq_json = ?30,
             nearby_places_json = ?31,
             policies_json = ?32,
             inquiry_whatsapp_prefill = ?33,
             canonical_path = ?34,
             is_published = ?35,
             sort_order = ?36,
             last_reviewed_by = ?37,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1`
      )
        .bind(
          existingByHotel.id,
          normalized.category,
          normalized.slug,
          normalized.publicTitle,
          normalized.metaTitle,
          normalized.metaDescription,
          normalized.heroHeading,
          normalized.heroSubheading,
          normalized.shortDescription,
          normalized.fullDescription,
          normalized.addressLine1,
          normalized.addressVillage,
          normalized.addressTaluka,
          normalized.addressDistrict,
          normalized.addressPincode,
          normalized.primaryPhone,
          normalized.secondaryPhone,
          normalized.whatsappNumber,
          normalized.inquiryEmail,
          normalized.websiteUrl,
          normalized.googleMapsEmbedUrl,
          normalized.googleMapsPlaceUrl,
          normalized.checkInTime,
          normalized.checkOutTime,
          normalized.roomCountDisplay,
          normalized.beachDistanceMeters,
          normalized.beachDistanceLabel,
          normalized.roomTypesJson,
          normalized.amenitiesJson,
          normalized.faqJson,
          normalized.nearbyPlacesJson,
          normalized.policiesJson,
          normalized.inquiryWhatsappPrefill,
          normalized.canonicalPath,
          normalized.isPublished,
          normalized.sortOrder,
          viewer
        )
        .run();

      if (!result.success) {
        return json({ error: "Unable to update public hotel page." }, { status: 500 });
      }
    } else {
      const result = await context.env.DB.prepare(
        `INSERT INTO hotel_public_pages (
           hotel_id,
           category,
           slug,
           public_title,
           meta_title,
           meta_description,
           hero_heading,
           hero_subheading,
           short_description,
           full_description,
           address_line_1,
           address_village,
           address_taluka,
           address_district,
           address_pincode,
           primary_phone,
           secondary_phone,
           whatsapp_number,
           inquiry_email,
           website_url,
           google_maps_embed_url,
           google_maps_place_url,
           check_in_time,
           check_out_time,
           room_count_display,
           beach_distance_meters,
           beach_distance_label,
           room_types_json,
           amenities_json,
           faq_json,
           nearby_places_json,
           policies_json,
           inquiry_whatsapp_prefill,
           canonical_path,
           is_published,
           sort_order,
           created_by,
           last_reviewed_by
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
           ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20,
           ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30,
           ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38
         )`
      )
        .bind(
          normalized.hotelId,
          normalized.category,
          normalized.slug,
          normalized.publicTitle,
          normalized.metaTitle,
          normalized.metaDescription,
          normalized.heroHeading,
          normalized.heroSubheading,
          normalized.shortDescription,
          normalized.fullDescription,
          normalized.addressLine1,
          normalized.addressVillage,
          normalized.addressTaluka,
          normalized.addressDistrict,
          normalized.addressPincode,
          normalized.primaryPhone,
          normalized.secondaryPhone,
          normalized.whatsappNumber,
          normalized.inquiryEmail,
          normalized.websiteUrl,
          normalized.googleMapsEmbedUrl,
          normalized.googleMapsPlaceUrl,
          normalized.checkInTime,
          normalized.checkOutTime,
          normalized.roomCountDisplay,
          normalized.beachDistanceMeters,
          normalized.beachDistanceLabel,
          normalized.roomTypesJson,
          normalized.amenitiesJson,
          normalized.faqJson,
          normalized.nearbyPlacesJson,
          normalized.policiesJson,
          normalized.inquiryWhatsappPrefill,
          normalized.canonicalPath,
          normalized.isPublished,
          normalized.sortOrder,
          viewer,
          viewer
        )
        .run();

      if (!result.success) {
        return json({ error: "Unable to create public hotel page." }, { status: 500 });
      }
    }

    const page = await getPageDetails(context.env, "", normalized.hotelId);
    return json({ ok: true, page });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to save public hotel page.");
  }
}

export async function onRequestDelete(context) {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  await ensurePublicPageTables(context.env.DB);
  const url = new URL(context.request.url);
  const pageId = url.searchParams.get("id")?.trim() || "";
  const hotelId = url.searchParams.get("hotel_id")?.trim() || "";

  if (!pageId && !hotelId) {
    return badRequest("id or hotel_id is required.");
  }

  const existing = await getPageDetails(context.env, pageId, hotelId);
  if (!existing) {
    return json({ error: "Public page not found." }, { status: 404 });
  }

  const result = await context.env.DB.prepare(
    `DELETE FROM hotel_public_pages
     WHERE id = ?1`
  )
    .bind(existing.id)
    .run();

  if (!result.success) {
    return json({ error: "Unable to delete public page." }, { status: 500 });
  }

  return json({ ok: true, deleted: { id: existing.id, hotel_id: existing.hotel_id, public_title: existing.public_title } });
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, DELETE, OPTIONS",
    },
  });
