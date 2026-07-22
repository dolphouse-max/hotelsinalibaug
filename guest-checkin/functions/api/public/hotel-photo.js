import { getHotelDriveAccessToken } from "../../_lib/google-drive";

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

function isSafeHotelId(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{5,63}$/.test(value.trim());
}

function isSafePhotoId(value) {
  return typeof value === "string" && /^[a-z0-9]{16,64}$/i.test(value.trim());
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const hotelId = url.searchParams.get("hotel_id")?.trim() || "";
    const photoId = url.searchParams.get("photo_id")?.trim() || "";

    if (!isSafeHotelId(hotelId) || !isSafePhotoId(photoId)) {
      return badRequest("Valid hotel_id and photo_id are required.");
    }

    const photo = await context.env.DB.prepare(
      `SELECT
         p.google_drive_file_id,
         p.file_name,
         p.alt_text,
         p.caption,
         p.hotel_id
       FROM hotel_public_page_photos p
       INNER JOIN hotel_public_pages hpp
         ON hpp.id = p.public_page_id
       WHERE p.id = ?1
         AND lower(p.hotel_id) = lower(?2)
         AND p.is_active = 1
         AND hpp.is_published = 1
       LIMIT 1`
    )
      .bind(photoId, hotelId)
      .first();

    if (!photo?.google_drive_file_id) {
      return json({ error: "Photo not found." }, { status: 404 });
    }

    const { accessToken } = await getHotelDriveAccessToken(hotelId, context.env);
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(photo.google_drive_file_id)}?alt=media`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      return json({ error: `Unable to load image: ${errorText}` }, { status: 502 });
    }

    const headers = new Headers();
    headers.set("content-type", driveResponse.headers.get("content-type") || "image/jpeg");
    headers.set("cache-control", "public, max-age=3600");
    headers.set("content-disposition", `inline; filename="${photo.file_name || photoId}"`);

    return new Response(driveResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to load public hotel photo." },
      { status: 500 }
    );
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
