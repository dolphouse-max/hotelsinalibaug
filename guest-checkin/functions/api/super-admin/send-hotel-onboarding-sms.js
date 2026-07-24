import { requireSuperAdminSession } from "../../_lib/auth";
import { sendHotelOnboardingSms } from "../../_lib/hotel-onboarding-sms";

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export async function onRequestPost(context) {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const payload = await context.request.json();
    if (!payload?.hotel || typeof payload.hotel !== "object") {
      return json({ error: "hotel payload is required" }, { status: 400 });
    }
    return json(await sendHotelOnboardingSms(context.env, payload.hotel));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to send hotel onboarding SMS" }, { status: 400 });
  }
}

export const onRequestOptions = async () => new Response(null, { status: 204, headers: { allow: "POST, OPTIONS" } });
