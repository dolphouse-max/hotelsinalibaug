import { badRequest, json, unauthorized } from "../../_lib/api";
import { createCheckinAccessToken } from "../../_lib/checkin-link";
import { getHotelById } from "../../_lib/google-drive";

interface Env {
  DB: D1Database;
  HOTEL_ADMIN_TOKEN: string;
  CHECKIN_LINK_SECRET: string;
}

function requireHotelAdmin(request: Request, env: Env): boolean {
  const authHeader = request.headers.get("authorization");

  if (!env.HOTEL_ADMIN_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.HOTEL_ADMIN_TOKEN;
}

function isSafeId(value: string | null): value is string {
  return Boolean(value) && /^[a-z0-9]{16,64}$/i.test(value);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!requireHotelAdmin(context.request, context.env)) {
    return unauthorized();
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

    return json({
      ok: true,
      hotelId,
      hotelName: hotel.name,
      checkinUrl,
      accessToken,
    });
  } catch (error) {
    console.error("Failed to create hotel-admin check-in link", error);
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
