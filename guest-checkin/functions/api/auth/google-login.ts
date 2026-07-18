import { badRequest, forbidden, json } from "../../_lib/api";
import {
  createSessionCookie,
  getAllowedSuperAdminEmails,
  getHotelAdminRecord,
  normalizeHotelId,
  verifyGoogleCredential,
} from "../../_lib/auth";

interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_WEB_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ENCRYPTION_KEY?: string;
  SESSION_SECRET?: string;
  SUPER_ADMIN_GOOGLE_EMAILS?: string;
  SUPER_ADMIN_GOOGLE_EMAIL?: string;
}

function roleRedirect(role: string, hotelId = "") {
  if (role === "hotel_admin") {
    const suffix = hotelId ? `?hotel_id=${encodeURIComponent(hotelId)}` : "";
    return `/hotel-admin-home.html${suffix}`;
  }

  return "/super-admin-home.html";
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const payload = await context.request.json();
    const credential = typeof payload.credential === "string" ? payload.credential.trim() : "";
    const role = typeof payload.role === "string" ? payload.role.trim() : "";
    const hotelId = normalizeHotelId(payload.hotel_id);

    if (!credential) {
      return badRequest("Google credential is required.");
    }

    if (!["super_admin", "hotel_admin"].includes(role)) {
      return badRequest("Valid role is required.");
    }

    const googleUser = await verifyGoogleCredential(credential, context.env);

    if (role === "super_admin") {
      const allowedEmails = getAllowedSuperAdminEmails(context.env);
      if (!allowedEmails.includes(googleUser.email)) {
        return forbidden("This Google account is not allowed for superadmin access.");
      }

      const headers = new Headers();
      headers.append(
        "Set-Cookie",
        await createSessionCookie(
          {
            role: "super_admin",
            email: googleUser.email,
            name: googleUser.name,
            picture: googleUser.picture,
            sub: googleUser.subject,
          },
          context.env
        )
      );

      return json(
        {
          ok: true,
          role: "super_admin",
          redirect: roleRedirect("super_admin"),
          session: {
            role: "super_admin",
            email: googleUser.email,
            name: googleUser.name,
            picture: googleUser.picture,
          },
        },
        { headers }
      );
    }

    if (!hotelId) {
      return badRequest("hotel_id is required for hotel admin login.");
    }

    const hotel = await getHotelAdminRecord(context.env, hotelId);
    if (!hotel) {
      return forbidden("Hotel account not found for this hotel ID.");
    }

    if (!hotel.admin_email) {
      return forbidden("Hotel admin Gmail is not configured yet.");
    }

    if (String(hotel.admin_email).trim().toLowerCase() !== googleUser.email) {
      return forbidden("This Google account does not match the saved hotel admin Gmail.");
    }

    const headers = new Headers();
    headers.append(
      "Set-Cookie",
      await createSessionCookie(
        {
          role: "hotel_admin",
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          hotel_id: hotel.id,
          sub: googleUser.subject,
        },
        context.env
      )
    );

    return json(
      {
        ok: true,
        role: "hotel_admin",
        redirect: roleRedirect("hotel_admin", hotel.id),
        session: {
          role: "hotel_admin",
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          hotel_id: hotel.id,
          hotel_name: hotel.name,
        },
      },
      { headers }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google login failed.";
    const status = /allowed|configured|match|found/i.test(message) ? 403 : 400;
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
