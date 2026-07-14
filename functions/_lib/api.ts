interface Env {
  API_READ_TOKEN: string;
  DB: D1Database;
}

type PagesContext = EventContext<Env, string, Record<string, unknown>>;

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function unauthorized(): Response {
  return json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string): Response {
  return json({ error: message }, { status: 400 });
}

export function forbidden(message = "Forbidden"): Response {
  return json({ error: message }, { status: 403 });
}

export function methodNotAllowed(): Response {
  return json({ error: "Method not allowed" }, { status: 405 });
}

export function hasValidReadToken(request: Request, env: Env): boolean {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return false;
  }

  const providedToken = authHeader.slice("Bearer ".length).trim();
  return Boolean(env.API_READ_TOKEN) && providedToken === env.API_READ_TOKEN;
}

export function requireReadToken(context: PagesContext): Response | null {
  if (hasValidReadToken(context.request, context.env)) {
    return null;
  }

  return unauthorized();
}

export function isSafeId(value: string | null): value is string {
  return Boolean(value) && /^[a-z0-9]{16,64}$/i.test(value);
}

export function html(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");

  return new Response(body, {
    ...init,
    headers,
  });
}
