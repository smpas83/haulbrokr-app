type ClerkLikeError = {
  message?: string;
  longMessage?: string;
  code?: string;
  errors?: Array<{ message?: string; longMessage?: string; code?: string }>;
};

/** Structured console logging for Clerk failures during App Store review debugging. */
export function logClerkAuthError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  const err = error as ClerkLikeError;
  const clerkErrors = err?.errors?.map((item) => ({
    code: item.code,
    message: item.message,
    longMessage: item.longMessage,
  }));
  console.error(`[ClerkAuth:${scope}]`, {
    message: err?.message ?? err?.longMessage,
    code: err?.code,
    clerkErrors,
    ...context,
  });
}

export function clerkErrorMessage(
  error: ClerkLikeError | null | undefined,
): string {
  if (!error) return "";
  if (error.errors?.length) {
    return error.errors
      .map((item) => item.longMessage ?? item.message)
      .filter(Boolean)
      .join(" ");
  }
  return error.longMessage ?? error.message ?? "";
}

/** True when Clerk reports an invalid or expired verification code. */
export function isInvalidVerificationCodeError(error: unknown): boolean {
  const err = error as ClerkLikeError;
  const haystack = [
    err?.message,
    err?.longMessage,
    err?.code,
    ...(err?.errors ?? []).flatMap((item) => [
      item.message,
      item.longMessage,
      item.code,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /incorrect|invalid|expired|wrong|mismatch|verification.*fail|code.*not.*valid/.test(
    haystack,
  );
}
