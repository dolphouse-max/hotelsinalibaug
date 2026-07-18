import { json } from "../../_lib/api";
import { clearSessionCookie } from "../../_lib/auth";

export const onRequestPost: PagesFunction = async () => {
  const headers = new Headers();
  headers.append("Set-Cookie", clearSessionCookie());

  return json(
    {
      ok: true,
    },
    { headers }
  );
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
