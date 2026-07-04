import { createHmac, timingSafeEqual, randomUUID } from "crypto";

const TOKEN_TTL_SEC = 900;

function getSecret(): string {
  const secret = process.env.UPLOAD_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "UPLOAD_TOKEN_SECRET is not set. Set this environment variable to a strong random secret before accepting file uploads.",
    );
  }
  return secret;
}

function sign(scope: "upload" | "storage", encoded: string): string {
  return createHmac("sha256", getSecret())
    .update(`${scope}:${encoded}`)
    .digest("base64url");
}

export interface UploadTokenPayload {
  objectPath: string;
  profileId: string;
  maxSize: number;
  contentType: string;
  issuedAt: number;
  nonce: string;
}

export function issueUploadToken(
  payload: Omit<UploadTokenPayload, "nonce">,
): string {
  const full: UploadTokenPayload = { ...payload, nonce: randomUUID() };
  const encoded = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = sign("upload", encoded);
  return `${encoded}.${sig}`;
}

type VerifyError =
  | "malformed"
  | "invalid_signature"
  | "expired"
  | "profile_mismatch"
  | "path_mismatch";

function verify<
  T extends { issuedAt: number; profileId: string; objectPath: string },
>(
  scope: "upload" | "storage",
  token: string,
  expectedProfileId: string,
  expectedObjectPath: string,
): { ok: true; payload: T } | { ok: false; error: VerifyError } {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex < 1) return { ok: false, error: "malformed" };

  const encoded = token.slice(0, dotIndex);
  const sig = token.slice(dotIndex + 1);

  let expectedSig: string;
  try {
    expectedSig = sign(scope, encoded);
  } catch {
    return { ok: false, error: "invalid_signature" };
  }

  let sigValid = false;
  try {
    sigValid = timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    sigValid = false;
  }
  if (!sigValid) return { ok: false, error: "invalid_signature" };

  let payload: T;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as T;
  } catch {
    return { ok: false, error: "malformed" };
  }

  if (
    typeof payload.objectPath !== "string" ||
    typeof payload.profileId !== "string" ||
    typeof payload.issuedAt !== "number"
  ) {
    return { ok: false, error: "malformed" };
  }

  if (Date.now() / 1000 - payload.issuedAt > TOKEN_TTL_SEC) {
    return { ok: false, error: "expired" };
  }

  if (payload.profileId !== expectedProfileId) {
    return { ok: false, error: "profile_mismatch" };
  }

  if (payload.objectPath !== expectedObjectPath) {
    return { ok: false, error: "path_mismatch" };
  }

  return { ok: true, payload };
}

export function verifyUploadToken(
  token: string,
  expectedProfileId: string,
  expectedObjectPath: string,
):
  | { ok: true; payload: UploadTokenPayload }
  | { ok: false; error: VerifyError } {
  const result = verify<UploadTokenPayload>(
    "upload",
    token,
    expectedProfileId,
    expectedObjectPath,
  );
  if (!result.ok) return result;
  if (
    typeof result.payload.maxSize !== "number" ||
    typeof result.payload.contentType !== "string" ||
    typeof result.payload.nonce !== "string"
  ) {
    return { ok: false, error: "malformed" };
  }
  return result;
}

const consumedUploadTokens = new Set<string>();

export function markUploadTokenConsumed(token: string): void {
  consumedUploadTokens.add(token);
}

export function isUploadTokenConsumed(token: string): boolean {
  return consumedUploadTokens.has(token);
}

export interface StorageTokenPayload {
  objectPath: string;
  profileId: string;
  issuedAt: number;
  generation: string;
}

export function issueStorageToken(payload: StorageTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign("storage", encoded);
  return `${encoded}.${sig}`;
}

export type StorageTokenError =
  | "malformed"
  | "invalid_signature"
  | "expired"
  | "profile_mismatch"
  | "path_mismatch";

export function verifyStorageToken(
  token: string,
  expectedProfileId: string,
  expectedObjectPath: string,
):
  | { ok: true; payload: StorageTokenPayload }
  | { ok: false; error: StorageTokenError } {
  return verify<StorageTokenPayload>(
    "storage",
    token,
    expectedProfileId,
    expectedObjectPath,
  );
}
