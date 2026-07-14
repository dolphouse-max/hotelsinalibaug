import { badRequest, isSafeId } from "../../_lib/api";
import { buildGoogleConsentUrl, getHotelById } from "../../_lib/google-drive";

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const hotelId = url.searchParams.get("hotel_id");

  if (!isSafeId(hotelId)) {
    return badRequest("Invalid hotel_id");
  }

  const hotel = await getHotelById(context.env, hotelId);
  if (!hotel) {
    return new Response("Hotel not found", { status: 404 });
  }

  const consentUrl = await buildGoogleConsentUrl(hotelId, context.env);
  return Response.redirect(consentUrl, 302);
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
