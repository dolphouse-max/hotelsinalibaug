import { json, unauthorized } from "../../_lib/api";
import {
  defaultPoliceLogin,
  defaultSuperAdminLogin,
  getHotelAdminRecord,
  readSession,
  requireHotelAdminSession,
  requirePoliceSession,
  requireSuperAdminSession,
} from "../../_lib/auth";

interface Env {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
  SESSION_SECRET?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const requestedRole = url.searchParams.get("role")?.trim() || "";
  const requestedHotelId = url.searchParams.get("hotel_id")?.trim() || "";

  if (requestedRole === "super_admin") {
    const session = await requireSuperAdminSession(context.request, context.env);
    if (!session) {
      return unauthorized();
    }

    return json({ ok: true, session });
  }

  if (requestedRole === "hotel_admin") {
    const session = await requireHotelAdminSession(context.request, context.env, requestedHotelId);
    if (!session) {
      return unauthorized();
    }

    const hotel = await getHotelAdminRecord(context.env, session.hotel_id);

    return json({
      ok: true,
      session: {
        ...session,
        hotel_name: hotel?.name || "",
      },
    });
  }

  if (requestedRole === "police") {
    const session = await requirePoliceSession(context.request, context.env);
    if (!session) {
      return unauthorized();
    }

    return json({
      ok: true,
      session: {
        ...session,
        login_id: session.login_id || defaultPoliceLogin(),
      },
    });
  }

  const session = await readSession(context.request, context.env);
  if (!session) {
    return unauthorized();
  }

  return json({
    ok: true,
    session: {
      ...session,
      login_id: session.login_id || (session.role === "super_admin" ? defaultSuperAdminLogin() : defaultPoliceLogin()),
    },
  });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
