import { categoryPageResponse, fetchPublishedCategoryPages } from "../_lib/hotel-page";

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for hotels directory.", { status: 500 });
    }

    const pages = await fetchPublishedCategoryPages(context.env, "hotel");
    return categoryPageResponse("hotel", pages);
  } catch (error) {
    return new Response(`Website error in hotels directory: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
