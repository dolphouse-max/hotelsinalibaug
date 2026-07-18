import { json } from "../../_lib/api";
import { getAllowedSuperAdminEmails, getGoogleClientId } from "../../_lib/auth";

interface Env {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_WEB_CLIENT_ID?: string;
  SUPER_ADMIN_GOOGLE_EMAILS?: string;
  SUPER_ADMIN_GOOGLE_EMAIL?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clientId = getGoogleClientId(context.env);

  if (!clientId) {
    return json({ error: "Google client ID is not configured." }, { status: 500 });
  }

  return json({
    ok: true,
    clientId,
    superAdminEmails: getAllowedSuperAdminEmails(context.env),
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
