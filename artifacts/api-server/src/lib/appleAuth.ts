import crypto from "node:crypto";

const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const APPLE_AUD = "https://appleid.apple.com";
/** Apple allows client secrets up to ~6 months; use 5 months for safety. */
const CLIENT_SECRET_TTL_SECONDS = 60 * 60 * 24 * 150;

export type AppleAuthConfig = {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKeyPem: string;
};

export type AppleTokenExchangeResult = {
  accessToken?: string;
  refreshToken: string;
  idToken?: string;
  expiresIn?: number;
  appleSubject: string | null;
};

export class AppleAuthError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "AppleAuthError";
    this.status = status;
    this.body = body;
  }
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/**
 * Normalize a Sign in with Apple .p8 private key from env storage.
 * Supports PEM with real newlines, escaped `\n`, or base64-encoded PEM.
 */
export function normalizeApplePrivateKey(raw: string): string {
  let value = raw.trim();
  if (!value) {
    throw new Error("APPLE_PRIVATE_KEY is empty.");
  }

  if (!value.includes("BEGIN") && !value.includes(" ")) {
    try {
      const decoded = Buffer.from(value, "base64").toString("utf8");
      if (decoded.includes("BEGIN")) {
        value = decoded;
      }
    } catch {
      // keep original
    }
  }

  value = value.replace(/\\n/g, "\n").trim();
  if (!value.includes("BEGIN PRIVATE KEY")) {
    throw new Error("APPLE_PRIVATE_KEY must be a PKCS#8 PEM private key (.p8).");
  }
  return value;
}

export function readAppleAuthConfig(env: NodeJS.ProcessEnv = process.env): AppleAuthConfig | null {
  const teamId = env.APPLE_TEAM_ID?.trim() ?? "";
  const keyId = env.APPLE_KEY_ID?.trim() ?? "";
  const clientId = env.APPLE_CLIENT_ID?.trim() ?? "";
  const privateKeyRaw = env.APPLE_PRIVATE_KEY?.trim() ?? "";

  const anySet = Boolean(teamId || keyId || clientId || privateKeyRaw);
  if (!anySet) return null;

  if (!teamId || !keyId || !clientId || !privateKeyRaw) {
    throw new Error(
      "Apple Sign in credentials are incomplete. Set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, and APPLE_PRIVATE_KEY together.",
    );
  }

  return {
    teamId,
    keyId,
    clientId,
    privateKeyPem: normalizeApplePrivateKey(privateKeyRaw),
  };
}

export function isAppleAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    return readAppleAuthConfig(env) !== null;
  } catch {
    return false;
  }
}

/** Create a short-lived client_secret JWT for Apple's token/revoke endpoints (ES256). */
export function createAppleClientSecret(
  config: AppleAuthConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = { alg: "ES256", kid: config.keyId };
  const payload = {
    iss: config.teamId,
    iat: nowSeconds,
    exp: nowSeconds + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUD,
    sub: config.clientId,
  };

  const encodedHeader = base64urlJson(header);
  const encodedPayload = base64urlJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = crypto.createPrivateKey(config.privateKeyPem);
  const signature = crypto.sign("SHA256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });

  return `${signingInput}.${signature.toString("base64url")}`;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function postAppleForm(
  url: string,
  body: URLSearchParams,
): Promise<{ ok: boolean; status: number; text: string; json: Record<string, unknown> | null }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = null;
    }
  }
  return { ok: res.ok, status: res.status, text, json };
}

/**
 * Exchange a one-time Apple authorization code for tokens.
 * Must be called promptly after native Sign in with Apple.
 */
export async function exchangeAppleAuthorizationCode(
  authorizationCode: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AppleTokenExchangeResult> {
  const config = readAppleAuthConfig(env);
  if (!config) {
    throw new Error("Apple Sign in credentials are not configured.");
  }

  const clientSecret = createAppleClientSecret(config);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: "authorization_code",
  });

  const result = await postAppleForm(APPLE_TOKEN_URL, body);
  if (!result.ok) {
    throw new AppleAuthError(
      `Apple token exchange failed (${result.status})`,
      result.status,
      result.text,
    );
  }

  const refreshToken = typeof result.json?.refresh_token === "string" ? result.json.refresh_token : "";
  if (!refreshToken) {
    throw new AppleAuthError(
      "Apple token exchange returned no refresh_token",
      result.status,
      result.text,
    );
  }

  const idToken = typeof result.json?.id_token === "string" ? result.json.id_token : undefined;
  const accessToken = typeof result.json?.access_token === "string" ? result.json.access_token : undefined;
  const expiresIn = typeof result.json?.expires_in === "number" ? result.json.expires_in : undefined;
  const subjectFromId = idToken ? decodeJwtPayload(idToken)?.sub : null;
  const appleSubject = typeof subjectFromId === "string" ? subjectFromId : null;

  return { refreshToken, idToken, accessToken, expiresIn, appleSubject };
}

/**
 * Revoke an Apple refresh (or access) token. Idempotent for already-revoked tokens
 * when Apple returns 200; treats some invalid_grant responses as success.
 */
export async function revokeAppleToken(
  token: string,
  tokenTypeHint: "refresh_token" | "access_token" = "refresh_token",
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const config = readAppleAuthConfig(env);
  if (!config) {
    throw new Error("Apple Sign in credentials are not configured.");
  }

  const clientSecret = createAppleClientSecret(config);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: clientSecret,
    token,
    token_type_hint: tokenTypeHint,
  });

  const result = await postAppleForm(APPLE_REVOKE_URL, body);
  if (result.ok) return;

  const errorCode = typeof result.json?.error === "string" ? result.json.error : "";
  // Token already invalid / revoked — treat as success for idempotent deletion retries.
  if (result.status === 400 && /invalid_grant|invalid_token/i.test(errorCode)) {
    return;
  }

  throw new AppleAuthError(
    `Apple token revoke failed (${result.status})`,
    result.status,
    result.text,
  );
}
