/**
 * Native Sign in with Apple that captures both the identity token (for Clerk)
 * and the authorization code (for HaulBrokr backend token exchange / revocation).
 *
 * Clerk does not revoke Apple tokens on user delete, so HaulBrokr must own the
 * authorization-code → refresh-token → /auth/revoke lifecycle.
 */

import {
  clerkResultErrorMessage,
  resolveOAuthSessionId,
  type OAuthFlowResult,
  type ResolveOAuthSessionOptions,
} from "@/lib/completeOAuthSignUp";
import { getApiBaseUrl } from "@/lib/apiConfig";

type ClerkErrorLike = {
  message?: string;
  longMessage?: string;
  code?: string;
  errors?: Array<{ message?: string; longMessage?: string; code?: string }>;
};

type FutureCreateResult = { error?: ClerkErrorLike | null };

type FutureSignIn = {
  status?: string | null;
  createdSessionId?: string | null;
  existingSession?: { sessionId?: string | null } | null;
  isTransferable?: boolean;
  firstFactorVerification?: { status?: string | null } | null;
  create?: (params: Record<string, unknown>) => Promise<FutureCreateResult>;
  finalize?: (params?: Record<string, unknown>) => Promise<FutureCreateResult>;
  reset?: () => Promise<FutureCreateResult>;
};

type FutureSignUp = {
  id?: string | null;
  status?: string | null;
  createdSessionId?: string | null;
  existingSession?: { sessionId?: string | null } | null;
  emailAddress?: string | null;
  missingFields?: string[] | null;
  requiredFields?: string[] | null;
  unmatchedFields?: string[] | null;
  create?: (params: Record<string, unknown>) => Promise<FutureCreateResult>;
  update?: (params: Record<string, unknown>) => Promise<FutureCreateResult>;
  finalize?: (params?: Record<string, unknown>) => Promise<FutureCreateResult>;
};

export type AppleCredentialNames = {
  firstName?: string | null;
  lastName?: string | null;
};

export type AppleNativeAuthResult = OAuthFlowResult & {
  names?: AppleCredentialNames;
  cancelled?: boolean;
  authorizationCode?: string | null;
};

function throwClerkError(error: ClerkErrorLike | null | undefined, fallback: string): never {
  const message = clerkResultErrorMessage(error) || fallback;
  throw Object.assign(new Error(message), error ?? {});
}

function needsTransfer(signIn: FutureSignIn): boolean {
  if (signIn.isTransferable) return true;
  const verificationStatus = signIn.firstFactorVerification?.status;
  return verificationStatus === "transferable";
}

function hasSession(resource: {
  createdSessionId?: string | null;
  existingSession?: { sessionId?: string | null } | null;
  status?: string | null;
}): boolean {
  return Boolean(
    resource.createdSessionId ||
      resource.existingSession?.sessionId ||
      resource.status === "complete",
  );
}

/** Present the native Apple sheet and return identity token + authorization code. */
export async function requestAppleIdentityToken(): Promise<{
  identityToken: string;
  authorizationCode: string | null;
  names: AppleCredentialNames;
} | null> {
  const [AppleAuthentication, Crypto] = await Promise.all([
    import("expo-apple-authentication"),
    import("expo-crypto"),
  ]);

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error("Apple Authentication is not available on this device.");
  }

  const nonce = Crypto.randomUUID();
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });

    if (!credential.identityToken) {
      throw new Error("No identity token received from Apple Sign-In.");
    }

    return {
      identityToken: credential.identityToken,
      authorizationCode: credential.authorizationCode ?? null,
      names: {
        firstName: credential.fullName?.givenName ?? null,
        lastName: credential.fullName?.familyName ?? null,
      },
    };
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return null;
    }
    throw error;
  }
}

async function createAppleSignUpDirect(
  signUp: FutureSignUp,
  identityToken: string,
): Promise<void> {
  if (typeof signUp.create !== "function") {
    throw new Error("Sign-up is unavailable — cannot finish Apple account setup.");
  }
  const { error } = await signUp.create({
    strategy: "oauth_token_apple",
    token: identityToken,
  });
  if (error) {
    throwClerkError(error, "Apple sign-up could not start.");
  }
}

/**
 * Exchange an Apple identity token with Clerk Future signIn/signUp and return
 * a flow result suitable for `resolveOAuthSessionId` / `setActive`.
 */
export async function exchangeAppleIdentityToken(params: {
  signIn: FutureSignIn;
  signUp: FutureSignUp;
  identityToken: string;
  setActive?: OAuthFlowResult["setActive"];
  names?: AppleCredentialNames;
  authorizationCode?: string | null;
}): Promise<AppleNativeAuthResult> {
  const { signIn, signUp, identityToken, setActive, names, authorizationCode } = params;

  if (typeof signIn.create !== "function") {
    throw new Error("Sign-in is unavailable — authentication is still initialising.");
  }

  const { error: signInError } = await signIn.create({
    strategy: "oauth_token_apple",
    token: identityToken,
  });

  if (signInError) {
    const msg = clerkResultErrorMessage(signInError).toLowerCase();
    if (
      /external_account_not_found|couldn't find your account|no account|identifier.*not.*found/i.test(
        msg,
      ) ||
      signInError.code === "external_account_not_found"
    ) {
      await createAppleSignUpDirect(signUp, identityToken);
      return {
        createdSessionId: signUp.createdSessionId ?? null,
        setActive,
        signIn,
        signUp,
        names,
        authorizationCode,
      };
    }
    throwClerkError(signInError, "Apple sign-in failed.");
  }

  if (hasSession(signIn) && !needsTransfer(signIn)) {
    return {
      createdSessionId:
        signIn.createdSessionId ?? signIn.existingSession?.sessionId ?? null,
      setActive,
      signIn,
      signUp,
      names,
      authorizationCode,
    };
  }

  if (needsTransfer(signIn) || !hasSession(signIn)) {
    if (typeof signUp.create !== "function") {
      throw new Error("Sign-up is unavailable — cannot finish Apple account setup.");
    }

    const { error: transferError } = await signUp.create({ transfer: true });

    if (transferError || !signUp.id) {
      await createAppleSignUpDirect(signUp, identityToken);
    }

    return {
      createdSessionId: signUp.createdSessionId ?? null,
      setActive,
      signIn,
      signUp,
      names,
      authorizationCode,
    };
  }

  return {
    createdSessionId: null,
    setActive,
    signIn,
    signUp,
    names,
    authorizationCode,
  };
}

/** Full native Apple → Clerk session resolution, including authorization code. */
export async function completeNativeAppleSignIn(params: {
  signIn: FutureSignIn;
  signUp: FutureSignUp;
  setActive?: OAuthFlowResult["setActive"];
}): Promise<{
  sessionId: string | null;
  cancelled: boolean;
  names?: AppleCredentialNames;
  authorizationCode: string | null;
}> {
  const apple = await requestAppleIdentityToken();
  if (!apple) {
    return { sessionId: null, cancelled: true, authorizationCode: null };
  }

  const flow = await exchangeAppleIdentityToken({
    ...params,
    identityToken: apple.identityToken,
    names: apple.names,
    authorizationCode: apple.authorizationCode,
  });

  const opts: ResolveOAuthSessionOptions = {
    firstName: apple.names.firstName,
    lastName: apple.names.lastName,
  };

  const sessionId = await resolveOAuthSessionId(flow, opts);
  return {
    sessionId,
    cancelled: false,
    names: apple.names,
    authorizationCode: apple.authorizationCode,
  };
}

/**
 * Best-effort POST of the Apple authorization code to the HaulBrokr API so the
 * refresh token can be stored encrypted for later revocation. Never blocks sign-in.
 */
export async function submitAppleAuthorizationCode(opts: {
  getToken: () => Promise<string | null>;
  authorizationCode: string;
}): Promise<void> {
  const token = await opts.getToken();
  if (!token) return;

  const res = await fetch(`${getApiBaseUrl()}/account/apple-authorization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ authorizationCode: opts.authorizationCode }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apple authorization storage failed (${res.status}): ${text}`);
  }
}
