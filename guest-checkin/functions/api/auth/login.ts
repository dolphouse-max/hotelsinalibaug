import { badRequest, json, unauthorized } from "../../_lib/api";
import {
  createSessionCookie,
  defaultPoliceLogin,
  defaultSuperAdminLogin,
  verifyPasswordForRole,
} from "../../_lib/auth";

interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
  ENCRYPTION_KEY?: string;
  GOOGLE_CLIENT_SECRET?: string;
  POLICE_INITIAL_PASSWORD?: string;
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
    const role = typeof payload.role === "string" ? payload.role.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const rawLoginId = typeof payload.login_id === "string" ? payload.login_id.trim() : "";
    const loginId =
      role === "super_admin"
        ? rawLoginId.toLowerCase() || defaultSuperAdminLogin()
        : role === "police"
          ? defaultPoliceLogin()
          : rawLoginId.toLowerCase();

    if (!["super_admin", "hotel_admin", "police"].includes(role)) {
      return badRequest("Valid role is required.");
    }

    if (!loginId || !password) {
      return badRequest("Login ID and password are required.");
    }

    const account = await verifyPasswordForRole(context.env, role, loginId, password);
    if (!account) {
      return unauthorized();
    }

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      await createSessionCookie(
        {
          login_id: account.login_id,
          role: account.role,
          hotel_id: account.hotel_id,
          email: account.email,
          display_name: account.display_name,
          must_change_password: account.must_change_password,
        },
        context.env
      )
    );

    return json(
      {
        ok: true,
        redirect: roleRedirect(account.role, account.hotel_id),
        session: account,
      },
      { headers }
    );
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to log in." },
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
