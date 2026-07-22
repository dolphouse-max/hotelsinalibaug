const SITE_URL = "https://hotelsinalibaug.in";
const STATIC_PATHS = [
  "/",
  "/hotels",
  "/resorts",
  "/cottages",
  "/homestays",
  "/about.html",
  "/contact.html",
  "/pricing.html",
  "/privacy-policy.html",
  "/editorial-policy.html",
  "/alibaug-travel-guide.html",
  "/best-hotels-in-alibaug.html",
  "/beach-resorts-in-alibaug.html",
  "/budget-hotels-in-alibaug.html",
  "/family-resorts-in-alibaug.html",
  "/group-stay-in-alibaug.html",
  "/hidden-beaches-in-alibaug.html",
  "/hotels-for-couples-in-alibaug.html",
  "/hotels-near-alibaug-beach.html",
  "/how-to-reach-alibaug-from-mumbai.html",
  "/kashid-beach-travel-guide.html",
  "/luxury-resorts-in-alibaug.html",
  "/nagaon-beach-alibaug-travel-guide.html",
  "/pet-friendly-hotels-in-alibaug.html",
  "/resorts-near-kashid-beach.html",
  "/resorts-near-nagaon-beach.html",
  "/things-to-do-in-alibaug.html",
  "/top-beaches-in-alibaug.html",
  "/ultimate-alibaug-travel-guide-2026.html",
  "/water-sports-in-alibaug.html",
  "/weekend-stay-in-alibaug.html",
  "/weekend-trip-from-mumbai-to-alibaug.html",
  "/1-day-alibaug-trip-from-mumbai.html",
  "/2-day-alibaug-itinerary.html",
  "/alibaug-beach-sunset-guide.html",
  "/best-seafood-restaurants-in-alibaug.html",
  "/best-time-to-visit-alibaug.html",
  "/hotel-guest-checkin-app-alibaug.html",
];

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeDate(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "2026-07-22";
}

function makeUrlEntry(path, lastmod, priority = "0.7") {
  const loc = path.startsWith("http") ? path : `${SITE_URL}${path}`;
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <lastmod>${xmlEscape(normalizeDate(lastmod))}</lastmod>`,
    `    <priority>${xmlEscape(priority)}</priority>`,
    "  </url>",
  ].join("\n");
}

async function loadPublishedHotelPages(db) {
  const result = await db.prepare(
    `SELECT
       canonical_path,
       updated_at
     FROM hotel_public_pages
     WHERE is_published = 1
       AND canonical_path IS NOT NULL
       AND trim(canonical_path) <> ''
     ORDER BY updated_at DESC, canonical_path ASC`
  ).all();

  return result.results || [];
}

export async function onRequestGet(context) {
  const today = "2026-07-22";
  const staticEntries = STATIC_PATHS.map((path) => makeUrlEntry(path, today, path === "/" ? "1.0" : "0.8"));

  let dynamicEntries = [];
  if (context.env?.DB) {
    try {
      const publishedPages = await loadPublishedHotelPages(context.env.DB);
      dynamicEntries = publishedPages.map((page) => makeUrlEntry(page.canonical_path, page.updated_at || today, "0.9"));
    } catch {
      dynamicEntries = [];
    }
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticEntries,
    ...dynamicEntries,
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
