import { forbidden, json, methodNotAllowed } from "../../_lib/api";
import { runSubscriptionReminderCycle } from "../../_lib/subscription-reminders";

function hasValidRunnerToken(request, env) {
  const authHeader = request.headers.get("authorization");

  if (!env.REMINDER_RUNNER_TOKEN || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length).trim() === env.REMINDER_RUNNER_TOKEN;
}

export async function onRequestPost(context) {
  if (!hasValidRunnerToken(context.request, context.env)) {
    return forbidden("Invalid runner token");
  }

  return json(await runSubscriptionReminderCycle(context.env, "Scheduled Runner"));
}

export const onRequest = () => methodNotAllowed();

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
