import { requireSuperAdminSession } from "../../_lib/auth";
import { badRequest, json, unauthorized } from "../../_lib/api";
import { runSubscriptionReminderCycle } from "../../_lib/subscription-reminders";

export async function onRequestPost(context) {
  if (!(await requireSuperAdminSession(context.request, context.env))) {
    return unauthorized();
  }

  try {
    const payload = await context.request.json().catch(() => ({}));
    const createdBy = typeof payload.created_by === "string" && payload.created_by.trim()
      ? payload.created_by.trim()
      : "Superadmin";

    return json(await runSubscriptionReminderCycle(context.env, createdBy));
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Unable to run reminder cycle");
  }
}

export const onRequestOptions = async () =>
  new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
    },
  });
