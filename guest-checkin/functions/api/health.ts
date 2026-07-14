import { json, requireReadToken } from "../_lib/api";

interface Env {
  API_READ_TOKEN: string;
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  ENCRYPTION_KEY?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authError = requireReadToken(context);
  if (authError) {
    return authError;
  }

  try {
    const hotelCountResult = await context.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM hotels"
    ).first<{ total: number }>();
    const guestCountResult = await context.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM guests"
    ).first<{ total: number }>();

    return json({
      ok: true,
      checkedAt: new Date().toISOString(),
      database: {
        connected: true,
        hotels: hotelCountResult?.total ?? 0,
        guests: guestCountResult?.total ?? 0,
      },
      googleDrive: {
        clientIdConfigured: Boolean(context.env.GOOGLE_CLIENT_ID),
        clientSecretConfigured: Boolean(context.env.GOOGLE_CLIENT_SECRET),
        redirectUriConfigured: Boolean(context.env.GOOGLE_REDIRECT_URI),
        stateSigningConfigured: Boolean(context.env.GOOGLE_CLIENT_SECRET),
        encryptionKeyConfigured: Boolean(context.env.ENCRYPTION_KEY),
      },
    });
  } catch (error) {
    console.error("Health check failed", error);
    return json(
      {
        ok: false,
        error: "Health check failed",
      },
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
