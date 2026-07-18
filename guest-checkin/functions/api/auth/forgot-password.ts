import { badRequest, json } from "../../_lib/api";
import { resetPasswordFromForgot } from "../../_lib/auth";

interface Env {
  DB: D1Database;
  POLICE_INITIAL_PASSWORD?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const payload = await context.request.json();
    const role = typeof payload.role === "string" ? payload.role.trim() : "";
    const loginId = typeof payload.login_id === "string" ? payload.login_id.trim() : "";
    const contactValue = typeof payload.contact_value === "string" ? payload.contact_value.trim() : "";

    if (!["super_admin", "hotel_admin", "police"].includes(role) || !loginId) {
      return badRequest("Valid role and login ID are required.");
    }

    const result = await resetPasswordFromForgot(context.env, role, loginId, contactValue);
    return json({ ok: true, ...result });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to process forgot password." },
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
