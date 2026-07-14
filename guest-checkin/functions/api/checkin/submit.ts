import { badRequest, json } from "../../_lib/api";
import { processGuestUpload, statusForGuestUploadError } from "../../_lib/guest-upload";
import { verifyCheckinAccessToken } from "../../_lib/checkin-link";

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
  CHECKIN_LINK_SECRET: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const contentType = context.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("Expected multipart/form-data");
  }

  try {
    const formData = await context.request.formData();
    const hotelIdValue = formData.get("hotel_id");
    const accessValue = formData.get("access");

    if (typeof hotelIdValue !== "string" || !hotelIdValue.trim()) {
      return badRequest("Missing hotel_id");
    }

    if (typeof accessValue !== "string" || !accessValue.trim()) {
      return badRequest("Missing access");
    }

    await verifyCheckinAccessToken(accessValue.trim(), hotelIdValue.trim(), context.env);
    const result = await processGuestUpload(formData, context.env);

    return json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete check-in";
    const status = message.includes("access token") ? 403 : statusForGuestUploadError(message);

    console.error("Public guest check-in failed", error);
    return json({ error: message }, { status });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
