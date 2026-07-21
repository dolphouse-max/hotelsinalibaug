import { badRequest, json, unauthorized } from "../../_lib/api";
import { deleteAuthUser, listAuthUsers, requireSuperAdminSession, saveAuthUser } from "../../_lib/auth";

interface Env {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
  SESSION_SECRET?: string;
  FIREBASE_PROJECT_ID?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  const users = await listAuthUsers(context.env);
  return json({ ok: true, users });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const user = await saveAuthUser(context.env, {
      firebase_uid: typeof payload.firebase_uid === "string" ? payload.firebase_uid.trim() : "",
      email: typeof payload.email === "string" ? payload.email.trim() : "",
      role: typeof payload.role === "string" ? payload.role.trim() : "",
      hotel_id: typeof payload.hotel_id === "string" ? payload.hotel_id.trim() : "",
      display_name: typeof payload.display_name === "string" ? payload.display_name.trim() : "",
      is_active: payload.is_active,
    });

    return json({ ok: true, user }, { status: 201 });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to save user.");
  }
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  try {
    const url = new URL(context.request.url);
    const userId = url.searchParams.get("id")?.trim() || "";
    const email = url.searchParams.get("email")?.trim() || "";
    const deleted = await deleteAuthUser(context.env, userId || email);
    return json({ ok: true, deleted_user: deleted });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to delete user mapping.");
  }
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, POST, DELETE, OPTIONS",
    },
  });
