import { badRequest, json, unauthorized } from "../../_lib/api";
import { requireSuperAdminSession, resetPasswordAsSuperAdmin } from "../../_lib/auth";

interface Env {
  DB: D1Database;
  POLICE_INITIAL_PASSWORD?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const role = typeof payload.role === "string" ? payload.role.trim() : "";
    const loginId = typeof payload.login_id === "string" ? payload.login_id.trim() : "";

    if (!["hotel_admin", "police"].includes(role)) {
      return badRequest("role must be hotel_admin or police.");
    }

    const result = await resetPasswordAsSuperAdmin(context.env, role, loginId);
    return json({ ok: true, ...result });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to reset password." },
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
