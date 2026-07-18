export function configureWebPush() {
  return false;
}

export function isPushDeliveryAvailable() {
  return false;
}

export function getVapidPublicKey(env) {
  if (!env.VAPID_PUBLIC_KEY) {
    throw new Error("VAPID public key is missing");
  }

  return env.VAPID_PUBLIC_KEY;
}

export async function sendPushToSubscription() {
  throw new Error("Push delivery is temporarily unavailable in this deployment");
}
