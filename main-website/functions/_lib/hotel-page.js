const SITE_URL = "https://hotelsinalibaug.in";
const PHOTO_PROXY_BASE = "https://checkin.hotelsinalibaug.in/api/public/hotel-photo";

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
  const whatsappText = encodeURIComponent(page.inquiry_whatsapp_prefill || `Hello, I want to enquire about ${page.public_title}.`);

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
<link rel="stylesheet" href="/assets/styles.css">
${hotelJsonLd(page, canonicalUrl, heroImageUrl, faqItems)}
</head>
<body>
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
        ${page.whatsapp_number ? `<a class="button secondary" href="https://wa.me/${escapeHtml(String(page.whatsapp_number).replace(/[^0-9]/g, ""))}?text=${whatsappText}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}
        ${page.google_maps_place_url ? `<a class="button secondary" href="${escapeHtml(page.google_maps_place_url)}" target="_blank" rel="noopener noreferrer">Open Map</a>` : ""}
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
        ${page.address_line_1 || page.address_village || page.address_pincode ? `
          <p>${escapeHtml([page.address_line_1, page.address_village, page.address_taluka, page.address_district, page.address_pincode].filter(Boolean).join(", "))}</p>
        ` : "<p>Address will be updated soon.</p>"}
        ${page.google_maps_embed_url ? `
          <div class="map-card" style="margin-top:1rem;">
            <iframe
              src="${escapeHtml(page.google_maps_embed_url)}"
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
        <p>Use this form to quickly start an inquiry by WhatsApp or email.</p>
        <form id="inquiryForm" data-whatsapp="${escapeHtml(page.whatsapp_number || "")}" data-email="${escapeHtml(page.inquiry_email || "")}" data-title="${escapeHtml(page.public_title)}">
          <div style="display:grid;gap:12px;">
            <input id="inqName" type="text" placeholder="Your Name" style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;">
            <input id="inqPhone" type="tel" placeholder="Mobile Number" style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;">
            <textarea id="inqMessage" rows="4" placeholder="Tell us your preferred dates, guests, and room type." style="width:100%;padding:12px;border:1px solid #d9e3e8;border-radius:14px;"></textarea>
            <button class="button primary" type="submit">Send Inquiry</button>
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
    const name = document.getElementById("inqName")?.value?.trim() || "";
    const phone = document.getElementById("inqPhone")?.value?.trim() || "";
    const message = document.getElementById("inqMessage")?.value?.trim() || "";
    const whatsapp = this.dataset.whatsapp || "";
    const email = this.dataset.email || "";
    const title = this.dataset.title || "hotel stay";
    const text = encodeURIComponent("Inquiry for " + title + "\\nName: " + name + "\\nPhone: " + phone + "\\nMessage: " + message);

    if (whatsapp) {
      window.open("https://wa.me/" + whatsapp.replace(/[^0-9]/g, "") + "?text=" + text, "_blank", "noopener,noreferrer");
      return;
    }

    if (email) {
      window.location.href = "mailto:" + email + "?subject=" + encodeURIComponent("Inquiry for " + title) + "&body=" + text;
      return;
    }

    alert("Direct inquiry contact is not configured yet.");
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
       hpp.address_village,
       hpp.address_taluka,
       hpp.address_district,
       hpp.primary_phone,
       hpp.whatsapp_number,
       hpp.google_maps_place_url,
       hpp.canonical_path,
       hpp.sort_order,
       h.name AS hotel_name,
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
  const cards = pages.map((page) => {
    const imageUrl = page.cover_photo_id
      ? buildPhotoUrl(page.hotel_id, page.cover_photo_id)
      : `${SITE_URL}/assets/images/alibaug-coastline.webp`;
    const location = [page.address_village, page.address_taluka, page.address_district]
      .filter(Boolean)
      .join(", ");
    const href = page.canonical_path || `${canonicalPath}/${page.slug}`;
    return `
      <article class="stay-card">
        <img src="${imageUrl}" alt="${escapeHtml(page.public_title)}" loading="lazy" decoding="async">
        <h3>${escapeHtml(page.public_title)}</h3>
        <p>${escapeHtml(excerpt(page.short_description || page.meta_description))}</p>
        ${location ? `<p class="meta"><strong>Location:</strong> ${escapeHtml(location)}</p>` : ""}
        <div class="button-row">
          <a class="button primary" href="${href}">View Details</a>
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
<link rel="stylesheet" href="/assets/styles.css">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: title,
  description,
  url: canonicalUrl,
})}</script>
</head>
<body>
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
        <a href="/">Home</a> / ${escapeHtml(label)}s
      </div>
      <h1>${escapeHtml(label)}s In Alibaug</h1>
      <p class="lead">${escapeHtml(description)}</p>
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
</main>

<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <h3>Hotels In Alibaug</h3>
      <p>Public hotel pages, travel content, and direct contact options for stays in Alibaug.</p>
    </div>
    <div>
      <h3>Explore</h3>
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
