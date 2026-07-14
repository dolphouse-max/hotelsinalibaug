const textEncoder = new TextEncoder();

function normalizeBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;

  if (padding === 0) {
    return normalized;
  }

  return normalized + "=".repeat(4 - padding);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(normalizeBase64(value));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64(bytes: ArrayBuffer | Uint8Array): string {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";

  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function encodeBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeBase64Url(value: string): Uint8Array {
  return decodeBase64(value);
}

async function importAesKey(secret: string): Promise<CryptoKey> {
  const rawKey = decodeBase64(secret);

  if (rawKey.byteLength !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }

  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function encryptString(plaintext: string, base64Key: string): Promise<string> {
  const key = await importAesKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plaintext)
  );

  return `${encodeBase64Url(iv)}.${encodeBase64Url(ciphertext)}`;
}

export async function decryptString(ciphertext: string, base64Key: string): Promise<string> {
  const [ivPart, payloadPart] = ciphertext.split(".");

  if (!ivPart || !payloadPart) {
    throw new Error("Encrypted payload is malformed.");
  }

  const key = await importAesKey(base64Key);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(ivPart) },
    key,
    decodeBase64Url(payloadPart)
  );

  return new TextDecoder().decode(plaintext);
}

export async function signValue(value: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return encodeBase64Url(signature);
}

export async function verifySignedValue(
  value: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const key = await importHmacKey(secret);

  return crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), textEncoder.encode(value));
}
