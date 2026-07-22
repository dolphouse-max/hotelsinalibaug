import { categoryPageResponse, fetchPublishedCategoryPages } from "../_lib/hotel-page";

export async function onRequestGet(context) {
  const pages = await fetchPublishedCategoryPages(context.env, "homestay");
  return categoryPageResponse("homestay", pages);
}
