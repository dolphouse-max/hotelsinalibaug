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

function normalizeInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.floor(numeric);
}

export const PUBLIC_PAGE_AMENITY_OPTIONS = [
  "AC Rooms",
  "Non AC Rooms",
  "Family Rooms",
  "Deluxe Rooms",
  "Cottages",
  "Swimming Pool",
  "Kids Play Area",
  "Free Wi-Fi",
  "Parking",
  "Restaurant",
  "Room Service",
  "Power Backup",
  "Hot Water",
  "TV",
  "Sea View",
  "Garden View",
  "Pet Friendly",
  "Campfire Area",
  "Driver Stay",
  "Breakfast Available",
];

export const PUBLIC_PAGE_ROOM_TYPE_OPTIONS = [
  "Standard Room",
  "Deluxe Room",
  "Super Deluxe Room",
  "Premium Room",
  "Executive Room",
  "Family Room",
  "Quad Room",
  "Cottage",
  "Villa",
  "Dormitory",
  "Pool View Room",
  "Sea View Room",
];

export const PUBLIC_PAGE_DISTANCE_OPTIONS = [
  { value: "100", label: "100 m" },
  { value: "250", label: "250 m" },
  { value: "500", label: "500 m" },
  { value: "750", label: "750 m" },
  { value: "1000", label: "1 km" },
  { value: "1500", label: "1.5 km" },
  { value: "2000", label: "2 km" },
  { value: "3000", label: "3 km" },
  { value: "5000", label: "5 km" },
];

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
    roomCountDisplay: normalizeInteger(payload.room_count_display),
    beachDistanceMeters: normalizeInteger(payload.beach_distance_meters),
    beachDistanceLabel: normalizeNullableText(payload.beach_distance_label),
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

async function ensureColumn(db, tableName, columnName, definition) {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = (columns.results || []).some((column) => String(column.name || "") === columnName);
  if (!hasColumn) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export async function ensurePublicPageTables(db) {
  await db.batch([
    db.prepare(`
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
        room_count_display INTEGER,
        beach_distance_meters INTEGER,
        beach_distance_label TEXT,
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
      )
    `),
    db.prepare(`
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
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_pages_category ON hotel_public_pages(category)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_pages_published ON hotel_public_pages(is_published)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_pages_sort_order ON hotel_public_pages(sort_order)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_page_photos_public_page_id ON hotel_public_page_photos(public_page_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_page_photos_hotel_id ON hotel_public_page_photos(hotel_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_page_photos_photo_order ON hotel_public_page_photos(photo_order)`),
  ]);

  await ensureColumn(db, "hotel_public_pages", "room_count_display", "INTEGER");
  await ensureColumn(db, "hotel_public_pages", "beach_distance_meters", "INTEGER");
  await ensureColumn(db, "hotel_public_pages", "beach_distance_label", "TEXT");
}

export function multilineToSimpleList(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseFaqLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [question, ...rest] = line.split("|");
      return {
        question: String(question || "").trim(),
        answer: rest.join("|").trim(),
      };
    })
    .filter((item) => item.question && item.answer);
}

export function parseNearbyLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, distance, note] = line.split("|").map((part) => String(part || "").trim());
      return {
        name,
        distance: distance || "",
        note: note || "",
      };
    })
    .filter((item) => item.name);
}

export function mergeSelectedWithCustom(selectedValues = [], customLines = "") {
  const selected = Array.isArray(selectedValues) ? selectedValues : [];
  const custom = multilineToSimpleList(customLines);
  return [...new Set([...selected.map((item) => String(item || "").trim()).filter(Boolean), ...custom])];
}

export function formatBeachDistanceLabel(meters, explicitLabel = "") {
  const directLabel = normalizeText(explicitLabel);
  if (directLabel) {
    return directLabel;
  }

  const value = normalizeInteger(meters);
  if (value === null) {
    return "";
  }

  if (value < 1000) {
    return `${value} m`;
  }

  const km = value / 1000;
  return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
}

export function buildStandardPublicPageContent({
  hotelName = "",
  category = "hotel",
  village = "",
  taluka = "Alibaug",
  district = "Raigad",
  roomCount = null,
  roomTypes = [],
  amenities = [],
  beachDistanceLabel = "",
} = {}) {
  const safeHotelName = normalizeText(hotelName) || "Hotel";
  const categoryLabel =
    category === "resort"
      ? "Resort"
      : category === "cottage"
        ? "Cottage"
        : category === "homestay"
          ? "Homestay"
          : "Hotel";
  const locationBits = [normalizeText(village), normalizeText(taluka), normalizeText(district)].filter(Boolean);
  const locationLabel = locationBits.length ? locationBits.join(", ") : "Alibaug";
  const roomLabel = roomCount ? `${roomCount} room${roomCount === 1 ? "" : "s"}` : "comfortable rooms";
  const topRoomTypes = roomTypes.slice(0, 3).join(", ");
  const topAmenities = amenities.slice(0, 4).join(", ");
  const beachLabel = normalizeText(beachDistanceLabel);
  const beachSentence = beachLabel ? `set around ${beachLabel} from the beach` : "well placed in the Alibaug stay belt";
  const typePlural =
    category === "resort"
      ? "resorts"
      : category === "cottage"
        ? "cottages"
        : category === "homestay"
          ? "homestays"
          : "hotels";

  return {
    publicTitle: `${safeHotelName} ${categoryLabel}`.trim(),
    metaTitle: `${safeHotelName} ${categoryLabel} | ${locationLabel} | Hotels In Alibaug`,
    metaDescription: `${safeHotelName} is a ${categoryLabel.toLowerCase()} in ${locationLabel} offering ${roomLabel}${beachLabel ? `, a location about ${beachLabel} from the beach,` : ","} and guest-focused comforts like ${topAmenities || "essential stay amenities"}.`,
    heroHeading: `${safeHotelName} - ${categoryLabel} in ${locationLabel}`,
    heroSubheading: `${safeHotelName} is a ${categoryLabel.toLowerCase()} in ${locationLabel}, ${beachSentence}, ideal for guests looking for ${roomLabel}, direct booking convenience, and a relaxed Alibaug stay.`,
    shortDescription: `${safeHotelName} stands among the welcoming ${typePlural} in ${locationLabel} with ${roomLabel}${beachLabel ? ` and beach access around ${beachLabel}` : ""}.`,
    fullDescription: `${safeHotelName} is a ${categoryLabel.toLowerCase()} in ${locationLabel} designed for guests who want a comfortable Alibaug stay with direct contact convenience. The property offers ${roomLabel}${topRoomTypes ? `, including options such as ${topRoomTypes},` : ""} along with ${topAmenities || "essential stay comforts"}${beachLabel ? ` and a setting around ${beachLabel} from the beach` : " in a well-connected Alibaug location"}. This page can be further enriched with photos, amenities, and local highlights by the hotel team.`,
  };
}
