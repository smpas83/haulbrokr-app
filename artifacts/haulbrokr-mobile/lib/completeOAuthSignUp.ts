/**
 * Completes Clerk OAuth / native Apple-Google sign-up when the provider
 * transfer leaves SignUp in `missing_requirements` (usually username).
 *
 * Apple App Review hits this on first Sign in with Apple because Clerk requires
 * a username (and sometimes legal_accepted / name) that Apple does not supply.
 *
 * Clerk Future / Core 3 APIs return `{ error }` from update()/finalize() instead
 * of throwing — callers must check the return value.
 */

type ClerkErrorLike = {
  message?: string;
  longMessage?: string;
  code?: string;
  errors?: Array<{ message?: string; longMessage?: string; code?: string }>;
};

type SignUpLike = {
  id?: string | null;
  status?: string | null;
  createdSessionId?: string | null;
  existingSession?: { sessionId?: string | null } | null;
  emailAddress?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  missingFields?: string[] | null;
  unmatchedFields?: string[] | null;
  requiredFields?: string[] | null;
  unverifiedFields?: string[] | null;
  update?: (params: Record<string, unknown>) => Promise<{ error?: ClerkErrorLike | null } | unknown>;
  finalize?: (params?: Record<string, unknown>) => Promise<{ error?: ClerkErrorLike | null } | unknown>;
};

type SignInLike = {
  status?: string | null;
  createdSessionId?: string | null;
  existingSession?: { sessionId?: string | null } | null;
  finalize?: (params?: Record<string, unknown>) => Promise<{ error?: ClerkErrorLike | null } | unknown>;
};

export type OAuthFlowResult = {
  createdSessionId?: string | null;
  setActive?: ((params: { session: string }) => Promise<void>) | undefined;
  signIn?: SignInLike | null;
  signUp?: SignUpLike | null;
};

export type ResolveOAuthSessionOptions = {
  /** Prefer Apple credential fullName when present. */
  firstName?: string | null;
  lastName?: string | null;
};

function extractError(result: unknown): ClerkErrorLike | null {
  if (!result || typeof result !== "object") return null;
  const err = (result as { error?: ClerkErrorLike | null }).error;
  return err ?? null;
}

export function clerkResultErrorMessage(error: ClerkErrorLike | null | undefined): string {
  if (!error) return "";
  if (error.errors?.length) {
    return error.errors
      .map((item) => item.longMessage ?? item.message)
      .filter(Boolean)
      .join(" ");
  }
  return error.longMessage ?? error.message ?? "";
}

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

function fieldList(signUp: SignUpLike | null | undefined): string[] {
  return [
    ...(signUp?.missingFields ?? []),
    ...(signUp?.unmatchedFields ?? []),
    ...(signUp?.requiredFields ?? []),
  ].map((f) => String(f).toLowerCase());
}

function needsField(signUp: SignUpLike | null | undefined, field: string): boolean {
  return fieldList(signUp).includes(field.toLowerCase());
}

function snapshotFields(signUp: SignUpLike | null | undefined): string {
  const fields = Array.from(new Set(fieldList(signUp)));
  return fields.length ? fields.join(", ") : "(none)";
}

async function applyMissingSignUpFields(
  signUp: SignUpLike,
  opts?: ResolveOAuthSessionOptions,
): Promise<void> {
  // Calling update() without a SignUp attempt id yields Clerk's
  // "No sign up attempt was found" (GET client sign_ups/:id).
  if (!signUp.id) {
    throw new Error(
      "No sign up attempt was found after Apple transfer. Please try Continue with Apple again.",
    );
  }

  const patch: Record<string, unknown> = {};

  const needsUsername =
    needsField(signUp, "username") ||
    (signUp.status === "missing_requirements" && !signUp.username);

  if (needsUsername) {
    patch.username = usernameFromEmail(signUp.emailAddress);
  }
  if (needsField(signUp, "legal_accepted")) {
    patch.legalAccepted = true;
  }
  if (needsField(signUp, "first_name") && (opts?.firstName || !signUp.firstName)) {
    patch.firstName = (opts?.firstName ?? "HaulBrokr").trim() || "HaulBrokr";
  }
  if (needsField(signUp, "last_name") && (opts?.lastName || !signUp.lastName)) {
    patch.lastName = (opts?.lastName ?? "User").trim() || "User";
  }

  if (Object.keys(patch).length === 0) {
    if (signUp.status === "missing_requirements" && typeof signUp.update === "function") {
      const result = await signUp.update({});
      const err = extractError(result);
      if (err) throw Object.assign(new Error(clerkResultErrorMessage(err) || "Sign-up update failed"), err);
    }
    return;
  }

  if (typeof signUp.update !== "function") {
    throw new Error("Sign-up update is unavailable — cannot finish Apple account setup.");
  }

  // Retry username collisions with a fresh suffix.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const attemptPatch = { ...patch };
    if (needsUsername) {
      attemptPatch.username = usernameFromEmail(signUp.emailAddress);
    }
    try {
      const result = await signUp.update(attemptPatch);
      const err = extractError(result);
      if (err) {
        const msg = clerkResultErrorMessage(err).toLowerCase();
        if (needsUsername && /username|taken|exists|unique|identifier/i.test(msg) && attempt < 3) {
          lastError = err;
          continue;
        }
        throw Object.assign(new Error(clerkResultErrorMessage(err) || "Sign-up update failed"), err);
      }
      return;
    } catch (err) {
      lastError = err;
      const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
      if (needsUsername && /username|taken|exists|unique|identifier/i.test(msg) && attempt < 3) {
        continue;
      }
      throw err;
    }
  }
  if (lastError) throw lastError;
}

async function finalizeIfNeeded(resource: SignUpLike | SignInLike | null | undefined): Promise<string | null> {
  if (!resource) return null;
  if (resource.createdSessionId) return resource.createdSessionId;
  if (resource.status !== "complete" || typeof resource.finalize !== "function") {
    return resource.createdSessionId ?? null;
  }
  const result = await resource.finalize({});
  const err = extractError(result);
  if (err) {
    // Session may already exist even if finalize reports a soft error.
    if (resource.createdSessionId) return resource.createdSessionId;
    throw Object.assign(new Error(clerkResultErrorMessage(err) || "Could not finalize session"), err);
  }
  return resource.createdSessionId ?? null;
}

/**
 * If OAuth returned no session because SignUp still needs fields (username, etc.),
 * fill them, finalize, and return the resulting session id.
 */
export async function resolveOAuthSessionId(
  result: OAuthFlowResult,
  opts?: ResolveOAuthSessionOptions,
): Promise<string | null> {
  const fromResult =
    result.createdSessionId ??
    result.signIn?.createdSessionId ??
    result.signIn?.existingSession?.sessionId ??
    result.signUp?.createdSessionId ??
    result.signUp?.existingSession?.sessionId ??
    null;

  if (fromResult) return fromResult;

  const signUp = result.signUp;
  if (signUp) {
    const pending =
      signUp.status === "missing_requirements" ||
      fieldList(signUp).length > 0 ||
      signUp.status === "complete";

    if (pending) {
      // Without an attempt id, update() always fails — surface a clear error instead.
      if (
        !signUp.id &&
        (signUp.status === "missing_requirements" || fieldList(signUp).length > 0)
      ) {
        throw new Error(
          "No sign up attempt was found after Apple transfer. Please try Continue with Apple again.",
        );
      }

      if (signUp.id && (signUp.status === "missing_requirements" || fieldList(signUp).length > 0)) {
        await applyMissingSignUpFields(signUp, opts);
      }

      // After filling requirements, another pass may still list fields (e.g. legal + username).
      if (signUp.id && (signUp.status === "missing_requirements" || needsField(signUp, "username"))) {
        await applyMissingSignUpFields(signUp, opts);
      }

      const sessionFromFinalize = await finalizeIfNeeded(signUp);
      if (sessionFromFinalize) return sessionFromFinalize;
      if (signUp.createdSessionId) return signUp.createdSessionId;
      if (signUp.existingSession?.sessionId) return signUp.existingSession.sessionId;

      throw new Error(
        `Apple sign-up is incomplete (status=${signUp.status ?? "unknown"}, missing=${snapshotFields(signUp)}). ` +
          "In Clerk Dashboard, make Username optional for social sign-up, or ensure Native App bundle ID matches this build.",
      );
    }
  }

  const signIn = result.signIn;
  if (signIn?.status === "complete" || signIn?.existingSession?.sessionId) {
    const sessionFromFinalize = await finalizeIfNeeded(signIn);
    if (sessionFromFinalize) return sessionFromFinalize;
    if (signIn.existingSession?.sessionId) return signIn.existingSession.sessionId;
  }

  return (
    result.signIn?.createdSessionId ??
    result.signIn?.existingSession?.sessionId ??
    result.signUp?.createdSessionId ??
    result.signUp?.existingSession?.sessionId ??
    null
  );
}

/** True when the user dismissed the native Apple/Google sheet (no error thrown). */
export function isOAuthUserCancel(result: OAuthFlowResult): boolean {
  if (result.createdSessionId) return false;
  if (result.signUp?.status === "missing_requirements") return false;
  if (result.signUp?.status === "complete") return false;
  if (result.signIn?.status === "complete") return false;
  if (fieldList(result.signUp).length > 0) return false;
  // Native Apple cancel returns null session with no transferable sign-up work left.
  return !result.signUp?.createdSessionId && !result.signIn?.createdSessionId;
}

/** Compact debug snapshot for console / review logs. */
export function oauthFlowDebugSnapshot(result: OAuthFlowResult): Record<string, unknown> {
  return {
    createdSessionId: result.createdSessionId ?? null,
    signInStatus: result.signIn?.status ?? null,
    signInSession: result.signIn?.createdSessionId ?? null,
    signUpStatus: result.signUp?.status ?? null,
    signUpSession: result.signUp?.createdSessionId ?? null,
    missingFields: result.signUp?.missingFields ?? [],
    requiredFields: result.signUp?.requiredFields ?? [],
    unverifiedFields: result.signUp?.unverifiedFields ?? [],
    email: result.signUp?.emailAddress ?? null,
    signUpId: (result.signUp as { id?: string | null } | null | undefined)?.id ?? null,
  };
}
