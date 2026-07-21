import { requireHotelAdminSession } from "../../_lib/auth";
import { badRequest, json, unauthorized } from "../../_lib/api";
import { createCheckinAccessToken, getCheckinLinkLifetimeSeconds } from "../../_lib/checkin-link";
import { getHotelById } from "../../_lib/google-drive";

interface Env {
  DB: D1Database;
  CHECKIN_LINK_SECRET: string;
}

function isSafeId(value: string | null): value is string {
  return Boolean(value) && /^[a-z0-9]{16,64}$/i.test(value);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const hotelId = url.searchParams.get("hotel_id");

  if (!isSafeId(hotelId)) {
    return badRequest("Invalid hotel_id");
  }

  if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
    return unauthorized();
  }

  const hotel = await getHotelById(context.env, hotelId);
  if (!hotel) {
    return json({ error: "Hotel not found" }, { status: 404 });
  }

  try {
    const accessToken = await createCheckinAccessToken(hotelId, context.env);
    const checkinUrl = `${url.origin}/?hotel_id=${encodeURIComponent(hotelId)}&access=${encodeURIComponent(accessToken)}`;
    const expiresInSeconds = getCheckinLinkLifetimeSeconds();
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    return json({
      ok: true,
      hotelId,
      hotelName: hotel.name,
      checkinUrl,
      accessToken,
      expiresAt,
      expiresInSeconds,
    });
  } catch (error) {
    console.error("Failed to create hotel-admin check-in link", error);
    return json(
      {
        error:
          error instanceof Error && error.message
            ? error.message
            : "Unable to create check-in link",
      },
      { status: 500 }
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
