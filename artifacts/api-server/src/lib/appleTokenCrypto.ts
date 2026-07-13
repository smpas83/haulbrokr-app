import crypto from "node:crypto";

const KEY_BYTE_LENGTH = 32;
const IV_BYTE_LENGTH = 12;
const VERSION_PREFIX = "v1";

/**
 * Resolve APPLE_TOKEN_ENCRYPTION_KEY into a 32-byte AES key.
 * Accepts 64-char hex or standard/base64url-encoded 32 bytes.
 */
export function resolveEncryptionKey(raw: string): Buffer {
  const value = raw.trim();
  if (!value) {
    throw new Error("APPLE_TOKEN_ENCRYPTION_KEY is empty.");
  }

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }

  const asBase64 = Buffer.from(value, "base64");
  if (asBase64.length === KEY_BYTE_LENGTH) {
    return asBase64;
  }

  throw new Error(
    "APPLE_TOKEN_ENCRYPTION_KEY must be 64 hex characters or base64 for 32 bytes.",
  );
}

/** Encrypt a secret string with AES-256-GCM. Returns `v1:iv:tag:ciphertext` (base64url). */
export function encryptSecret(plaintext: string, keyMaterial: Buffer): string {
  if (keyMaterial.length !== KEY_BYTE_LENGTH) {
    throw new Error("Encryption key must be 32 bytes.");
  }
  const iv = crypto.randomBytes(IV_BYTE_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyMaterial, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/** Decrypt a value produced by encryptSecret. */
export function decryptSecret(payload: string, keyMaterial: Buffer): string {
  if (keyMaterial.length !== KEY_BYTE_LENGTH) {
    throw new Error("Encryption key must be 32 bytes.");
  }
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION_PREFIX) {
    throw new Error("Unsupported encrypted secret format.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyMaterial, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function getAppleTokenEncryptionKey(
  env: NodeJS.ProcessEnv = process.env,
): Buffer {
  const raw = env.APPLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("APPLE_TOKEN_ENCRYPTION_KEY is not configured.");
  }
  return resolveEncryptionKey(raw);
}
