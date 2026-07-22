var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _lib/website-inquiries.js
function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(normalizeText, "normalizeText");
async function ensureColumn(db, tableName, columnName, definition) {
  const columns = await db.prepare(`PRAGMA table_info(${tableName})`).all();
  const hasColumn = (columns.results || []).some((column) => String(column.name || "") === columnName);
  if (!hasColumn) {
    await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}
__name(ensureColumn, "ensureColumn");
async function ensureWebsiteInquiryTable(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS hotel_public_inquiries (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        hotel_id TEXT NOT NULL,
        public_page_id TEXT,
        public_page_slug TEXT,
        hotel_name_snapshot TEXT,
        page_title_snapshot TEXT,
        guest_name TEXT NOT NULL,
        guest_phone TEXT NOT NULL,
        check_in_date TEXT,
        check_out_date TEXT,
        total_persons INTEGER,
        requested_room_type TEXT,
        guest_message TEXT NOT NULL,
        inquiry_status TEXT NOT NULL DEFAULT 'new' CHECK (inquiry_status IN ('new', 'reviewed', 'closed')),
        source_path TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
        FOREIGN KEY (public_page_id) REFERENCES hotel_public_pages(id) ON DELETE SET NULL
      )
    `),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_inquiries_hotel_id ON hotel_public_inquiries(hotel_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_inquiries_created_at ON hotel_public_inquiries(created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_hotel_public_inquiries_status ON hotel_public_inquiries(inquiry_status)`)
  ]);
  await ensureColumn(db, "hotel_public_inquiries", "public_page_id", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "public_page_slug", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "hotel_name_snapshot", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "page_title_snapshot", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "check_in_date", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "check_out_date", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "total_persons", "INTEGER");
  await ensureColumn(db, "hotel_public_inquiries", "requested_room_type", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "inquiry_status", "TEXT NOT NULL DEFAULT 'new'");
  await ensureColumn(db, "hotel_public_inquiries", "source_path", "TEXT");
  await ensureColumn(db, "hotel_public_inquiries", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
}
__name(ensureWebsiteInquiryTable, "ensureWebsiteInquiryTable");
function normalizeInquiryPayload(payload) {
  const hotelId = normalizeText(payload.hotel_id).toLowerCase();
  const guestName = normalizeText(payload.guest_name);
  const guestPhone = normalizeText(payload.guest_phone);
  const guestMessage = normalizeText(payload.guest_message || payload.special_request);
  const checkInDate = normalizeText(payload.check_in_date);
  const checkOutDate = normalizeText(payload.check_out_date);
  const totalPersonsValue = Number(payload.total_persons);
  const requestedRoomType = normalizeText(payload.requested_room_type);
  if (!hotelId || !/^[a-z][a-z0-9]{5,63}$/.test(hotelId)) {
    throw new Error("Valid hotel_id is required.");
  }
  if (!guestName) {
    throw new Error("Guest name is required.");
  }
  if (!guestPhone || guestPhone.replace(/[^0-9]/g, "").length < 10) {
    throw new Error("Valid guest mobile number is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate)) {
    throw new Error("Valid check-in date is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
    throw new Error("Valid check-out date is required.");
  }
  if (checkOutDate <= checkInDate) {
    throw new Error("Check-out date must be after check-in date.");
  }
  if (!Number.isFinite(totalPersonsValue) || totalPersonsValue < 1) {
    throw new Error("Valid number of persons is required.");
  }
  if (!requestedRoomType) {
    throw new Error("Room type is required.");
  }
  return {
    hotelId,
    publicPageId: normalizeText(payload.public_page_id) || null,
    publicPageSlug: normalizeText(payload.public_page_slug) || null,
    hotelNameSnapshot: normalizeText(payload.hotel_name_snapshot) || null,
    pageTitleSnapshot: normalizeText(payload.page_title_snapshot) || null,
    guestName,
    guestPhone,
    checkInDate,
    checkOutDate,
    totalPersons: Math.floor(totalPersonsValue),
    requestedRoomType,
    guestMessage: guestMessage || "No special request",
    inquiryStatus: "new",
    sourcePath: normalizeText(payload.source_path) || null
  };
}
__name(normalizeInquiryPayload, "normalizeInquiryPayload");

// api/inquiry.js
function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}
__name(json, "json");
function badRequest(message) {
  return json({ error: message }, { status: 400 });
}
__name(badRequest, "badRequest");
async function onRequestPost(context) {
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
    ).bind(payload.hotelId).first();
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
    ).bind(
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
    ).run();
    if (!result.success) {
      throw new Error("Unable to save inquiry.");
    }
    return json({
      ok: true,
      message: `Inquiry sent to ${page.hotel_name || page.public_title || "the hotel"} successfully.`
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to save inquiry.");
  }
}
__name(onRequestPost, "onRequestPost");
async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type"
    }
  });
}
__name(onRequestOptions, "onRequestOptions");

// _lib/hotel-page.js
var SITE_URL = "https://hotelsinalibaug.in";
var PHOTO_PROXY_BASE = "https://checkin.hotelsinalibaug.in/api/public/hotel-photo";
var DIRECTORY_PAGE_STYLES = `
<style>
body.directory-page{
  margin:0;
  font-family:Segoe UI,Arial,sans-serif;
  background:#f5f7fa;
  color:#173042;
  line-height:1.55;
}
.directory-page *{box-sizing:border-box;}
.directory-page .container{width:min(1120px,calc(100% - 2rem));margin:0 auto;}
.directory-page .site-header,.directory-page .site-footer{background:#0f2436;color:#fff;}
.directory-page .header-inner,.directory-page .footer-grid{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 0;}
.directory-page .footer-grid{align-items:flex-start;flex-wrap:wrap;}
.directory-page .brand,.directory-page .nav a,.directory-page .site-footer a{color:#fff;text-decoration:none;}
.directory-page .brand{font-size:1.25rem;font-weight:700;}
.directory-page .brand span{color:#8fd3e8;}
.directory-page .nav{display:flex;flex-wrap:wrap;gap:1rem;font-size:.95rem;}
.directory-page .page-hero{padding:2.25rem 0 1.5rem;background:linear-gradient(180deg,#eef4f8 0%,#f7f9fb 100%);border-bottom:1px solid #d9e3e8;}
.directory-page .breadcrumbs{font-size:.9rem;color:#5f7280;margin-bottom:.75rem;}
.directory-page .breadcrumbs a{color:#0b6e8a;text-decoration:none;}
.directory-page h1{margin:0 0 .75rem;font-size:clamp(1.45rem,2.4vw,2rem) !important;line-height:1.15;}
.directory-page h2{margin:0 0 .75rem;font-size:1.1rem !important;line-height:1.2;}
.directory-page h3{margin:0 0 .75rem;font-size:.98rem !important;line-height:1.25;}
.directory-page p,.directory-page li,.directory-page input,.directory-page textarea,.directory-page button,.directory-page a{font-size:.92rem !important;}
.directory-page p{margin:.35rem 0 0;max-width:none;}
.directory-page .lead{font-size:.95rem !important;color:#5f7280;max-width:72ch;}
.directory-page .section{padding:1.5rem 0;}
.directory-page .search-panel{display:grid;gap:1rem;padding:1.1rem;margin-top:1rem;}
.directory-page .search-form{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:.85rem;align-items:end;}
.directory-page .field-group{display:grid;gap:.35rem;}
.directory-page .field-group label{font-size:.78rem !important;font-weight:700;color:#385265;text-transform:uppercase;letter-spacing:.06em;}
.directory-page .field-group input,.directory-page .field-group select{width:100%;padding:.78rem .85rem;border:1px solid #d9e3e8;border-radius:12px;background:#fff;color:#173042;}
.directory-page .search-actions{display:flex;gap:.7rem;flex-wrap:wrap;}
.directory-page .results-note{display:flex;flex-wrap:wrap;gap:.65rem;align-items:center;margin-top:1rem;}
.directory-page .results-pill{display:inline-flex;align-items:center;border-radius:999px;background:#eef5fb;color:#29506b;padding:.42rem .78rem;font-size:.8rem !important;font-weight:700;}
.directory-page .pages-grid{display:grid;grid-template-columns:1fr;gap:1rem;}
.directory-page .stay-card,.directory-page .panel,.directory-page .content-card{
  background:#fff;border:1px solid #d9e3e8;border-radius:18px;box-shadow:0 14px 36px rgba(23,48,66,.08);
}
.directory-page .stay-card{display:grid;grid-template-columns:minmax(240px,320px) minmax(0,1fr) minmax(220px,260px);overflow:hidden;}
.directory-page .stay-card-image{position:relative;min-height:100%;background:#dbe8ef;}
.directory-page .stay-card-image img{width:100%;height:100%;min-height:240px;object-fit:cover;display:block;}
.directory-page .stay-card-body{padding:1rem 1.1rem;}
.directory-page .stay-card-actions{display:flex;flex-direction:column;justify-content:space-between;gap:1rem;padding:1rem;border-left:1px solid #d9e3e8;background:#f9fbfd;}
.directory-page .stay-card h3{margin:0;font-size:1.2rem !important;line-height:1.2;}
.directory-page .stay-card p,.directory-page .stay-card .meta,.directory-page .stay-card .button-row{padding-left:0;padding-right:0;}
.directory-page .stay-card .meta-row{display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.65rem;}
.directory-page .stay-card .meta-chip{display:inline-flex;align-items:center;border-radius:999px;background:#eef5fb;color:#29506b;padding:.38rem .7rem;font-size:.78rem !important;font-weight:600;}
.directory-page .stay-card .location-link{display:inline-flex;align-items:center;gap:.35rem;margin-top:.45rem;color:#0b6e8a;text-decoration:none;font-weight:600;}
.directory-page .stay-card .summary{margin-top:.55rem;color:#4f6472;}
.directory-page .stay-card .highlight-list{display:grid;gap:.35rem;margin-top:.8rem;padding:0;list-style:none;}
.directory-page .stay-card .highlight-list li{margin:0;padding-left:0;color:#274556;}
.directory-page .stay-card .action-top{display:grid;gap:.7rem;justify-items:end;text-align:right;}
.directory-page .stay-card .action-bottom{display:grid;gap:.6rem;}
.directory-page .stay-card .action-note{font-size:.8rem !important;color:#5f7280;}
.directory-page .stay-card .badge{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;background:#0f2436;color:#fff;padding:.45rem .7rem;font-size:.78rem !important;font-weight:700;}
.directory-page .stay-card .property-count{font-size:.84rem !important;color:#5f7280;}
.directory-page .stay-card .cta-title{font-size:.92rem !important;font-weight:700;color:#173042;}
.directory-page .meta{font-size:.85rem !important;color:#4f6472;}
.directory-page .button-row{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:1rem;}
.directory-page .button{display:inline-flex;align-items:center;justify-content:center;padding:.78rem .95rem;border-radius:12px;font-size:.86rem !important;font-weight:600;text-decoration:none;border:1px solid transparent;}
.directory-page .button.primary{background:#0f2436;color:#fff;}
.directory-page .button.secondary{background:#fff;color:#173042;border-color:#d9e3e8;}
.directory-page .panel,.directory-page .content-card{padding:1.1rem;}
.directory-page figcaption{font-size:.82rem !important;color:#5f7280;}
.directory-page strong{font-size:inherit !important;}
.directory-page .page-layout,.directory-page .grid-2,.directory-page .content-grid{display:grid;gap:1.25rem;}
.directory-page .page-layout{grid-template-columns:minmax(0,1.4fr) minmax(280px,.8fr);}
.directory-page .grid-2{grid-template-columns:repeat(2,minmax(0,1fr));}
.directory-page .content-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
.directory-page .sidebar{display:grid;gap:1.25rem;}
.directory-page .hero-media{margin:1rem 0 0;}
.directory-page .hero-media img{width:100%;max-height:420px;object-fit:cover;border-radius:18px;}
.directory-page ul{margin:.5rem 0 0;padding-left:1.1rem;}
.directory-page li{margin:.35rem 0;}
.directory-page .faq-item{background:#fff;border:1px solid #d9e3e8;border-radius:16px;padding:1rem;}
.directory-page .map-card iframe{width:100%;}
@media (max-width: 860px){
  .directory-page .header-inner,.directory-page .footer-grid{display:block;}
  .directory-page .nav{margin-top:.75rem;}
  .directory-page .page-layout,.directory-page .grid-2,.directory-page .content-grid{grid-template-columns:1fr;}
  .directory-page .stay-card{grid-template-columns:1fr;}
  .directory-page .stay-card-actions{border-left:0;border-top:1px solid #d9e3e8;}
  .directory-page .stay-card .action-top{justify-items:start;text-align:left;}
  .directory-page .search-form{grid-template-columns:1fr 1fr;}
}
</style>`;
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
__name(escapeHtml, "escapeHtml");
function safeParseJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
__name(safeParseJsonArray, "safeParseJsonArray");
function categoryLabel(category) {
  switch (category) {
    case "resort":
      return "Resort";
    case "hotel":
      return "Hotel";
    case "cottage":
      return "Cottage";
    case "homestay":
      return "Homestay";
    default:
      return "Stay";
  }
}
__name(categoryLabel, "categoryLabel");
function categoryDescription(category) {
  switch (category) {
    case "resort":
      return "Browse beach resorts in Alibaug with direct contact details, maps, and inquiry options.";
    case "hotel":
      return "Browse hotels in Alibaug with room details, amenities, and direct booking inquiry links.";
    case "cottage":
      return "Browse cottages in Alibaug for families, weekend groups, and peaceful local stays.";
    case "homestay":
      return "Browse homestays in Alibaug with location details, amenities, and direct contact options.";
    default:
      return "Browse stays in Alibaug with direct contact details, maps, and inquiry options.";
  }
}
__name(categoryDescription, "categoryDescription");
function categoryPath(category) {
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
__name(categoryPath, "categoryPath");
function buildPhotoUrl(hotelId, photoId) {
  return `${PHOTO_PROXY_BASE}?hotel_id=${encodeURIComponent(hotelId)}&photo_id=${encodeURIComponent(photoId)}`;
}
__name(buildPhotoUrl, "buildPhotoUrl");
function excerpt(value, maxLength = 180) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
}
__name(excerpt, "excerpt");
function renderList(items, emptyText) {
  if (!items.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}
__name(renderList, "renderList");
function normalizeDateInput(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}
__name(normalizeDateInput, "normalizeDateInput");
function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}
__name(normalizePositiveInteger, "normalizePositiveInteger");
function todayIso() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
__name(todayIso, "todayIso");
function addDaysIso(isoDate, days) {
  const date = /* @__PURE__ */ new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
__name(addDaysIso, "addDaysIso");
function parseAvailabilityFilters(searchParams) {
  const checkIn = normalizeDateInput(searchParams?.get("check_in"));
  const checkOut = normalizeDateInput(searchParams?.get("check_out"));
  const rooms = normalizePositiveInteger(searchParams?.get("rooms"), 1);
  const adults = normalizePositiveInteger(searchParams?.get("adults"), 2);
  const children = Math.max(0, Math.floor(Number(searchParams?.get("children") || "0") || 0));
  const hasDateRange = Boolean(checkIn && checkOut && checkOut > checkIn);
  return {
    checkIn,
    checkOut,
    rooms,
    adults,
    children,
    hasDateRange
  };
}
__name(parseAvailabilityFilters, "parseAvailabilityFilters");
function availabilitySummary(filters, resultCount, label) {
  if (!filters.hasDateRange) {
    return `${resultCount} ${label.toLowerCase()}${resultCount === 1 ? "" : "s"} listed`;
  }
  return `${resultCount} ${label.toLowerCase()}${resultCount === 1 ? "" : "s"} available for ${filters.rooms} room${filters.rooms === 1 ? "" : "s"} from ${filters.checkIn} to ${filters.checkOut}`;
}
__name(availabilitySummary, "availabilitySummary");
function renderAvailabilitySearch(category, filters) {
  const actionPath = categoryPath(category);
  const defaultCheckIn = filters.checkIn || todayIso();
  const defaultCheckOut = filters.checkOut || addDaysIso(defaultCheckIn, 1);
  return `
    <article class="panel search-panel">
      <div>
        <h2 style="margin-top:0;">Check Availability</h2>
        <p>Choose dates and rooms to show only properties with vacancy for that stay.</p>
      </div>
      <form class="search-form" method="get" action="${actionPath}">
        <div class="field-group">
          <label for="checkIn">Check-in</label>
          <input id="checkIn" name="check_in" type="date" value="${escapeHtml(defaultCheckIn)}" min="${escapeHtml(todayIso())}">
        </div>
        <div class="field-group">
          <label for="checkOut">Check-out</label>
          <input id="checkOut" name="check_out" type="date" value="${escapeHtml(defaultCheckOut)}" min="${escapeHtml(addDaysIso(todayIso(), 1))}">
        </div>
        <div class="field-group">
          <label for="adults">Adults</label>
          <select id="adults" name="adults">
            ${[1, 2, 3, 4, 5, 6].map((count) => `<option value="${count}" ${filters.adults === count ? "selected" : ""}>${count}</option>`).join("")}
          </select>
        </div>
        <div class="field-group">
          <label for="children">Children</label>
          <select id="children" name="children">
            ${[0, 1, 2, 3, 4].map((count) => `<option value="${count}" ${filters.children === count ? "selected" : ""}>${count}</option>`).join("")}
          </select>
        </div>
        <div class="field-group">
          <label for="rooms">Rooms</label>
          <select id="rooms" name="rooms">
            ${[1, 2, 3, 4, 5].map((count) => `<option value="${count}" ${filters.rooms === count ? "selected" : ""}>${count}</option>`).join("")}
          </select>
        </div>
        <div class="search-actions" style="grid-column:1 / -1;">
          <button class="button primary" type="submit">Search</button>
          <a class="button secondary" href="${actionPath}">Reset</a>
        </div>
      </form>
    </article>
  `;
}
__name(renderAvailabilitySearch, "renderAvailabilitySearch");
function renderFaq(faqItems) {
  if (!faqItems.length) {
    return "";
  }
  return `
    <section class="section">
      <div class="container">
        <h2 class="section-title">Frequently Asked Questions</h2>
        <div class="grid-2">
          ${faqItems.map((item) => `
            <article class="faq-item">
              <h3>${escapeHtml(item.question || "")}</h3>
              <p>${escapeHtml(item.answer || "")}</p>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}
__name(renderFaq, "renderFaq");
function renderNearby(nearbyItems) {
  if (!nearbyItems.length) {
    return "";
  }
  return `
    <section class="section">
      <div class="container">
        <h2 class="section-title">Nearby Places</h2>
        <div class="grid-3">
          ${nearbyItems.map((item) => `
            <article class="content-card">
              <h3>${escapeHtml(item.name || "")}</h3>
              ${item.distance ? `<p><strong>Distance:</strong> ${escapeHtml(item.distance)}</p>` : ""}
              ${item.note ? `<p>${escapeHtml(item.note)}</p>` : ""}
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}
__name(renderNearby, "renderNearby");
function renderPhotoGallery(page) {
  const photos = Array.isArray(page.photos) ? page.photos : [];
  if (!photos.length) {
    return "";
  }
  return `
    <section class="section">
      <div class="container">
        <h2 class="section-title">Photo Gallery</h2>
        <div class="pages-grid">
          ${photos.map((photo) => `
            <figure class="content-card">
              <img
                src="${buildPhotoUrl(page.hotel_id, photo.id)}"
                alt="${escapeHtml(photo.alt_text || page.public_title)}"
                loading="lazy"
                decoding="async"
              >
              ${photo.caption ? `<figcaption>${escapeHtml(photo.caption)}</figcaption>` : ""}
            </figure>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}
__name(renderPhotoGallery, "renderPhotoGallery");
function displayRoomCount(page) {
  const count = Number(page.room_count_display || page.total_rooms || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return "";
  }
  return `${count} room${count === 1 ? "" : "s"}`;
}
__name(displayRoomCount, "displayRoomCount");
function displayBeachDistance(page) {
  if (page.distance_from_beach) {
    return String(page.distance_from_beach);
  }
  if (page.beach_distance_label) {
    return String(page.beach_distance_label);
  }
  const meters = Number(page.beach_distance_meters || 0);
  if (!Number.isFinite(meters) || meters <= 0) {
    return "";
  }
  if (meters < 1e3) {
    return `${meters} m`;
  }
  const km = meters / 1e3;
  return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
}
__name(displayBeachDistance, "displayBeachDistance");
function travelDistanceItems(page) {
  return [
    { label: "Beach Distance", value: displayBeachDistance(page) },
    { label: "Local Bus Stop", value: page.distance_from_local_bus_stop || "" },
    { label: "Alibaug Bus Stand", value: page.distance_from_alibaug_bus_stand || "" },
    { label: "Mandwa Jetty", value: page.distance_from_mandwa_jetty || "" }
  ].filter((item) => item.value);
}
__name(travelDistanceItems, "travelDistanceItems");
function contactDetailItems(page) {
  return [
    { label: "Contact Person", value: page.contact_person_name || "" },
    { label: "Hotel Address", value: addressSummary(page) },
    { label: "Primary Phone", value: page.primary_phone || "" },
    { label: "Secondary Phone", value: page.secondary_phone || "" },
    { label: "WhatsApp", value: page.whatsapp_number || "" },
    { label: "Email", value: page.inquiry_email || "" }
  ].filter((item) => item.value);
}
__name(contactDetailItems, "contactDetailItems");
function addressSummary(page) {
  return [
    page.address_line_1,
    page.address_village,
    page.address_taluka,
    page.address_district,
    page.address_pincode
  ].filter(Boolean).join(", ");
}
__name(addressSummary, "addressSummary");
function buildAutoMapQuery(page) {
  return [page.public_title, addressSummary(page)].filter(Boolean).join(", ");
}
__name(buildAutoMapQuery, "buildAutoMapQuery");
function extractCoordinatesFromGoogleMapUrl(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    const queryValue = url.searchParams.get("query") || url.searchParams.get("q") || "";
    const queryMatch = queryValue.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (queryMatch) {
      return {
        lat: Number(queryMatch[1]),
        lng: Number(queryMatch[2])
      };
    }
    const atMatch = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      return {
        lat: Number(atMatch[1]),
        lng: Number(atMatch[2])
      };
    }
    const dataMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (dataMatch) {
      return {
        lat: Number(dataMatch[1]),
        lng: Number(dataMatch[2])
      };
    }
  } catch {
    return null;
  }
  return null;
}
__name(extractCoordinatesFromGoogleMapUrl, "extractCoordinatesFromGoogleMapUrl");
function hasSavedCoordinates(page) {
  const latitude = Number(page.latitude);
  const longitude = Number(page.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}
__name(hasSavedCoordinates, "hasSavedCoordinates");
function resolvedMapPlaceUrl(page) {
  if (page.google_maps_place_url) {
    return String(page.google_maps_place_url);
  }
  if (hasSavedCoordinates(page)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${page.latitude},${page.longitude}`)}`;
  }
  const query = buildAutoMapQuery(page);
  if (!query) {
    return "";
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
__name(resolvedMapPlaceUrl, "resolvedMapPlaceUrl");
function resolvedMapEmbedUrl(page) {
  const linkCoordinates = extractCoordinatesFromGoogleMapUrl(page.google_maps_place_url);
  if (linkCoordinates) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${linkCoordinates.lat},${linkCoordinates.lng}`)}&output=embed`;
  }
  if (hasSavedCoordinates(page)) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${page.latitude},${page.longitude}`)}&output=embed`;
  }
  if (page.google_maps_embed_url) {
    return String(page.google_maps_embed_url);
  }
  const query = buildAutoMapQuery(page);
  if (!query) {
    return "";
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}
__name(resolvedMapEmbedUrl, "resolvedMapEmbedUrl");
function hotelJsonLd(page, canonicalUrl, heroImageUrl, faqItems) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: page.public_title,
    description: page.meta_description,
    url: canonicalUrl,
    image: heroImageUrl,
    telephone: page.primary_phone || void 0,
    email: page.inquiry_email || void 0,
    address: {
      "@type": "PostalAddress",
      streetAddress: page.address_line_1 || void 0,
      addressLocality: page.address_village || void 0,
      addressRegion: page.address_district || void 0,
      postalCode: page.address_pincode || void 0,
      addressCountry: "IN"
    }
  };
  if (hasSavedCoordinates(page)) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: Number(page.latitude),
      longitude: Number(page.longitude)
    };
  }
  const blocks = [JSON.stringify(data)];
  if (faqItems.length) {
    blocks.push(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question || "",
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer || ""
          }
        }))
      })
    );
  }
  blocks.push(
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: categoryLabel(page.category), item: `${SITE_URL}${page.canonical_path.split("/").slice(0, 2).join("/")}` },
        { "@type": "ListItem", position: 3, name: page.public_title, item: canonicalUrl }
      ]
    })
  );
  return blocks.map((block) => `<script type="application/ld+json">${block}<\/script>`).join("\n");
}
__name(hotelJsonLd, "hotelJsonLd");
function renderHtml(page) {
  const canonicalPath = page.canonical_path || `/${page.category}/${page.slug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const photos = Array.isArray(page.photos) ? page.photos : [];
  const coverPhoto = photos.find((photo) => Number(photo.is_cover) === 1) || photos[0] || null;
  const heroImageUrl = coverPhoto ? buildPhotoUrl(page.hotel_id, coverPhoto.id) : `${SITE_URL}/assets/images/alibaug-coastline.webp`;
  const amenities = safeParseJsonArray(page.amenities_json);
  const roomTypes = safeParseJsonArray(page.room_types_json);
  const faqItems = safeParseJsonArray(page.faq_json);
  const nearbyItems = safeParseJsonArray(page.nearby_places_json);
  const policies = safeParseJsonArray(page.policies_json);
  const roomCountLabel = displayRoomCount(page);
  const travelDistances = travelDistanceItems(page);
  const contactDetails = contactDetailItems(page);
  const mapPlaceUrl = resolvedMapPlaceUrl(page);
  const mapEmbedUrl = resolvedMapEmbedUrl(page);
  const fullAddress = addressSummary(page);
  const roomTypeOptions = roomTypes.length ? roomTypes.map((item) => `<option value="${escapeHtml(String(item || ""))}">${escapeHtml(String(item || ""))}</option>`).join("") : `<option value="Standard Room">Standard Room</option><option value="Deluxe Room">Deluxe Room</option><option value="Family Room">Family Room</option>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.meta_title)}</title>
<meta name="description" content="${escapeHtml(page.meta_description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(page.meta_title)}">
<meta property="og:description" content="${escapeHtml(page.meta_description)}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Hotels In Alibaug">
<meta property="og:image" content="${heroImageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(page.meta_title)}">
<meta name="twitter:description" content="${escapeHtml(page.meta_description)}">
<meta name="twitter:image" content="${heroImageUrl}">
${DIRECTORY_PAGE_STYLES}
${hotelJsonLd(page, canonicalUrl, heroImageUrl, faqItems)}
</head>
<body class="directory-page">
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/">Hotels<span>In</span>Alibaug</a>
    <nav class="nav">
      <a href="/hotels">Hotels</a>
      <a href="/resorts">Resorts</a>
      <a href="/cottages">Cottages</a>
      <a href="/homestays">Homestays</a>
      <a href="/alibaug-travel-guide.html">Travel Guide</a>
      <a href="/hotel-guest-checkin-app-alibaug.html">Hotel App</a>
      <a href="/contact.html">Contact</a>
    </nav>
  </div>
</header>

<main>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumbs">
        <a href="/">Home</a> / <a href="${categoryPath(page.category)}">${escapeHtml(categoryLabel(page.category))}</a> / ${escapeHtml(page.public_title)}
      </div>
      <h1>${escapeHtml(page.hero_heading || page.public_title)}</h1>
      <p class="lead">${escapeHtml(page.hero_subheading || page.short_description)}</p>
      <figure class="hero-media">
        <img src="${heroImageUrl}" alt="${escapeHtml(coverPhoto?.alt_text || page.public_title)}" loading="eager" decoding="async">
        ${coverPhoto?.caption ? `<figcaption>${escapeHtml(coverPhoto.caption)}</figcaption>` : ""}
      </figure>
      <div class="button-row">
        ${page.primary_phone ? `<a class="button primary" href="tel:${escapeHtml(page.primary_phone)}">Call Now</a>` : ""}
        ${mapPlaceUrl ? `<a class="button secondary" href="${escapeHtml(mapPlaceUrl)}" target="_blank" rel="noopener noreferrer">Open Map</a>` : ""}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container page-layout">
      <article class="panel">
        <h2>About ${escapeHtml(page.public_title)}</h2>
        <p>${escapeHtml(page.full_description)}</p>
      </article>

      <aside class="sidebar">
        <div class="panel">
          <h3>Quick Facts</h3>
          <ul>
            <li><strong>Category:</strong> ${escapeHtml(categoryLabel(page.category))}</li>
            ${roomCountLabel ? `<li><strong>Rooms:</strong> ${escapeHtml(roomCountLabel)}</li>` : ""}
            ${travelDistances.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</li>`).join("")}
            ${page.check_in_time ? `<li><strong>Check-in:</strong> ${escapeHtml(page.check_in_time)}</li>` : ""}
            ${page.check_out_time ? `<li><strong>Check-out:</strong> ${escapeHtml(page.check_out_time)}</li>` : ""}
            ${page.address_village ? `<li><strong>Village:</strong> ${escapeHtml(page.address_village)}</li>` : ""}
            ${page.address_taluka ? `<li><strong>Taluka:</strong> ${escapeHtml(page.address_taluka)}</li>` : ""}
          </ul>
        </div>
      </aside>
    </div>
  </section>

  <section class="section">
    <div class="container content-grid">
      <article class="content-card">
        <h3>Room Types</h3>
        ${roomCountLabel ? `<p><strong>Total Rooms:</strong> ${escapeHtml(roomCountLabel)}</p>` : ""}
        ${renderList(roomTypes, "Room type details will be updated soon.")}
      </article>
      <article class="content-card">
        <h3>Amenities</h3>
        ${renderList(amenities, "Amenities will be updated soon.")}
      </article>
      <article class="content-card">
        <h3>Policies</h3>
        ${renderList(policies, "Policies will be updated soon.")}
      </article>
    </div>
  </section>

  ${renderPhotoGallery(page)}
  ${renderNearby(nearbyItems)}
  ${renderFaq(faqItems)}

  <section class="section">
    <div class="container grid-2">
      <article class="panel">
        <h2 style="margin-top:0;">Contact Details</h2>
        ${contactDetails.length ? `
          <ul>
            ${contactDetails.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</li>`).join("")}
          </ul>
        ` : "<p>Contact details will be updated soon.</p>"}
        <div class="button-row" style="padding-left:0;padding-right:0;">
          ${page.primary_phone ? `<a class="button primary" href="tel:${escapeHtml(page.primary_phone)}">Call Hotel</a>` : ""}
          ${page.whatsapp_number ? `<a class="button secondary" href="https://wa.me/${escapeHtml(String(page.whatsapp_number).replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}
          ${page.inquiry_email ? `<a class="button secondary" href="mailto:${escapeHtml(page.inquiry_email)}">Email</a>` : ""}
        </div>
      </article>
      <article id="location" class="panel">
        <h2 style="margin-top:0;">Location Map</h2>
        ${fullAddress ? `<p>${escapeHtml(fullAddress)}</p>` : "<p>Address will be updated soon.</p>"}
        ${mapEmbedUrl ? `
          <div class="map-card" style="margin-top:1rem;">
            <iframe
              src="${escapeHtml(mapEmbedUrl)}"
              width="100%"
              height="320"
              style="border:0;border-radius:14px;"
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              allowfullscreen
            ></iframe>
          </div>
        ` : ""}
        ${mapPlaceUrl ? `<div class="button-row" style="padding-left:0;padding-right:0;"><a class="button secondary" href="${escapeHtml(mapPlaceUrl)}" target="_blank" rel="noopener noreferrer">Open In Google Maps</a></div>` : ""}
      </article>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <article class="panel">
        <h2 style="margin-top:0;">Send Inquiry</h2>
        <p>Send your inquiry directly to the hotel. The request is saved in the hotel dashboard for follow-up.</p>
        <form id="inquiryForm" data-hotel-id="${escapeHtml(page.hotel_id || "")}" data-page-id="${escapeHtml(page.id || "")}" data-slug="${escapeHtml(page.slug || "")}" data-title="${escapeHtml(page.public_title)}">
          <div style="display:grid;gap:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <input id="inqCheckIn" type="date" style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;">
              <input id="inqCheckOut" type="date" style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <input id="inqPersons" type="number" min="1" value="2" placeholder="No. of persons" style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;">
              <select id="inqRoomType" style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;">
                <option value="">Select room type</option>
                ${roomTypeOptions}
              </select>
            </div>
            <input id="inqName" type="text" placeholder="Name of person" style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;">
            <input id="inqPhone" type="tel" placeholder="Mobile number" style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;">
            <textarea id="inqMessage" rows="3" placeholder="Special request (optional)" style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;"></textarea>
            <button class="button primary" type="submit">Send Inquiry</button>
            <p id="inquiryStatus" style="display:none;margin:0;padding:12px;border-radius:14px;border:1px solid #d9e3e8;background:#f8fafc;color:#3a5160;"></p>
          </div>
        </form>
      </article>
    </div>
  </section>
</main>

<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <h3>${escapeHtml(page.public_title)}</h3>
      <p>${escapeHtml(page.short_description)}</p>
    </div>
    <div>
      <h3>Explore More</h3>
      <ul>
        <li><a href="/best-hotels-in-alibaug.html">Hotels in Alibaug</a></li>
        <li><a href="/resorts">Browse Resorts</a></li>
        <li><a href="/hotels">Browse Hotels</a></li>
        <li><a href="/cottages">Browse Cottages</a></li>
        <li><a href="/homestays">Browse Homestays</a></li>
        <li><a href="/alibaug-travel-guide.html">Alibaug Travel Guide</a></li>
      </ul>
    </div>
  </div>
</footer>

<script>
  document.getElementById("inquiryForm")?.addEventListener("submit", function (event) {
    event.preventDefault();
    const checkInDate = document.getElementById("inqCheckIn")?.value?.trim() || "";
    const checkOutDate = document.getElementById("inqCheckOut")?.value?.trim() || "";
    const totalPersons = document.getElementById("inqPersons")?.value?.trim() || "";
    const requestedRoomType = document.getElementById("inqRoomType")?.value?.trim() || "";
    const name = document.getElementById("inqName")?.value?.trim() || "";
    const phone = document.getElementById("inqPhone")?.value?.trim() || "";
    const message = document.getElementById("inqMessage")?.value?.trim() || "";
    const hotelId = this.dataset.hotelId || "";
    const publicPageId = this.dataset.pageId || "";
    const slug = this.dataset.slug || "";
    const title = this.dataset.title || "hotel stay";
    const status = document.getElementById("inquiryStatus");
    const button = this.querySelector("button[type='submit']");
    if (!checkInDate || !checkOutDate || !totalPersons || !requestedRoomType || !name || !phone) {
      if (status) {
        status.style.display = "block";
        status.textContent = "Please fill check-in, check-out, persons, room type, name, and mobile number.";
      }
      return;
    }
    if (status) {
      status.style.display = "block";
      status.textContent = "Sending inquiry...";
    }
    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }
    fetch("/api/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hotel_id: hotelId,
        public_page_id: publicPageId,
        public_page_slug: slug,
        page_title_snapshot: title,
        hotel_name_snapshot: title,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        total_persons: totalPersons,
        requested_room_type: requestedRoomType,
        guest_name: name,
        guest_phone: phone,
        guest_message: message,
        source_path: window.location.pathname,
      }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Unable to send inquiry.");
        }
        document.getElementById("inqCheckIn").value = "";
        document.getElementById("inqCheckOut").value = "";
        document.getElementById("inqPersons").value = "2";
        document.getElementById("inqRoomType").value = "";
        document.getElementById("inqName").value = "";
        document.getElementById("inqPhone").value = "";
        document.getElementById("inqMessage").value = "";
        if (status) {
          status.textContent = data.message || ("Inquiry sent to " + title + " successfully.");
        }
      })
      .catch((error) => {
        if (status) {
          status.textContent = error.message || "Unable to send inquiry.";
        }
      })
      .finally(() => {
        if (button) {
          button.disabled = false;
          button.textContent = "Send Inquiry";
        }
      });
  });
<\/script>
</body>
</html>`;
}
__name(renderHtml, "renderHtml");
async function fetchPublishedHotelPage(env, category, slug) {
  const page = await env.DB.prepare(
    `SELECT
       hpp.*,
       h.name AS hotel_name
     FROM hotel_public_pages hpp
     INNER JOIN hotels h
       ON lower(h.id) = lower(hpp.hotel_id)
     WHERE hpp.category = ?1
       AND lower(hpp.slug) = lower(?2)
       AND hpp.is_published = 1
     LIMIT 1`
  ).bind(category, slug).first();
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
       is_active
     FROM hotel_public_page_photos
     WHERE public_page_id = ?1
       AND is_active = 1
     ORDER BY is_cover DESC, photo_order ASC, created_at ASC`
  ).bind(page.id).all();
  return {
    ...page,
    photos: photos.results || []
  };
}
__name(fetchPublishedHotelPage, "fetchPublishedHotelPage");
function hotelPageResponse(page) {
  return new Response(renderHtml(page), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
__name(hotelPageResponse, "hotelPageResponse");
async function reservationTableExists(db) {
  const table = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'hotel_future_reservations' LIMIT 1").first().catch(() => null);
  return Boolean(table?.name);
}
__name(reservationTableExists, "reservationTableExists");
async function fetchAvailabilityMap(db, filters) {
  if (!filters.hasDateRange) {
    return /* @__PURE__ */ new Map();
  }
  const activeStayResults = await db.prepare(
    `SELECT
       lower(hotel_id) AS hotel_id,
       COUNT(DISTINCT lower(trim(room_number))) AS occupied_rooms
     FROM guests
     WHERE room_number IS NOT NULL
       AND trim(room_number) <> ''
       AND substr(check_in_time, 1, 10) < ?1
       AND COALESCE(substr(check_out_time, 1, 10), expected_check_out_date, '9999-12-31') > ?2
     GROUP BY lower(hotel_id)`
  ).bind(filters.checkOut, filters.checkIn).all();
  const map = /* @__PURE__ */ new Map();
  for (const row of activeStayResults.results || []) {
    map.set(String(row.hotel_id || "").toLowerCase(), {
      occupiedRooms: Number(row.occupied_rooms || 0),
      reservedRooms: 0
    });
  }
  if (await reservationTableExists(db)) {
    const reservationResults = await db.prepare(
      `SELECT
         lower(hotel_id) AS hotel_id,
         SUM(COALESCE(room_count, 1)) AS reserved_rooms
       FROM hotel_future_reservations
       WHERE check_in_date < ?1
         AND check_out_date > ?2
       GROUP BY lower(hotel_id)`
    ).bind(filters.checkOut, filters.checkIn).all();
    for (const row of reservationResults.results || []) {
      const hotelId = String(row.hotel_id || "").toLowerCase();
      const entry = map.get(hotelId) || { occupiedRooms: 0, reservedRooms: 0 };
      entry.reservedRooms = Number(row.reserved_rooms || 0);
      map.set(hotelId, entry);
    }
  }
  return map;
}
__name(fetchAvailabilityMap, "fetchAvailabilityMap");
async function fetchPublishedCategoryPages(env, category, filters = { hasDateRange: false, rooms: 1, adults: 2, children: 0 }) {
  const result = await env.DB.prepare(
    `SELECT
       hpp.id,
       hpp.hotel_id,
       hpp.category,
       hpp.slug,
       hpp.public_title,
       hpp.meta_title,
       hpp.meta_description,
       hpp.short_description,
       hpp.amenities_json,
       hpp.room_count_display,
       hpp.distance_from_beach,
       hpp.distance_from_local_bus_stop,
       hpp.distance_from_alibaug_bus_stand,
       hpp.distance_from_mandwa_jetty,
       hpp.beach_distance_meters,
       hpp.beach_distance_label,
       hpp.address_village,
       hpp.address_taluka,
       hpp.address_district,
       hpp.primary_phone,
       hpp.whatsapp_number,
       hpp.google_maps_place_url,
       hpp.canonical_path,
       hpp.sort_order,
       h.name AS hotel_name,
       h.total_rooms,
       (
         SELECT p.id
         FROM hotel_public_page_photos p
         WHERE p.public_page_id = hpp.id
           AND p.is_active = 1
         ORDER BY p.is_cover DESC, p.photo_order ASC, p.created_at ASC
         LIMIT 1
       ) AS cover_photo_id
     FROM hotel_public_pages hpp
     INNER JOIN hotels h
       ON lower(h.id) = lower(hpp.hotel_id)
     WHERE hpp.category = ?1
       AND hpp.is_published = 1
     ORDER BY hpp.sort_order ASC, hpp.updated_at DESC, hpp.public_title ASC`
  ).bind(category).all();
  const pages = result.results || [];
  if (!filters.hasDateRange) {
    return pages;
  }
  const availabilityMap = await fetchAvailabilityMap(env.DB, filters);
  return pages.map((page) => {
    const hotelId = String(page.hotel_id || "").toLowerCase();
    const availability = availabilityMap.get(hotelId) || { occupiedRooms: 0, reservedRooms: 0 };
    const totalRooms = Number(page.total_rooms || page.room_count_display || 0);
    const blockedRooms = availability.occupiedRooms + availability.reservedRooms;
    const availableRooms = Math.max(0, totalRooms - blockedRooms);
    return {
      ...page,
      available_rooms: availableRooms,
      blocked_rooms: blockedRooms
    };
  }).filter((page) => Number(page.available_rooms || 0) >= filters.rooms);
}
__name(fetchPublishedCategoryPages, "fetchPublishedCategoryPages");
function renderCategoryHtml(category, pages, filters) {
  const label = categoryLabel(category);
  const canonicalPath = categoryPath(category);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const title = `${label}s In Alibaug | Hotels In Alibaug`;
  const description = categoryDescription(category);
  const countLabel = availabilitySummary(filters, pages.length, label);
  const cards = pages.map((page) => {
    const imageUrl = page.cover_photo_id ? buildPhotoUrl(page.hotel_id, page.cover_photo_id) : `${SITE_URL}/assets/images/alibaug-coastline.webp`;
    const location = [page.address_village, page.address_taluka, page.address_district].filter(Boolean).join(", ");
    const roomCount = displayRoomCount(page);
    const beachDistance = displayBeachDistance(page);
    const amenities = safeParseJsonArray(page.amenities_json).slice(0, 4);
    const amenityChips = amenities.map((item) => `<span class="meta-chip">${escapeHtml(item)}</span>`).join("");
    const highlights = [
      roomCount ? `${roomCount} available for listing` : "",
      beachDistance ? `${beachDistance} from the beach` : "",
      location ? location : ""
    ].filter(Boolean);
    const href = page.canonical_path || `${canonicalPath}/${page.slug}`;
    const availabilityText = filters.hasDateRange ? `${Number(page.available_rooms || 0)} room${Number(page.available_rooms || 0) === 1 ? "" : "s"} available for selected dates` : "Open the full page for photos, location map, contact details, and inquiry form.";
    return `
      <article class="stay-card">
        <div class="stay-card-image">
          <img src="${imageUrl}" alt="${escapeHtml(page.public_title)}" loading="lazy" decoding="async">
        </div>
        <div class="stay-card-body">
          <h3><a href="${href}" style="color:inherit;text-decoration:none;">${escapeHtml(page.public_title)}</a></h3>
          ${location ? `<a class="location-link" href="${href}#location">\u{1F4CD} ${escapeHtml(location)}</a>` : ""}
          <p class="summary">${escapeHtml(excerpt(page.short_description || page.meta_description, 220))}</p>
          ${amenityChips ? `<div class="meta-row">${amenityChips}</div>` : ""}
          ${highlights.length ? `<ul class="highlight-list">${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        </div>
        <div class="stay-card-actions">
          <div class="action-top">
            <span class="badge">Direct Hotel Contact</span>
            <span class="property-count">Hotels In Alibaug listing</span>
          </div>
          <div class="action-bottom">
            <div class="cta-title">Check availability at ${escapeHtml(page.public_title)}</div>
            <div class="action-note">${escapeHtml(availabilityText)}</div>
            <a class="button primary" href="${href}">See Availability</a>
            ${page.primary_phone ? `<a class="button secondary" href="tel:${escapeHtml(page.primary_phone)}">Call Hotel</a>` : ""}
            ${page.whatsapp_number ? `<a class="button secondary" href="https://wa.me/${escapeHtml(String(page.whatsapp_number).replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Hotels In Alibaug">
<meta property="og:image" content="${SITE_URL}/assets/images/alibaug-coastline.webp">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${SITE_URL}/assets/images/alibaug-coastline.webp">
${DIRECTORY_PAGE_STYLES}
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonicalUrl
  })}<\/script>
</head>
<body class="directory-page">
<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="/">Hotels<span>In</span>Alibaug</a>
    <nav class="nav">
      <a href="/hotels">Hotels</a>
      <a href="/resorts">Resorts</a>
      <a href="/cottages">Cottages</a>
      <a href="/homestays">Homestays</a>
    </nav>
  </div>
</header>

<main>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumbs">
        <a href="/">Home</a> / ${escapeHtml(label)}s
      </div>
      <h1>${escapeHtml(label)}s In Alibaug</h1>
      <p class="lead">${escapeHtml(description)}</p>
      <div class="results-note">
        <span class="results-pill">${escapeHtml(countLabel)}</span>
        ${filters.hasDateRange ? `<span class="results-pill">${escapeHtml(`${filters.adults} adults \u2022 ${filters.children} children \u2022 ${filters.rooms} room${filters.rooms === 1 ? "" : "s"}`)}</span>` : ""}
      </div>
      ${renderAvailabilitySearch(category, filters)}
    </div>
  </section>

  <section class="section">
    <div class="container">
      ${pages.length ? `
        <div class="pages-grid">
          ${cards}
        </div>
      ` : `
        <article class="panel">
          <h2>No published ${escapeHtml(label.toLowerCase())} pages yet</h2>
          <p>${filters.hasDateRange ? `No ${label.toLowerCase()} matched the selected dates and room count right now.` : `Superadmin can publish hotel website pages from the CHECKIN admin panel. Once published, they will appear here automatically.`}</p>
        </article>
      `}
    </div>
  </section>

  <section class="section">
    <div class="container">
      <article class="panel">
        <h2 style="margin-top:0;">Direct Hotel Enquiries</h2>
        <p>Open any listing above to check availability, call the property, or send a direct inquiry to the hotel.</p>
      </article>
    </div>
  </section>
</main>

<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <h3>Hotels In Alibaug</h3>
      <p>Simple hotel directory pages with direct hotel contact options.</p>
    </div>
    <div>
      <h3>Directory</h3>
      <ul>
        <li><a href="/hotels">Hotels</a></li>
        <li><a href="/resorts">Resorts</a></li>
        <li><a href="/cottages">Cottages</a></li>
        <li><a href="/homestays">Homestays</a></li>
      </ul>
    </div>
  </div>
</footer>
</body>
</html>`;
}
__name(renderCategoryHtml, "renderCategoryHtml");
function categoryPageResponse(category, pages, filters = { hasDateRange: false, rooms: 1, adults: 2, children: 0 }) {
  return new Response(renderCategoryHtml(category, pages, filters), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
__name(categoryPageResponse, "categoryPageResponse");

// cottages/[slug].js
async function onRequestGet(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for cottage detail page.", { status: 500 });
    }
    const slug = context.params.slug;
    const page = await fetchPublishedHotelPage(context.env, "cottage", slug);
    if (!page) {
      return new Response("Cottage page not found", { status: 404 });
    }
    return hotelPageResponse(page);
  } catch (error) {
    return new Response(`Website error in cottage detail page: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
__name(onRequestGet, "onRequestGet");

// homestays/[slug].js
async function onRequestGet2(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for homestay detail page.", { status: 500 });
    }
    const slug = context.params.slug;
    const page = await fetchPublishedHotelPage(context.env, "homestay", slug);
    if (!page) {
      return new Response("Homestay page not found", { status: 404 });
    }
    return hotelPageResponse(page);
  } catch (error) {
    return new Response(`Website error in homestay detail page: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
__name(onRequestGet2, "onRequestGet");

// hotels/[slug].js
async function onRequestGet3(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for hotel detail page.", { status: 500 });
    }
    const slug = context.params.slug;
    const page = await fetchPublishedHotelPage(context.env, "hotel", slug);
    if (!page) {
      return new Response("Hotel page not found", { status: 404 });
    }
    return hotelPageResponse(page);
  } catch (error) {
    return new Response(`Website error in hotel detail page: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
__name(onRequestGet3, "onRequestGet");

// resorts/[slug].js
async function onRequestGet4(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for resort detail page.", { status: 500 });
    }
    const slug = context.params.slug;
    const page = await fetchPublishedHotelPage(context.env, "resort", slug);
    if (!page) {
      return new Response("Resort page not found", { status: 404 });
    }
    return hotelPageResponse(page);
  } catch (error) {
    return new Response(`Website error in resort detail page: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
__name(onRequestGet4, "onRequestGet");

// cottages/index.js
async function onRequestGet5(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for cottages directory.", { status: 500 });
    }
    const filters = parseAvailabilityFilters(new URL(context.request.url).searchParams);
    const pages = await fetchPublishedCategoryPages(context.env, "cottage", filters);
    return categoryPageResponse("cottage", pages, filters);
  } catch (error) {
    return new Response(`Website error in cottages directory: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
__name(onRequestGet5, "onRequestGet");

// homestays/index.js
async function onRequestGet6(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for homestays directory.", { status: 500 });
    }
    const filters = parseAvailabilityFilters(new URL(context.request.url).searchParams);
    const pages = await fetchPublishedCategoryPages(context.env, "homestay", filters);
    return categoryPageResponse("homestay", pages, filters);
  } catch (error) {
    return new Response(`Website error in homestays directory: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
__name(onRequestGet6, "onRequestGet");

// hotels/index.js
async function onRequestGet7(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for hotels directory.", { status: 500 });
    }
    const filters = parseAvailabilityFilters(new URL(context.request.url).searchParams);
    const pages = await fetchPublishedCategoryPages(context.env, "hotel", filters);
    return categoryPageResponse("hotel", pages, filters);
  } catch (error) {
    return new Response(`Website error in hotels directory: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
__name(onRequestGet7, "onRequestGet");

// resorts/index.js
async function onRequestGet8(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for resorts directory.", { status: 500 });
    }
    const filters = parseAvailabilityFilters(new URL(context.request.url).searchParams);
    const pages = await fetchPublishedCategoryPages(context.env, "resort", filters);
    return categoryPageResponse("resort", pages, filters);
  } catch (error) {
    return new Response(`Website error in resorts directory: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
__name(onRequestGet8, "onRequestGet");

// sitemap.xml.js
var SITE_URL2 = "https://hotelsinalibaug.in";
var STATIC_PATHS = [
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
  "/hotel-guest-checkin-app-alibaug.html"
];
function xmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
__name(xmlEscape, "xmlEscape");
function normalizeDate(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "2026-07-22";
}
__name(normalizeDate, "normalizeDate");
function makeUrlEntry(path, lastmod, priority = "0.7") {
  const loc = path.startsWith("http") ? path : `${SITE_URL2}${path}`;
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <lastmod>${xmlEscape(normalizeDate(lastmod))}</lastmod>`,
    `    <priority>${xmlEscape(priority)}</priority>`,
    "  </url>"
  ].join("\n");
}
__name(makeUrlEntry, "makeUrlEntry");
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
__name(loadPublishedHotelPages, "loadPublishedHotelPages");
async function onRequestGet9(context) {
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
    "</urlset>"
  ].join("\n");
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
}
__name(onRequestGet9, "onRequestGet");

// ../../.wrangler/tmp/pages-AVAImT/functionsRoutes-0.9333326453980537.mjs
var routes = [
  {
    routePath: "/api/inquiry",
    mountPath: "/api",
    method: "OPTIONS",
    middlewares: [],
    modules: [onRequestOptions]
  },
  {
    routePath: "/api/inquiry",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/cottages/:slug",
    mountPath: "/cottages",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/homestays/:slug",
    mountPath: "/homestays",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/hotels/:slug",
    mountPath: "/hotels",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/resorts/:slug",
    mountPath: "/resorts",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/cottages",
    mountPath: "/cottages",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/homestays",
    mountPath: "/homestays",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/hotels",
    mountPath: "/hotels",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/resorts",
    mountPath: "/resorts",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/sitemap.xml",
    mountPath: "/",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  }
];

// ../../../Users/gjpat/AppData/Local/nvm/v20.18.1/node_modules/wrangler/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../Users/gjpat/AppData/Local/nvm/v20.18.1/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
