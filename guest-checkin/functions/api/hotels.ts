import { badRequest, isSafeId, json, requireReadToken } from "../_lib/api";

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
  const hotelId = url.searchParams.get("id");

  if (hotelId && !isSafeId(hotelId)) {
    return badRequest("Invalid hotel id");
  }

  try {
    if (hotelId) {
      const hotel = await context.env.DB.prepare(
        `SELECT id, name, contact, address, google_drive_folder_id, created_at, updated_at
         FROM hotels
         WHERE id = ?1
         LIMIT 1`
      )
        .bind(hotelId)
        .first();

      if (!hotel) {
        return json({ error: "Hotel not found" }, { status: 404 });
      }

      return json({ hotel });
    }

    const { results } = await context.env.DB.prepare(
      `SELECT id, name, contact, address, google_drive_folder_id, created_at, updated_at
       FROM hotels
       ORDER BY name ASC`
    ).all();

    return json({ hotels: results });
  } catch (error) {
    console.error("Failed to query hotels", error);
    return json({ error: "Unable to fetch hotels" }, { status: 500 });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
