import webpush from "web-push";

let vapidConfigured = false;

export function configureWebPush(env) {
  if (vapidConfigured) {
    return;
  }

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    throw new Error("VAPID configuration is missing");
  }

  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

export function getVapidPublicKey(env) {
  if (!env.VAPID_PUBLIC_KEY) {
    throw new Error("VAPID public key is missing");
  }

  return env.VAPID_PUBLIC_KEY;
}

export async function sendPushToSubscription(env, subscription, payload) {
  configureWebPush(env);

  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload)
  );
}
