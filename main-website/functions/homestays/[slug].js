import { fetchPublishedHotelPage, hotelPageResponse } from "../_lib/hotel-page";

export async function onRequestGet(context) {
  const slug = context.params.slug;
  const page = await fetchPublishedHotelPage(context.env, "homestay", slug);
  if (!page) {
    return new Response("Homestay page not found", { status: 404 });
  }
  return hotelPageResponse(page);
}
