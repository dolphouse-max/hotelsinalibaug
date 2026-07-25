import { requirePoliceSession } from "./_lib/auth";

interface Env {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
  SESSION_SECRET?: string;
}

function normalizePath(pathname: string) {
  const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  return path.endsWith(".html") ? path.slice(0, -5) : path;
}

function isProtectedPolicePage(pathname: string) {
  const path = normalizePath(pathname);
  return path.startsWith("/police-") && path !== "/police-dashboard";
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  if (!isProtectedPolicePage(url.pathname)) {
    return context.next();
  }

  const session = await requirePoliceSession(context.request, context.env);
  if (session) {
    return context.next();
  }

  const loginUrl = new URL("/police-dashboard.html", url.origin);
  loginUrl.searchParams.set("next", `${url.pathname}${url.search}`);
  return Response.redirect(loginUrl.toString(), 302);
};
