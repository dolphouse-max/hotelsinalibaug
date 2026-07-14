import { html } from "../../_lib/api";
import { connectHotelGoogleDrive, verifyOAuthState } from "../../_lib/google-drive";

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
}

function page(title: string, message: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f7f8fb; color: #142033; padding: 24px; }
      main { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 14px; padding: 28px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); }
      h1 { margin: 0 0 12px; font-size: 26px; }
      p { margin: 0; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return html(page("Google connection cancelled", `Google returned: ${oauthError}`), {
      status: 400,
    });
  }

  if (!code || !state) {
    return html(page("Google connection failed", "Missing code or state."), { status: 400 });
  }

  try {
    const oauthState = await verifyOAuthState(state, context.env);
    await connectHotelGoogleDrive(oauthState.hotelId, code, context.env);

    return html(
      page(
        "Google Drive connected",
        "The hotel's Alibaug_Guest_Register folder is now linked successfully."
      )
    );
  } catch (error) {
    console.error("Google callback failed", error);
    return html(
      page("Google connection failed", "The connection could not be completed. Please retry."),
      { status: 500 }
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
