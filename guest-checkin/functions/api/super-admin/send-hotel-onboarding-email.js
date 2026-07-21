import { requireSuperAdminSession } from "../../_lib/auth";
import { sendHotelOnboardingEmail } from "../../_lib/hotel-onboarding-email";

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

export async function onRequestPost(context) {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json();
    const hotel = payload?.hotel;
    if (!hotel || typeof hotel !== "object") {
      return badRequest("hotel payload is required");
    }

    const origin = new URL(context.request.url).origin;
    const result = await sendHotelOnboardingEmail(context.env, hotel, origin);
    return json(result, { status: 200 });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unable to send hotel onboarding email",
      },
      { status: 400 }
    );
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
