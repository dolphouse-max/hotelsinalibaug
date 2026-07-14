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
  const hotelId = url.searchParams.get("hotelId");
  const guestId = url.searchParams.get("id");

  if (!hotelId) {
    return badRequest("Missing required query parameter: hotelId");
  }

  if (!isSafeId(hotelId)) {
    return badRequest("Invalid hotelId");
  }

  if (guestId && !isSafeId(guestId)) {
    return badRequest("Invalid guest id");
  }

  try {
    if (guestId) {
      const guest = await context.env.DB.prepare(
        `SELECT
           id,
           hotel_id,
           name,
           phone,
           id_type,
           id_number,
           check_in_time,
           check_out_time,
           google_drive_file_id,
           created_at,
           updated_at
         FROM guests
         WHERE hotel_id = ?1 AND id = ?2
         LIMIT 1`
      )
        .bind(hotelId, guestId)
        .first();

      if (!guest) {
        return json({ error: "Guest not found" }, { status: 404 });
      }

      return json({ guest });
    }

    const { results } = await context.env.DB.prepare(
      `SELECT
         id,
         hotel_id,
         name,
         phone,
         id_type,
         id_number,
         check_in_time,
         check_out_time,
         google_drive_file_id,
         created_at,
         updated_at
       FROM guests
       WHERE hotel_id = ?1
       ORDER BY check_in_time DESC`
    )
      .bind(hotelId)
      .all();

    return json({ guests: results });
  } catch (error) {
    console.error("Failed to query guests", error);
    return json({ error: "Unable to fetch guests" }, { status: 500 });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
