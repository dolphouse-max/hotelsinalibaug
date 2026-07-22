import { requireHotelAdminSession } from "../../_lib/auth";
import { getHotelDriveAccessToken, uploadFileToHotelDrive } from "../../_lib/google-drive";
import {
  formatBeachDistanceLabel,
  ensurePublicPageTables,
  mergeSelectedWithCustom,
  multilineToSimpleList,
  normalizePublicPagePayload,
  parseFaqLines,
  parseNearbyLines,
} from "../../_lib/public-pages";

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
}

const MAX_PHOTO_COUNT = 20;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

function isSafeHotelId(value: string | null): value is string {
  return Boolean(value) && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
}

function normalizeText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFileName(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return safe.slice(0, 120) || "website-photo";
}

function validateFile(file: File, key: string) {
  if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${key} is missing or exceeds 10 MB.`);
  }
  const type = file.type || "application/octet-stream";
  if (!ALLOWED_CONTENT_TYPES.has(type)) {
    throw new Error(`${key} must be JPG, PNG, or WEBP.`);
  }
}

function parseBoolean(value: string) {
  return value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "yes";
}

async function getPageForHotel(env: Env, hotelId: string) {
  const page = await env.DB.prepare(
    `SELECT hpp.*, h.name AS hotel_name, h.total_rooms
     FROM hotel_public_pages hpp
     INNER JOIN hotels h
       ON lower(h.id) = lower(hpp.hotel_id)
     WHERE lower(hpp.hotel_id) = lower(?1)
     LIMIT 1`
  )
    .bind(hotelId)
    .first<Record<string, unknown>>();

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
     ORDER BY photo_order ASC, created_at ASC`
  )
    .bind(String(page.id))
    .all();

  return {
    ...page,
    photos: photos.results || [],
  };
}

function buildEditablePayload(formData: FormData, existingPage: Record<string, unknown>, hotelName: string) {
  const category = String(existingPage.category || "hotel");
  const slug = String(existingPage.slug || "");
  const canonicalPath = String(existingPage.canonical_path || "");
  const selectedAmenities = formData.getAll("amenity_selected");
  const selectedRoomTypes = formData.getAll("room_type_selected");
  const roomCountDisplay = normalizeText(formData.get("room_count_display")) || String(existingPage.room_count_display || existingPage.total_rooms || "");
  const beachDistanceMeters = normalizeText(formData.get("beach_distance_meters"));
  const beachDistanceLabel = formatBeachDistanceLabel(beachDistanceMeters, normalizeText(formData.get("beach_distance_label")));

  return normalizePublicPagePayload(
    {
      hotel_id: normalizeText(formData.get("hotel_id")),
      category,
      slug,
      canonical_path: canonicalPath,
      public_title: normalizeText(formData.get("public_title")),
      meta_title: normalizeText(formData.get("meta_title")),
      meta_description: normalizeText(formData.get("meta_description")),
      hero_heading: normalizeText(formData.get("hero_heading")),
      hero_subheading: normalizeText(formData.get("hero_subheading")),
      short_description: normalizeText(formData.get("short_description")),
      full_description: normalizeText(formData.get("full_description")),
      primary_phone: normalizeText(formData.get("primary_phone")),
      secondary_phone: normalizeText(formData.get("secondary_phone")),
      whatsapp_number: normalizeText(formData.get("whatsapp_number")),
      inquiry_email: normalizeText(formData.get("inquiry_email")),
      website_url: normalizeText(formData.get("website_url")),
      google_maps_embed_url: normalizeText(formData.get("google_maps_embed_url")),
      google_maps_place_url: normalizeText(formData.get("google_maps_place_url")),
      check_in_time: normalizeText(formData.get("check_in_time")),
      check_out_time: normalizeText(formData.get("check_out_time")),
      room_count_display: roomCountDisplay,
      beach_distance_meters: beachDistanceMeters,
      beach_distance_label: beachDistanceLabel,
      amenities_json: mergeSelectedWithCustom(selectedAmenities, normalizeText(formData.get("amenities_lines"))),
      room_types_json: mergeSelectedWithCustom(selectedRoomTypes, normalizeText(formData.get("room_types_lines"))),
      faq_json: parseFaqLines(normalizeText(formData.get("faq_lines"))),
      nearby_places_json: parseNearbyLines(normalizeText(formData.get("nearby_places_lines"))),
      policies_json: multilineToSimpleList(normalizeText(formData.get("policies_lines"))),
      inquiry_whatsapp_prefill: normalizeText(formData.get("inquiry_whatsapp_prefill")),
      is_published: Number(existingPage.is_published || 0),
      sort_order: Number(existingPage.sort_order || 0),
    },
    hotelName
  );
}

async function upsertPhotoSlot(
  env: Env,
  pageId: string,
  hotelId: string,
  slotNumber: number,
  formData: FormData,
  accessToken: string,
  folderId: string
) {
  const fileKey = `photo_${slotNumber}_file`;
  const altKey = `photo_${slotNumber}_alt`;
  const captionKey = `photo_${slotNumber}_caption`;
  const coverKey = `photo_${slotNumber}_is_cover`;
  const activeKey = `photo_${slotNumber}_is_active`;
  const file = formData.get(fileKey);
  const altText = normalizeText(formData.get(altKey));
  const caption = normalizeText(formData.get(captionKey));
  const isCover = parseBoolean(normalizeText(formData.get(coverKey))) ? 1 : 0;
  const isActive = normalizeText(formData.get(activeKey))
    ? (parseBoolean(normalizeText(formData.get(activeKey))) ? 1 : 0)
    : 1;

  const existing = await env.DB.prepare(
    `SELECT id, google_drive_file_id, file_name
     FROM hotel_public_page_photos
     WHERE public_page_id = ?1 AND photo_order = ?2
     LIMIT 1`
  )
    .bind(pageId, slotNumber)
    .first<{ id: string; google_drive_file_id: string | null; file_name: string | null }>();

  let driveFileId = existing?.google_drive_file_id || null;
  let fileName = existing?.file_name || null;

  if (file instanceof File && file.size) {
    validateFile(file, fileKey);
    const extension = (file.type || "image/jpeg").split("/")[1] || "jpg";
    const driveFileName = sanitizeFileName(`${hotelId}-website-photo-${slotNumber}-${Date.now()}.${extension}`);
    const uploaded = await uploadFileToHotelDrive(
      accessToken,
      folderId,
      driveFileName,
      file.type || "image/jpeg",
      await file.arrayBuffer()
    );
    driveFileId = uploaded.id;
    fileName = uploaded.name;
  }

  if (!existing && !driveFileId && !altText && !caption) {
    return;
  }

  if (!driveFileId) {
    throw new Error(`Photo slot ${slotNumber} needs an image before it can be saved.`);
  }

  const finalAlt = altText || fileName || `${hotelId} website photo ${slotNumber}`;

  if (existing) {
    await env.DB.prepare(
      `UPDATE hotel_public_page_photos
       SET google_drive_file_id = ?1,
           file_name = ?2,
           alt_text = ?3,
           caption = ?4,
           is_cover = ?5,
           is_active = ?6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?7`
    )
      .bind(driveFileId, fileName, finalAlt, caption || null, isCover, isActive, existing.id)
      .run();
  } else {
    await env.DB.prepare(
      `INSERT INTO hotel_public_page_photos (
         public_page_id,
         hotel_id,
         google_drive_file_id,
         file_name,
         alt_text,
         caption,
         photo_order,
         is_cover,
         is_active
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
      .bind(pageId, hotelId, driveFileId, fileName, finalAlt, caption || null, slotNumber, isCover, isActive)
      .run();
  }
}

async function normalizeCoverFlags(env: Env, pageId: string) {
  const coverRows = await env.DB.prepare(
    `SELECT id
     FROM hotel_public_page_photos
     WHERE public_page_id = ?1
       AND is_active = 1
       AND is_cover = 1
     ORDER BY photo_order ASC, created_at ASC`
  )
    .bind(pageId)
    .all();

  const rows = coverRows.results || [];
  if (rows.length <= 1) {
    return;
  }

  const keepId = String(rows[0].id || "");
  await env.DB.prepare(
    `UPDATE hotel_public_page_photos
     SET is_cover = CASE WHEN id = ?2 THEN 1 ELSE 0 END,
         updated_at = CURRENT_TIMESTAMP
     WHERE public_page_id = ?1
       AND is_active = 1`
  )
    .bind(pageId, keepId)
    .run();
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const hotelId = url.searchParams.get("hotel_id");

    if (!isSafeHotelId(hotelId)) {
      return badRequest("Valid hotel_id is required.");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    const page = await getPageForHotel(context.env, hotelId);
    if (!page) {
      return json({ ok: true, page: null });
    }

    return json({ ok: true, page });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to load hotel website page." },
      { status: 500 }
    );
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  await ensurePublicPageTables(context.env.DB);
  const contentType = context.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("Expected multipart/form-data.");
  }

  try {
    const formData = await context.request.formData();
    const hotelId = normalizeText(formData.get("hotel_id")).toLowerCase();

    if (!isSafeHotelId(hotelId)) {
      return badRequest("Valid hotel_id is required.");
    }

    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }

    const page = await getPageForHotel(context.env, hotelId);
    if (!page) {
      return badRequest("Superadmin must first create the public hotel page.");
    }

    const payload = buildEditablePayload(formData, page, String(page.hotel_name || ""));

    await context.env.DB.prepare(
      `UPDATE hotel_public_pages
       SET public_title = ?2,
           meta_title = ?3,
           meta_description = ?4,
           hero_heading = ?5,
           hero_subheading = ?6,
           short_description = ?7,
           full_description = ?8,
           primary_phone = ?9,
           secondary_phone = ?10,
           whatsapp_number = ?11,
           inquiry_email = ?12,
           website_url = ?13,
           google_maps_embed_url = ?14,
           google_maps_place_url = ?15,
           check_in_time = ?16,
           check_out_time = ?17,
           room_count_display = ?18,
           beach_distance_meters = ?19,
           beach_distance_label = ?20,
           room_types_json = ?21,
           amenities_json = ?22,
           faq_json = ?23,
           nearby_places_json = ?24,
           policies_json = ?25,
           inquiry_whatsapp_prefill = ?26,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    )
      .bind(
        String(page.id),
        payload.publicTitle,
        payload.metaTitle,
        payload.metaDescription,
        payload.heroHeading,
        payload.heroSubheading,
        payload.shortDescription,
        payload.fullDescription,
        payload.primaryPhone,
        payload.secondaryPhone,
        payload.whatsappNumber,
        payload.inquiryEmail,
        payload.websiteUrl,
        payload.googleMapsEmbedUrl,
        payload.googleMapsPlaceUrl,
        payload.checkInTime,
        payload.checkOutTime,
        payload.roomCountDisplay,
        payload.beachDistanceMeters,
        payload.beachDistanceLabel,
        payload.roomTypesJson,
        payload.amenitiesJson,
        payload.faqJson,
        payload.nearbyPlacesJson,
        payload.policiesJson,
        payload.inquiryWhatsappPrefill
      )
      .run();

    const shouldUploadPhotos = parseBoolean(normalizeText(formData.get("update_photos")));
    if (shouldUploadPhotos) {
      const { accessToken, folderId } = await getHotelDriveAccessToken(hotelId, context.env);
      for (let slot = 1; slot <= MAX_PHOTO_COUNT; slot += 1) {
        await upsertPhotoSlot(context.env, String(page.id), hotelId, slot, formData, accessToken, folderId);
      }
      await normalizeCoverFlags(context.env, String(page.id));
    }

    const updatedPage = await getPageForHotel(context.env, hotelId);
    return json({ ok: true, page: updatedPage });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to update hotel website page.");
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, OPTIONS",
    },
  });
