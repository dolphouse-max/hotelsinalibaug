import { fetchPublishedHotelPage, hotelPageResponse } from "../_lib/hotel-page";

export async function onRequestGet(context) {
  const slug = context.params.slug;
  const page = await fetchPublishedHotelPage(context.env, "cottage", slug);
  if (!page) {
    return new Response("Cottage page not found", { status: 404 });
  }
  return hotelPageResponse(page);
}
