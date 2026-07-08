type ClerkLikeError = {
  message?: string;
  longMessage?: string;
  code?: string;
  status?: number;
  statusText?: string;
  clerkError?: boolean;
  errors?: Array<{
    message?: string;
    longMessage?: string;
    code?: string;
    meta?: Record<string, unknown>;
  }>;
  cause?: unknown;
  response?: {
    status?: number;
    statusText?: string;
    data?: unknown;
    body?: unknown;
  };
};

const MAX_DEPTH = 6;

function safeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return `[Function ${(value as { name?: string }).name || "anonymous"}]`;
  if (depth >= MAX_DEPTH) return "[MaxDepth]";
  if (value instanceof Error) return serializeAuthError(value, depth + 1, seen);
  if (typeof value !== "object") return String(value);

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => safeValue(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    out[key] = safeValue(nested, depth + 1, seen);
  }
  return out;
}

/** Deep-serialize auth errors, including nested Clerk errors and HTTP response bodies. */
export function serializeAuthError(error: unknown, depth = 0, seen = new WeakSet<object>()): Record<string, unknown> {
  if (error == null) return { value: null };

  if (error instanceof Error) {
    const err = error as ClerkLikeError & Error;
    const serialized: Record<string, unknown> = {
      name: err.name,
      message: err.message,
      code: err.code,
      stack: err.stack,
      status: err.status,
      statusText: err.statusText,
      clerkError: err.clerkError,
    };

    if (err.errors?.length) {
      serialized.clerkErrors = err.errors.map((item) => ({
        code: item.code,
        message: item.message,
        longMessage: item.longMessage,
        meta: item.meta ? safeValue(item.meta, depth + 1, seen) : undefined,
      }));
    }

    if (err.response) {
      serialized.response = {
        status: err.response.status,
        statusText: err.response.statusText,
        data: safeValue(err.response.data ?? err.response.body, depth + 1, seen),
      };
    }

    if (err.cause) {
      serialized.cause = serializeAuthError(err.cause, depth + 1, seen);
    }

    for (const key of Object.keys(err)) {
      if (key in serialized || key === "stack") continue;
      const nested = (err as unknown as Record<string, unknown>)[key];
      if (typeof nested === "function") continue;
      serialized[key] = safeValue(nested, depth + 1, seen);
    }

    return serialized;
  }

  if (typeof error === "object") {
    const err = error as ClerkLikeError;
    if (err.errors || err.message || err.longMessage || err.code) {
      return serializeAuthError(Object.assign(new Error(err.message ?? err.longMessage ?? "Clerk error"), err), depth, seen);
    }
    return safeValue(error, depth, seen) as Record<string, unknown>;
  }

  return { message: String(error) };
}

export function logClerkAuthStep(
  scope: string,
  step: string,
  details?: Record<string, unknown>,
) {
  console.log(`[ClerkAuth:${scope}] ${step}`, details ?? {});
}

export function logClerkAuthError(scope: string, error: unknown, context?: Record<string, unknown>) {
  const serialized = serializeAuthError(error);
  console.error(`[ClerkAuth:${scope}]`, {
    ...context,
    error: serialized,
    errorJson: JSON.stringify(serialized, null, 2),
  });
}

export function clerkErrorMessage(error: ClerkLikeError | null | undefined): string {
  if (!error) return "";
  if (error.errors?.length) {
    return error.errors
      .map((item) => item.longMessage ?? item.message)
      .filter(Boolean)
      .join(" ");
  }
  return error.longMessage ?? error.message ?? "";
}

export function isUserCancelledAuthError(error: unknown): boolean {
  const err = error as ClerkLikeError & { code?: string };
  const code = String(err?.code ?? "");
  if (code === "ERR_REQUEST_CANCELED" || code === "SIGN_IN_CANCELLED" || code === "-5") {
    return true;
  }

  const haystack = [
    err?.message,
    err?.longMessage,
    ...(err?.errors ?? []).flatMap((item) => [item.message, item.longMessage, item.code]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /cancelled|canceled|user.*cancel/.test(haystack);
}

/** True when Clerk reports an invalid or expired verification code. */
export function isInvalidVerificationCodeError(error: unknown): boolean {
  const err = error as ClerkLikeError;
  const haystack = [
    err?.message,
    err?.longMessage,
    err?.code,
    ...(err?.errors ?? []).flatMap((item) => [item.message, item.longMessage, item.code]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /incorrect|invalid|expired|wrong|mismatch|verification.*fail|code.*not.*valid/.test(haystack);
}
