/**
 * Completes Clerk OAuth / native Apple-Google sign-up when the provider
 * transfer leaves the SignUp in `missing_requirements` (usually username).
 *
 * Apple reviewers hit this on first Sign in with Apple because Clerk requires
 * a username and Apple does not supply one.
 */

type SignUpLike = {
  status?: string | null;
  createdSessionId?: string | null;
  emailAddress?: string | null;
  username?: string | null;
  missingFields?: string[] | null;
  unmatchedFields?: string[] | null;
  update?: (params: Record<string, unknown>) => Promise<unknown>;
};

type SignInLike = {
  status?: string | null;
  createdSessionId?: string | null;
  existingSession?: { sessionId?: string | null } | null;
};

export type OAuthFlowResult = {
  createdSessionId?: string | null;
  setActive?: ((params: { session: string }) => Promise<void>) | undefined;
  signIn?: SignInLike | null;
  signUp?: SignUpLike | null;
};

/** Sanitize a string into a Clerk-safe username (letters, numbers, underscore). */
export function sanitizeClerkUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (cleaned.length >= 4) return cleaned.slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 8);
  return (`user_${cleaned}_${suffix}`).replace(/_+/g, "_").slice(0, 48);
}

/** Build a username from the Apple/Google email local-part, with a short unique suffix. */
export function usernameFromEmail(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0]?.trim() || "user";
  const base = sanitizeClerkUsername(local);
  const suffix = Math.random().toString(36).slice(2, 6);
  const combined = `${base}_${suffix}`.replace(/_+/g, "_");
  return combined.slice(0, 48);
}

function missingIncludes(signUp: SignUpLike | null | undefined, field: string): boolean {
  const fields = [
    ...(signUp?.missingFields ?? []),
    ...(signUp?.unmatchedFields ?? []),
  ].map((f) => String(f).toLowerCase());
  return fields.includes(field.toLowerCase());
}

/**
 * If OAuth returned no session because SignUp still needs a username (or similar),
 * fill required fields and return the resulting session id.
 */
export async function resolveOAuthSessionId(
  result: OAuthFlowResult,
): Promise<string | null> {
  const fromResult =
    result.createdSessionId ??
    result.signIn?.createdSessionId ??
    result.signIn?.existingSession?.sessionId ??
    result.signUp?.createdSessionId ??
    null;

  if (fromResult) return fromResult;

  const signUp = result.signUp;
  if (!signUp) return null;

  const needsUsername =
    missingIncludes(signUp, "username") ||
    (signUp.status === "missing_requirements" && !signUp.username);

  if (needsUsername && typeof signUp.update === "function") {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const username = usernameFromEmail(signUp.emailAddress);
      try {
        await signUp.update({ username });
        if (signUp.createdSessionId) return signUp.createdSessionId;
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
        if (!/username|taken|exists|unique|identifier/i.test(msg)) throw err;
      }
    }
    if (lastError) throw lastError;
  } else if (signUp.status === "missing_requirements" && typeof signUp.update === "function") {
    // Best-effort: some Clerk configs still need an update tick after transfer.
    await signUp.update({});
  }

  return signUp.createdSessionId ?? null;
}

/** True when the user dismissed the native Apple/Google sheet (no error thrown). */
export function isOAuthUserCancel(result: OAuthFlowResult): boolean {
  if (result.createdSessionId) return false;
  if (result.signUp?.status === "missing_requirements") return false;
  if (result.signIn?.status === "complete") return false;
  // Native Apple cancel returns null session with no transferable sign-up work left.
  return !result.signUp?.missingFields?.length && !result.signUp?.createdSessionId;
}
