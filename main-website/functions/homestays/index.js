import { categoryPageResponse, fetchPublishedCategoryPages, parseAvailabilityFilters } from "../_lib/hotel-page";

export async function onRequestGet(context) {
  try {
    if (!context.env?.DB) {
      return new Response("Website error: DB binding is missing for homestays directory.", { status: 500 });
    }

    const filters = parseAvailabilityFilters(new URL(context.request.url).searchParams);
    const pages = await fetchPublishedCategoryPages(context.env, "homestay", filters);
    return categoryPageResponse("homestay", pages, filters);
  } catch (error) {
    return new Response(`Website error in homestays directory: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
