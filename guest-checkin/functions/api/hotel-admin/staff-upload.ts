import { requireHotelAdminSession } from "../../_lib/auth";
import { badRequest, json, unauthorized } from "../../_lib/api";
import { processStaffUpload, statusForStaffUploadError } from "../../_lib/staff-upload";

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const contentType = context.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("Expected multipart/form-data");
  }

  try {
    const formData = await context.request.formData();
    const hotelId = typeof formData.get("hotel_id") === "string" ? String(formData.get("hotel_id")).trim() : "";
    if (!(await requireHotelAdminSession(context.request, context.env, hotelId))) {
      return unauthorized();
    }
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
