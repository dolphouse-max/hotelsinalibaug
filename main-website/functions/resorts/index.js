import { categoryPageResponse, fetchPublishedCategoryPages } from "../_lib/hotel-page";

export async function onRequestGet(context) {
  const pages = await fetchPublishedCategoryPages(context.env, "resort");
  return categoryPageResponse("resort", pages);
}
