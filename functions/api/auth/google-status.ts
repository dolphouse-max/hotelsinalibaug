import { badRequest, isSafeId, json, requireReadToken } from "../../_lib/api";
import { getHotelById } from "../../_lib/google-drive";

interface Env {
  API_READ_TOKEN: string;
  DB: D1Database;
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

  return json({
    hotelId: hotel.id,
    hotelName: hotel.name,
    googleDriveConnected: Boolean(hotel.encrypted_refresh_token),
    googleDriveFolderId: hotel.google_drive_folder_id,
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
