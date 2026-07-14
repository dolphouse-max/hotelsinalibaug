import { decodeBase64Url, encodeBase64Url, signValue, verifySignedValue } from "./crypto";

interface Env {
  CHECKIN_LINK_SECRET: string;
}

interface CheckinLinkPayload {
  exp: number;
  hotelId: string;
}

function ensureLinkSecret(env: Env): void {
  if (!env.CHECKIN_LINK_SECRET) {
    throw new Error("Missing required environment variable: CHECKIN_LINK_SECRET");
  }
}

export async function createCheckinAccessToken(hotelId: string, env: Env): Promise<string> {
  ensureLinkSecret(env);

  const payload: CheckinLinkPayload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    hotelId,
  };

  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await signValue(encodedPayload, env.CHECKIN_LINK_SECRET);
  return `${encodedPayload}.${signature}`;
}

export async function verifyCheckinAccessToken(
  accessToken: string,
  hotelId: string,
  env: Env
): Promise<void> {
  ensureLinkSecret(env);

  const [encodedPayload, signature] = accessToken.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid access token");
  }

  const isValid = await verifySignedValue(encodedPayload, signature, env.CHECKIN_LINK_SECRET);
  if (!isValid) {
    throw new Error("Invalid access token");
  }

  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as CheckinLinkPayload;

  if (payload.hotelId !== hotelId) {
    throw new Error("Access token does not match hotel");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Access token expired");
  }
}
