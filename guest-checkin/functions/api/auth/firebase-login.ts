import { badRequest, json } from "../../_lib/api";
import { createSessionCookie, resolveFirebaseSession } from "../../_lib/auth";

interface Env {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
  SESSION_SECRET?: string;
  FIREBASE_PROJECT_ID?: string;
}

function roleRedirect(role: string, hotelId = "") {
  if (role === "hotel_admin") {
    return `/hotel-admin-home.html${hotelId ? `?hotel_id=${encodeURIComponent(hotelId)}` : ""}`;
  }

  if (role === "police") {
    return "/police-dashboard.html";
  }

  return "/super-admin-home.html";
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const payload = await context.request.json();
    const idToken = typeof payload.id_token === "string" ? payload.id_token.trim() : "";

    if (!idToken) {
      return badRequest("id_token is required.");
    }

    const session = await resolveFirebaseSession(context.env, idToken);
    const headers = new Headers();
    headers.append("Set-Cookie", await createSessionCookie(session, context.env));

    return json(
      {
        ok: true,
        redirect: roleRedirect(session.role, session.hotel_id),
        session,
      },
      { headers }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Firebase session.";
    const status = /not authorized|missing a hotel assignment/i.test(message) ? 403 : 400;
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
