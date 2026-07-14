import { badRequest, json, requireReadToken } from "../../_lib/api";
import { processGuestUpload, statusForGuestUploadError } from "../../_lib/guest-upload";

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authError = requireReadToken(context);
  if (authError) {
    return authError;
  }

  const contentType = context.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return badRequest("Expected multipart/form-data");
  }

  try {
    const formData = await context.request.formData();
    const result = await processGuestUpload(formData, context.env);
    return json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload guest document";

    console.error("Guest upload failed", error);
    return json({ error: message }, { status: statusForGuestUploadError(message) });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
