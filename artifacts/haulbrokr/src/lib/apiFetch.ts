const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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
    throw new Error(errorBody.error || "Request failed");
  }

  if (res.status === 204) {
    return null as T;
  }

  return res.json();
}
