import { fetchPublishedHotelPage, hotelPageResponse } from "../_lib/hotel-page";

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for resort detail page.", { status: 500 });
    }

    const slug = context.params.slug;
    const page = await fetchPublishedHotelPage(context.env, "resort", slug);
    if (!page) {
      return new Response("Resort page not found", { status: 404 });
    }
    return hotelPageResponse(page);
  } catch (error) {
    return new Response(`Website error in resort detail page: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
