import { badRequest, isSafeId, json, requireReadToken } from "../../_lib/api";
import { createCheckinAccessToken, getCheckinLinkLifetimeSeconds } from "../../_lib/checkin-link";
import { getHotelById } from "../../_lib/google-drive";

interface Env {
  API_READ_TOKEN: string;
  DB: D1Database;
  CHECKIN_LINK_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authError = requireReadToken(context);
  if (authError) {
    return authError;
  }

  const url = new URL(context.request.url);
  const hotelId = url.searchParams.get("hotel_id");

  if (!isSafeId(hotelId)) {
    return badRequest("Invalid hotel_id");
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
      hotelId,
      hotelName: hotel.name,
      checkinUrl,
      accessToken,
      expiresAt,
      expiresInSeconds,
    });
  } catch (error) {
    console.error("Failed to create check-in link", error);
    return json({ error: "Unable to create check-in link" }, { status: 500 });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
