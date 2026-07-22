import { categoryPageResponse, fetchPublishedCategoryPages } from "../_lib/hotel-page";

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for resorts directory.", { status: 500 });
    }

    const pages = await fetchPublishedCategoryPages(context.env, "resort");
    return categoryPageResponse("resort", pages);
  } catch (error) {
    return new Response(`Website error in resorts directory: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
