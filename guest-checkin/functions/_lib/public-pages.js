function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizePhone(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(Array.isArray(parsed) ? parsed : []);
    } catch {
      throw new Error("One of the JSON list fields is invalid.");
    }
  }

  return "[]";
}

export function slugifyPublicPageValue(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function categoryBasePath(category) {
  switch (category) {
    case "resort":
      return "/resorts";
    case "hotel":
      return "/hotels";
    case "cottage":
      return "/cottages";
    case "homestay":
      return "/homestays";
    default:
      return "/stays";
  }
}

export function normalizePublicPagePayload(payload, fallbackHotelName = "") {
  const hotelId = normalizeText(payload.hotel_id).toLowerCase();
  const category = normalizeText(payload.category || "hotel").toLowerCase();

  if (!isSafeHotelId(hotelId)) {
    throw new Error("Valid hotel_id is required.");
  }

  if (!["resort", "hotel", "cottage", "homestay"].includes(category)) {
    throw new Error("category must be resort, hotel, cottage, or homestay.");
  }

  const derivedTitle = normalizeText(payload.public_title || fallbackHotelName);
  const slug = slugifyPublicPageValue(payload.slug || derivedTitle || hotelId);

  if (!slug) {
    throw new Error("slug is required.");
  }

  const publicTitle = derivedTitle || slug.replace(/-/g, " ");
  const heroHeading = normalizeText(payload.hero_heading || publicTitle);
  const metaTitle = normalizeText(payload.meta_title || publicTitle);
  const metaDescription = normalizeText(payload.meta_description);
  const shortDescription = normalizeText(payload.short_description);
  const fullDescription = normalizeText(payload.full_description);

  if (!publicTitle || !metaTitle || !metaDescription || !shortDescription || !fullDescription) {
    throw new Error("public_title, meta_title, meta_description, short_description, and full_description are required.");
  }

  return {
    hotelId,
    category,
    slug,
    publicTitle,
    metaTitle,
    metaDescription,
    heroHeading,
    heroSubheading: normalizeNullableText(payload.hero_subheading),
    shortDescription,
    fullDescription,
    addressLine1: normalizeNullableText(payload.address_line_1),
    addressVillage: normalizeNullableText(payload.address_village),
    addressTaluka: normalizeNullableText(payload.address_taluka),
    addressDistrict: normalizeNullableText(payload.address_district),
    addressPincode: normalizeNullableText(payload.address_pincode),
    primaryPhone: normalizePhone(payload.primary_phone),
    secondaryPhone: normalizePhone(payload.secondary_phone),
    whatsappNumber: normalizePhone(payload.whatsapp_number),
    inquiryEmail: normalizeNullableText(payload.inquiry_email)?.toLowerCase() || null,
    websiteUrl: normalizeNullableText(payload.website_url),
    googleMapsEmbedUrl: normalizeNullableText(payload.google_maps_embed_url),
    googleMapsPlaceUrl: normalizeNullableText(payload.google_maps_place_url),
    checkInTime: normalizeNullableText(payload.check_in_time),
    checkOutTime: normalizeNullableText(payload.check_out_time),
    roomTypesJson: normalizeJsonArray(payload.room_types_json),
    amenitiesJson: normalizeJsonArray(payload.amenities_json),
    faqJson: normalizeJsonArray(payload.faq_json),
    nearbyPlacesJson: normalizeJsonArray(payload.nearby_places_json),
    policiesJson: normalizeJsonArray(payload.policies_json),
    inquiryWhatsappPrefill: normalizeNullableText(payload.inquiry_whatsapp_prefill),
    canonicalPath: normalizeNullableText(payload.canonical_path) || `${categoryBasePath(category)}/${slug}`,
    isPublished: payload.is_published === true || payload.is_published === 1 ? 1 : 0,
    sortOrder: Number.isFinite(Number(payload.sort_order)) ? Math.floor(Number(payload.sort_order)) : 0,
  };
}

export async function ensurePublicPageTables(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS hotel_public_pages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      hotel_id TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'hotel' CHECK (category IN ('resort', 'hotel', 'cottage', 'homestay')),
      slug TEXT NOT NULL UNIQUE,
      public_title TEXT NOT NULL,
      meta_title TEXT NOT NULL,
      meta_description TEXT NOT NULL,
      hero_heading TEXT NOT NULL,
      hero_subheading TEXT,
      short_description TEXT NOT NULL,
      full_description TEXT NOT NULL,
      address_line_1 TEXT,
      address_village TEXT,
      address_taluka TEXT,
      address_district TEXT,
      address_pincode TEXT,
      primary_phone TEXT,
      secondary_phone TEXT,
      whatsapp_number TEXT,
      inquiry_email TEXT,
      website_url TEXT,
      google_maps_embed_url TEXT,
      google_maps_place_url TEXT,
      check_in_time TEXT,
      check_out_time TEXT,
      room_types_json TEXT NOT NULL DEFAULT '[]',
      amenities_json TEXT NOT NULL DEFAULT '[]',
      faq_json TEXT NOT NULL DEFAULT '[]',
      nearby_places_json TEXT NOT NULL DEFAULT '[]',
      policies_json TEXT NOT NULL DEFAULT '[]',
      inquiry_whatsapp_prefill TEXT,
      canonical_path TEXT,
      is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      last_reviewed_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS hotel_public_page_photos (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      public_page_id TEXT NOT NULL,
      hotel_id TEXT NOT NULL,
      google_drive_file_id TEXT NOT NULL,
      file_name TEXT,
      alt_text TEXT NOT NULL,
      caption TEXT,
      photo_order INTEGER NOT NULL DEFAULT 0,
      is_cover INTEGER NOT NULL DEFAULT 0 CHECK (is_cover IN (0, 1)),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (public_page_id) REFERENCES hotel_public_pages(id) ON DELETE CASCADE,
      FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_hotel_public_pages_category ON hotel_public_pages(category);
    CREATE INDEX IF NOT EXISTS idx_hotel_public_pages_published ON hotel_public_pages(is_published);
    CREATE INDEX IF NOT EXISTS idx_hotel_public_pages_sort_order ON hotel_public_pages(sort_order);
    CREATE INDEX IF NOT EXISTS idx_hotel_public_page_photos_public_page_id ON hotel_public_page_photos(public_page_id);
    CREATE INDEX IF NOT EXISTS idx_hotel_public_page_photos_hotel_id ON hotel_public_page_photos(hotel_id);
    CREATE INDEX IF NOT EXISTS idx_hotel_public_page_photos_photo_order ON hotel_public_page_photos(photo_order);
  `);
}
