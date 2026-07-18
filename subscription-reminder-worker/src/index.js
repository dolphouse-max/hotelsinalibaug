export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReminderCycle(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/run-now" && request.method === "POST") {
      const authHeader = request.headers.get("authorization");
      if (!env.CRON_ADMIN_TOKEN || authHeader !== `Bearer ${env.CRON_ADMIN_TOKEN}`) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }

      return runReminderCycle(env);
    }

    return new Response(JSON.stringify({ ok: true, service: "subscription-reminder-worker" }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  },
};

async function runReminderCycle(env) {
  if (!env.REMINDER_ENDPOINT || !env.REMINDER_RUNNER_TOKEN) {
    return new Response(JSON.stringify({ error: "Worker secrets are not configured" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const response = await fetch(env.REMINDER_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.REMINDER_RUNNER_TOKEN}`,
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ source: "cron-worker" }),
  });

  const text = await response.text();

  return new Response(text || JSON.stringify({ ok: response.ok }), {
    status: response.status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
