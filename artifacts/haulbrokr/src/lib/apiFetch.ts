const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export class ApiFetchError extends Error {
  status: number;
  requestId: string | null;

  constructor(message: string, status: number, requestId: string | null) {
    super(message);
    this.name = "ApiFetchError";
    this.status = status;
    this.requestId = requestId;
  }
}

function normalizeApiPath(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const apiPath = path.startsWith("/api")
    ? path
    : `/api${path.startsWith("/") ? path : `/${path}`}`;

  return `${BASE}${apiPath}`;
}

export async function apiFetch<T = any>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(normalizeApiPath(path), {
    ...options,
    credentials: options?.credentials ?? "include",
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const requestId = res.headers.get("X-Request-Id") ?? errorBody.requestId ?? null;
    const suffix = requestId ? ` (Request ID: ${requestId})` : "";
    throw new ApiFetchError(`${errorBody.error || "Request failed"}${suffix}`, res.status, requestId);
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json();
}
