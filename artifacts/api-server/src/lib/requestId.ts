import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._~:/@-]+$/;

export function requestIdFromHeaders(headers: IncomingHttpHeaders): string | undefined {
  const raw = headers["x-request-id"] ?? headers["x-correlation-id"];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (!candidate) return undefined;

  const value = candidate.trim();
  if (!value || value.length > MAX_REQUEST_ID_LENGTH) return undefined;
  if (!SAFE_REQUEST_ID.test(value)) return undefined;
  return value;
}

export function createRequestId(headers: IncomingHttpHeaders): string {
  return requestIdFromHeaders(headers) ?? randomUUID();
}
