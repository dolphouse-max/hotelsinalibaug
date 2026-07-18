import { badRequest, json, unauthorized } from "../../_lib/api";
import { changePasswordForSession, createSessionCookie, readSession } from "../../_lib/auth";

interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
  ENCRYPTION_KEY?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await readSession(context.request, context.env);
  if (!session) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const currentPassword = typeof payload.current_password === "string" ? payload.current_password : "";
    const newPassword = typeof payload.new_password === "string" ? payload.new_password : "";

    if (!currentPassword || !newPassword) {
      return badRequest("Current password and new password are required.");
    }

    if (newPassword.length < 8) {
      return badRequest("New password must be at least 8 characters.");
    }

    await changePasswordForSession(context.env, session, currentPassword, newPassword);

    const nextSession = { ...session, must_change_password: false };
    const headers = new Headers();
    headers.append("Set-Cookie", await createSessionCookie(nextSession, context.env));

    return json(
      {
        ok: true,
        session: nextSession,
      },
      { headers }
    );
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to change password." },
      { status: 400 }
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
