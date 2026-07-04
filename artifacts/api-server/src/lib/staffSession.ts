import crypto from "node:crypto";
import type { StaffRole } from "../middlewares/requireAdmin";

const STAFF_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
export const STAFF_SESSION_COOKIE = "haulbrokr_staff";

export interface StaffSessionPayload {
  uid: number;
  role: StaffRole;
  exp: number;
}

function getSecret(): string {
  const s = process.env.STAFF_AUTH_SECRET ?? process.env.TICKET_QR_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "STAFF_AUTH_SECRET (or TICKET_QR_SECRET) must be set in production",
    );
  }
  return "haulbrokr-staff-dev-secret-32chars-min";
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signStaffSession(uid: number, role: StaffRole): string {
  const payload: StaffSessionPayload = {
    uid,
    role,
    exp: Date.now() + STAFF_SESSION_TTL_MS,
  };
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", getSecret()).update(json).digest();
  return `${b64url(json)}.${b64url(sig)}`;
}

export function verifyStaffSession(token: string): StaffSessionPayload | null {
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  let json: string;
  try {
    json = b64urlDecode(parts[0]).toString("utf8");
  } catch {
    return null;
  }
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(json)
    .digest();
  const actualSig = b64urlDecode(parts[1]);
  if (
    expectedSig.length !== actualSig.length ||
    !crypto.timingSafeEqual(expectedSig, actualSig)
  ) {
    return null;
  }
  let payload: StaffSessionPayload;
  try {
    payload = JSON.parse(json) as StaffSessionPayload;
  } catch {
    return null;
  }
  if (
    typeof payload.uid !== "number" ||
    typeof payload.role !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (Date.now() > payload.exp) return null;
  return payload;
}
