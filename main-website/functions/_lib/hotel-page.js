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
.directory-page .pages-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.25rem;}
.directory-page .stay-card,.directory-page .panel,.directory-page .content-card{
  background:#fff;border:1px solid #d9e3e8;border-radius:18px;box-shadow:0 14px 36px rgba(23,48,66,.08);
}
.directory-page .stay-card{overflow:hidden;padding:0 0 1rem;}
.directory-page .stay-card img{width:100%;height:210px;object-fit:cover;display:block;}
.directory-page .stay-card h3,.directory-page .stay-card p,.directory-page .stay-card .meta,.directory-page .stay-card .button-row{padding-left:1rem;padding-right:1rem;}
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

function resolvedMapPlaceUrl(page) {
  if (page.google_maps_place_url) {
    return String(page.google_maps_place_url);
  }

  const query = buildAutoMapQuery(page);
  if (!query) {
    return "";
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function resolvedMapEmbedUrl(page) {
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
        <h2 style="margin-top:0;">Location</h2>
        ${fullAddress ? `
          <p>${escapeHtml(fullAddress)}</p>
        ` : "<p>Address will be updated soon.</p>"}
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
      </article>
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

export async function fetchPublishedCategoryPages(env, category) {
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

  return result.results || [];
}

function renderCategoryHtml(category, pages) {
  const label = categoryLabel(category);
  const canonicalPath = categoryPath(category);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const title = `${label}s In Alibaug | Hotels In Alibaug`;
  const description = categoryDescription(category);
  const countLabel = `${pages.length} ${label.toLowerCase()}${pages.length === 1 ? "" : "s"} listed`;
  const cards = pages.map((page) => {
    const imageUrl = page.cover_photo_id
      ? buildPhotoUrl(page.hotel_id, page.cover_photo_id)
      : `${SITE_URL}/assets/images/alibaug-coastline.webp`;
    const location = [page.address_village, page.address_taluka, page.address_district]
      .filter(Boolean)
      .join(", ");
    const roomCount = displayRoomCount(page);
    const beachDistance = displayBeachDistance(page);
    const amenities = safeParseJsonArray(page.amenities_json).slice(0, 3);
    const href = page.canonical_path || `${canonicalPath}/${page.slug}`;
    return `
      <article class="stay-card">
        <img src="${imageUrl}" alt="${escapeHtml(page.public_title)}" loading="lazy" decoding="async">
        <h3>${escapeHtml(page.public_title)}</h3>
        <p>${escapeHtml(excerpt(page.short_description || page.meta_description))}</p>
        ${location ? `<p class="meta"><strong>Location:</strong> ${escapeHtml(location)}</p>` : ""}
        ${roomCount ? `<p class="meta"><strong>Rooms:</strong> ${escapeHtml(roomCount)}</p>` : ""}
        ${beachDistance ? `<p class="meta"><strong>Beach:</strong> ${escapeHtml(beachDistance)}</p>` : ""}
        ${amenities.length ? `<p class="meta"><strong>Amenities:</strong> ${escapeHtml(amenities.join(", "))}</p>` : ""}
        <div class="button-row">
          <a class="button primary" href="${href}">Check Availability at ${escapeHtml(page.public_title)}</a>
          ${page.primary_phone ? `<a class="button secondary" href="tel:${escapeHtml(page.primary_phone)}">Call</a>` : ""}
          ${page.whatsapp_number ? `<a class="button secondary" href="https://wa.me/${escapeHtml(String(page.whatsapp_number).replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}
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
      <p class="lead"><strong>${escapeHtml(countLabel)}</strong></p>
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
          <p>Superadmin can publish hotel website pages from the CHECKIN admin panel. Once published, they will appear here automatically.</p>
        </article>
      `}
    </div>
  </section>

  <section class="section">
    <div class="container">
      <article class="panel">
        <h2 style="margin-top:0;">Direct Hotel Enquiries</h2>
        <p>Open any listing above to check availability, call the property, or send a direct WhatsApp enquiry to the hotel.</p>
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

export function categoryPageResponse(category, pages) {
  return new Response(renderCategoryHtml(category, pages), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
