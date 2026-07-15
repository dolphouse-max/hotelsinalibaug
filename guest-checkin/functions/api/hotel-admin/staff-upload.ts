import { badRequest, json, unauthorized } from "../../_lib/api";
import { processStaffUpload, statusForStaffUploadError } from "../../_lib/staff-upload";

interface Env {
  DB: D1Database;
  HOTEL_ADMIN_TOKEN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
}

function hasHotelAdminToken(request: Request, env: Env): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return Boolean(env.HOTEL_ADMIN_TOKEN) && authHeader.slice("Bearer ".length).trim() === env.HOTEL_ADMIN_TOKEN;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!hasHotelAdminToken(context.request, context.env)) {
    return unauthorized();
  }

  const contentType = context.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("Expected multipart/form-data");
  }

  try {
    const formData = await context.request.formData();
    const result = await processStaffUpload(formData, context.env);
    return json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save staff member";

    console.error("Staff upload failed", error);
    return json({ error: message }, { status: statusForStaffUploadError(message) });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
