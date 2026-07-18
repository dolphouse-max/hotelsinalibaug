import { requirePoliceSession } from "../../_lib/auth";

function json(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(body), { ...init, headers });
}

function unauthorized() {
  return json({ error: "Unauthorized" }, { status: 401 });
}

export async function onRequestGet(context) {
  if (!(await requirePoliceSession(context.request, context.env))) {
    return unauthorized();
  }

  const { results } = await context.env.DB.prepare(
    `SELECT id, name
     FROM hotels
     WHERE is_active = 1
     ORDER BY name ASC`
  ).all();

  return json({ ok: true, hotels: results || [] });
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "GET, OPTIONS",
    },
  });
