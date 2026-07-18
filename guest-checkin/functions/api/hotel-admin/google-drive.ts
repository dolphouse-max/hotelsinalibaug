import { requireHotelAdminSession } from "../../_lib/auth";
import { badRequest, json, unauthorized } from "../../_lib/api";
import { getHotelById, revokeHotelGoogleDrive } from "../../_lib/google-drive";

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
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

  return json({
    ok: true,
    hotelId: hotel.id,
    hotelName: hotel.name,
    adminEmail: hotel.admin_email || null,
    googleDriveConnected: Boolean(hotel.encrypted_refresh_token),
    googleDriveFolderId: hotel.google_drive_folder_id,
    connectUrl: `/api/auth/google-init?hotel_id=${encodeURIComponent(hotel.id)}`,
  });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
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

  await revokeHotelGoogleDrive(hotel.id, context.env);

  return json({
    ok: true,
    hotelId: hotel.id,
    googleDriveConnected: false,
    googleDriveFolderId: hotel.google_drive_folder_id,
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, DELETE, OPTIONS",
    },
  });
