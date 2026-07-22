import { fetchPublishedHotelPage, hotelPageResponse } from "../_lib/hotel-page";

export async function onRequestGet(context) {
  const slug = context.params.slug;
  const page = await fetchPublishedHotelPage(context.env, "resort", slug);
  if (!page) {
    return new Response("Resort page not found", { status: 404 });
  }
  return hotelPageResponse(page);
}
