const SITE_URL = "https://hotelsinalibaug.in";
const PHOTO_PROXY_BASE = "https://checkin.hotelsinalibaug.in/api/public/hotel-photo";
const DIRECTORY_PAGE_STYLES = `
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
.directory-page .stay-card,.directory-page .panel,.directory-page .content-card{
  transform:translateZ(0);box-shadow:0 7px 0 rgba(23,48,66,.12),0 20px 38px rgba(23,48,66,.14);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease;
}
.directory-page .stay-card:hover,.directory-page .panel:hover,.directory-page .content-card:hover{
  transform:translateY(-5px) translateZ(0);box-shadow:0 11px 0 rgba(23,48,66,.12),0 30px 46px rgba(23,48,66,.2);
}
@media (prefers-reduced-motion:reduce){.directory-page .stay-card,.directory-page .panel,.directory-page .content-card{transition:none}.directory-page .stay-card:hover,.directory-page .panel:hover,.directory-page .content-card:hover{transform:translateZ(0)}}
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
.directory-page .button{display:inline-flex;align-items:center;justify-content:center;padding:.78rem .95rem;border-radius:12px;font-size:.86rem !important;font-weight:600;text-decoration:none;border:1px solid transparent;box-shadow:0 5px 0 rgba(15,36,54,.3),0 10px 18px rgba(15,36,54,.14);transition:transform .16s ease,box-shadow .16s ease,filter .16s ease;}
.directory-page .button:hover{transform:translateY(-2px);filter:brightness(1.05);box-shadow:0 7px 0 rgba(15,36,54,.3),0 15px 24px rgba(15,36,54,.2);}
.directory-page .button:active{transform:translateY(4px) scale(.985);filter:brightness(.96);box-shadow:0 1px 0 rgba(15,36,54,.3),0 3px 8px rgba(15,36,54,.14);}
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
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeParseJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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

function buildPhotoUrl(hotelId, photoId) {
  return `${PHOTO_PROXY_BASE}?hotel_id=${encodeURIComponent(hotelId)}&photo_id=${encodeURIComponent(photoId)}`;
}

function excerpt(value, maxLength = 180) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function renderList(items, emptyText) {
  if (!items.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function normalizeDateInput(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseAvailabilityFilters(searchParams) {
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
    hasDateRange,
  };
}

function availabilitySummary(filters, resultCount, label) {
  if (!filters.hasDateRange) {
    return `${resultCount} ${label.toLowerCase()}${resultCount === 1 ? "" : "s"} listed`;
  }

  return `${resultCount} ${label.toLowerCase()}${resultCount === 1 ? "" : "s"} available for ${filters.rooms} room${filters.rooms === 1 ? "" : "s"} from ${filters.checkIn} to ${filters.checkOut}`;
}

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

function displayRoomCount(page) {
  const count = Number(page.room_count_display || page.total_rooms || 0);
  if (!Number.isFinite(count) || count <= 0) {
    return "";
  }
  return `${count} room${count === 1 ? "" : "s"}`;
}

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
  if (meters < 1000) {
    return `${meters} m`;
  }
  const km = meters / 1000;
  return Number.isInteger(km) ? `${km} km` : `${km.toFixed(1)} km`;
}

function travelDistanceItems(page) {
  return [
    { label: "Beach Distance", value: displayBeachDistance(page) },
    { label: "Local Bus Stop", value: page.distance_from_local_bus_stop || "" },
    { label: "Alibaug Bus Stand", value: page.distance_from_alibaug_bus_stand || "" },
    { label: "Mandwa Jetty", value: page.distance_from_mandwa_jetty || "" },
  ].filter((item) => item.value);
}

function contactDetailItems(page) {
  return [
    { label: "Contact Person", value: page.contact_person_name || "" },
    { label: "Hotel Address", value: addressSummary(page) },
    { label: "Primary Phone", value: page.primary_phone || "" },
    { label: "Secondary Phone", value: page.secondary_phone || "" },
    { label: "WhatsApp", value: page.whatsapp_number || "" },
    { label: "Email", value: page.inquiry_email || "" },
  ].filter((item) => item.value);
}

function addressSummary(page) {
  return [
    page.address_line_1,
    page.address_village,
    page.address_taluka,
    page.address_district,
    page.address_pincode,
  ].filter(Boolean).join(", ");
}

function buildAutoMapQuery(page) {
  return [page.public_title, addressSummary(page)].filter(Boolean).join(", ");
}

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
        lng: Number(queryMatch[2]),
      };
    }

    const atMatch = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      return {
        lat: Number(atMatch[1]),
        lng: Number(atMatch[2]),
      };
    }

    const dataMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (dataMatch) {
      return {
        lat: Number(dataMatch[1]),
        lng: Number(dataMatch[2]),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function hasSavedCoordinates(page) {
  const latitude = Number(page.latitude);
  const longitude = Number(page.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

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

function hotelJsonLd(page, canonicalUrl, heroImageUrl, faqItems) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: page.public_title,
    description: page.meta_description,
    url: canonicalUrl,
    image: heroImageUrl,
    telephone: page.primary_phone || undefined,
    email: page.inquiry_email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: page.address_line_1 || undefined,
      addressLocality: page.address_village || undefined,
      addressRegion: page.address_district || undefined,
      postalCode: page.address_pincode || undefined,
      addressCountry: "IN",
    },
  };

  if (hasSavedCoordinates(page)) {
    data.geo = {
      "@type": "GeoCoordinates",
      latitude: Number(page.latitude),
      longitude: Number(page.longitude),
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
            text: item.answer || "",
          },
        })),
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
        { "@type": "ListItem", position: 3, name: page.public_title, item: canonicalUrl },
      ],
    })
  );

  return blocks.map((block) => `<script type="application/ld+json">${block}</script>`).join("\n");
}

function renderHtml(page) {
  const canonicalPath = page.canonical_path || `/${page.category}/${page.slug}`;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const photos = Array.isArray(page.photos) ? page.photos : [];
  const coverPhoto = photos.find((photo) => Number(photo.is_cover) === 1) || photos[0] || null;
  const heroImageUrl = coverPhoto
    ? buildPhotoUrl(page.hotel_id, coverPhoto.id)
    : `${SITE_URL}/assets/images/alibaug-coastline.webp`;
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
  const roomTypeOptions = roomTypes.length
    ? roomTypes
        .map((item) => `<option value="${escapeHtml(String(item || ""))}">${escapeHtml(String(item || ""))}</option>`)
        .join("")
    : `<option value="Standard Room">Standard Room</option><option value="Deluxe Room">Deluxe Room</option><option value="Family Room">Family Room</option>`;

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
</script>
</body>
</html>`;
}

export async function fetchPublishedHotelPage(env, category, slug) {
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
  )
    .bind(category, slug)
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
       is_active
     FROM hotel_public_page_photos
     WHERE public_page_id = ?1
       AND is_active = 1
     ORDER BY is_cover DESC, photo_order ASC, created_at ASC`
  )
    .bind(page.id)
    .all();

  return {
    ...page,
    photos: photos.results || [],
  };
}

export function hotelPageResponse(page) {
  return new Response(renderHtml(page), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

async function reservationTableExists(db) {
  const table = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'hotel_future_reservations' LIMIT 1")
    .first()
    .catch(() => null);
  return Boolean(table?.name);
}

async function fetchAvailabilityMap(db, filters) {
  if (!filters.hasDateRange) {
    return new Map();
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

  const map = new Map();
  for (const row of activeStayResults.results || []) {
    map.set(String(row.hotel_id || "").toLowerCase(), {
      occupiedRooms: Number(row.occupied_rooms || 0),
      reservedRooms: 0,
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

export async function fetchPublishedCategoryPages(env, category, filters = { hasDateRange: false, rooms: 1, adults: 2, children: 0 }) {
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
  )
    .bind(category)
    .all();

  const pages = result.results || [];
  if (!filters.hasDateRange) {
    return pages;
  }

  const availabilityMap = await fetchAvailabilityMap(env.DB, filters);
  return pages
    .map((page) => {
      const hotelId = String(page.hotel_id || "").toLowerCase();
      const availability = availabilityMap.get(hotelId) || { occupiedRooms: 0, reservedRooms: 0 };
      const totalRooms = Number(page.total_rooms || page.room_count_display || 0);
      const blockedRooms = availability.occupiedRooms + availability.reservedRooms;
      const availableRooms = Math.max(0, totalRooms - blockedRooms);
      return {
        ...page,
        available_rooms: availableRooms,
        blocked_rooms: blockedRooms,
      };
    })
    .filter((page) => Number(page.available_rooms || 0) >= filters.rooms);
}

function renderCategoryHtml(category, pages, filters) {
  const label = categoryLabel(category);
  const canonicalPath = categoryPath(category);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const title = `${label}s In Alibaug | Hotels In Alibaug`;
  const description = categoryDescription(category);
  const countLabel = availabilitySummary(filters, pages.length, label);
  const cards = pages.map((page) => {
    const imageUrl = page.cover_photo_id
      ? buildPhotoUrl(page.hotel_id, page.cover_photo_id)
      : `${SITE_URL}/assets/images/alibaug-coastline.webp`;
    const location = [page.address_village, page.address_taluka, page.address_district]
      .filter(Boolean)
      .join(", ");
    const roomCount = displayRoomCount(page);
    const beachDistance = displayBeachDistance(page);
    const amenities = safeParseJsonArray(page.amenities_json).slice(0, 4);
    const amenityChips = amenities.map((item) => `<span class="meta-chip">${escapeHtml(item)}</span>`).join("");
    const highlights = [
      roomCount ? `${roomCount} available for listing` : "",
      beachDistance ? `${beachDistance} from the beach` : "",
      location ? location : "",
    ].filter(Boolean);
    const href = page.canonical_path || `${canonicalPath}/${page.slug}`;
    const availabilityText = filters.hasDateRange
      ? `${Number(page.available_rooms || 0)} room${Number(page.available_rooms || 0) === 1 ? "" : "s"} available for selected dates`
      : "Open the full page for photos, location map, contact details, and inquiry form.";
    return `
      <article class="stay-card">
        <div class="stay-card-image">
          <img src="${imageUrl}" alt="${escapeHtml(page.public_title)}" loading="lazy" decoding="async">
        </div>
        <div class="stay-card-body">
          <h3><a href="${href}" style="color:inherit;text-decoration:none;">${escapeHtml(page.public_title)}</a></h3>
          ${location ? `<a class="location-link" href="${href}#location">📍 ${escapeHtml(location)}</a>` : ""}
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
  url: canonicalUrl,
})}</script>
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
        ${filters.hasDateRange ? `<span class="results-pill">${escapeHtml(`${filters.adults} adults • ${filters.children} children • ${filters.rooms} room${filters.rooms === 1 ? "" : "s"}`)}</span>` : ""}
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

export function categoryPageResponse(category, pages, filters = { hasDateRange: false, rooms: 1, adults: 2, children: 0 }) {
  return new Response(renderCategoryHtml(category, pages, filters), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
