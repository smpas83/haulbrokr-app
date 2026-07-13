import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import {
  createAppleClientSecret,
  exchangeAppleAuthorizationCode,
  isAppleAuthConfigured,
  normalizeApplePrivateKey,
  readAppleAuthConfig,
  revokeAppleToken,
  AppleAuthError,
} from "./appleAuth";
import { decryptSecret, encryptSecret, resolveEncryptionKey } from "./appleTokenCrypto";

function generateTestAppleKey(): { pem: string; keyId: string } {
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  return { pem, keyId: "TESTKEYID1" };
}

describe("appleTokenCrypto", () => {
  it("round-trips AES-256-GCM secrets", () => {
    const key = resolveEncryptionKey("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    const encrypted = encryptSecret("refresh-token-value", key);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(decryptSecret(encrypted, key)).toBe("refresh-token-value");
  });

  it("rejects short encryption keys", () => {
    expect(() => resolveEncryptionKey("tooshort")).toThrow(/64 hex|base64/);
  });
});

describe("appleAuth", () => {
  const { pem, keyId } = generateTestAppleKey();

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes escaped PEM newlines", () => {
    const escaped = pem.replace(/\n/g, "\\n");
    expect(normalizeApplePrivateKey(escaped)).toContain("BEGIN PRIVATE KEY");
  });

  it("creates a verifiable ES256 client secret JWT", () => {
    const token = createAppleClientSecret({
      teamId: "TEAMID1234",
      keyId,
      clientId: "com.haulbrokr.mobile",
      privateKeyPem: pem,
    });
    const [headerB64, payloadB64, sigB64] = token.split(".");
    expect(headerB64 && payloadB64 && sigB64).toBeTruthy();
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    expect(header).toEqual({ alg: "ES256", kid: keyId });
    expect(payload.iss).toBe("TEAMID1234");
    expect(payload.sub).toBe("com.haulbrokr.mobile");
    expect(payload.aud).toBe("https://appleid.apple.com");
  });

  it("detects configured Apple credentials", () => {
    expect(
      isAppleAuthConfigured({
        APPLE_TEAM_ID: "TEAMID1234",
        APPLE_KEY_ID: keyId,
        APPLE_CLIENT_ID: "com.haulbrokr.mobile",
        APPLE_PRIVATE_KEY: pem,
      }),
    ).toBe(true);
    expect(isAppleAuthConfigured({})).toBe(false);
  });

  it("rejects incomplete Apple credentials", () => {
    expect(() =>
      readAppleAuthConfig({
        APPLE_TEAM_ID: "TEAMID1234",
        APPLE_KEY_ID: keyId,
      }),
    ).toThrow(/incomplete/i);
  });

  it("exchanges an authorization code for a refresh token", async () => {
    const idTokenPayload = Buffer.from(JSON.stringify({ sub: "apple.subject.1" })).toString("base64url");
    const idToken = `hdr.${idTokenPayload}.sig`;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          refresh_token: "rft_test",
          access_token: "act_test",
          id_token: idToken,
          expires_in: 3600,
        }),
    }) as any;

    const result = await exchangeAppleAuthorizationCode("auth-code", {
      APPLE_TEAM_ID: "TEAMID1234",
      APPLE_KEY_ID: keyId,
      APPLE_CLIENT_ID: "com.haulbrokr.mobile",
      APPLE_PRIVATE_KEY: pem,
    });

    expect(result.refreshToken).toBe("rft_test");
    expect(result.appleSubject).toBe("apple.subject.1");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://appleid.apple.com/auth/token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws AppleAuthError when token exchange fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: "invalid_grant" }),
    }) as any;

    await expect(
      exchangeAppleAuthorizationCode("bad-code", {
        APPLE_TEAM_ID: "TEAMID1234",
        APPLE_KEY_ID: keyId,
        APPLE_CLIENT_ID: "com.haulbrokr.mobile",
        APPLE_PRIVATE_KEY: pem,
      }),
    ).rejects.toBeInstanceOf(AppleAuthError);
  });

  it("revokes tokens and treats invalid_grant as success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: "invalid_grant" }),
    }) as any;

    await expect(
      revokeAppleToken("already-gone", "refresh_token", {
        APPLE_TEAM_ID: "TEAMID1234",
        APPLE_KEY_ID: keyId,
        APPLE_CLIENT_ID: "com.haulbrokr.mobile",
        APPLE_PRIVATE_KEY: pem,
      }),
    ).resolves.toBeUndefined();
  });
});
