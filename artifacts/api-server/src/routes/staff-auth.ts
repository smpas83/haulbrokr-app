import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, staffUsersTable } from "@workspace/db";
import { verifyStaffPassword } from "../lib/staffPassword";
import { signStaffSession, STAFF_SESSION_COOKIE } from "../lib/staffSession";
import { ROLE_PERMISSIONS, type StaffRole } from "../middlewares/requireAdmin";

const router: IRouter = Router();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const loginFailures = new Map<string, { count: number; windowStart: number }>();

const LoginBody = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 60 * 60 * 1000,
  };
}

function loginLimitKey(req: { ip?: string }, username: string): string {
  return `${req.ip ?? "unknown"}:${username}`;
}

function isLoginLimited(key: string): boolean {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry) return false;
  if (now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginFailures.delete(key);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const username = parsed.data.username.toLowerCase();
  const limitKey = loginLimitKey(req, username);
  if (isLoginLimited(limitKey)) {
    res.status(429).json({ error: "Too many failed login attempts. Try again later." });
    return;
  }
  const [user] = await db
    .select()
    .from(staffUsersTable)
    .where(eq(staffUsersTable.username, username));
  if (!user?.active) {
    recordLoginFailure(limitKey);
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }
  const ok = await verifyStaffPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    recordLoginFailure(limitKey);
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }
  loginFailures.delete(limitKey);
  const staffRole = user.staffRole as StaffRole;
  const token = signStaffSession(user.id, staffRole);
  res.cookie(STAFF_SESSION_COOKIE, token, sessionCookieOptions());
  res.json({
    ok: true,
    displayName: user.displayName,
    staffRole,
    permissions: ROLE_PERMISSIONS[staffRole],
  });
});

router.post("/admin/logout", (_req, res): void => {
  res.clearCookie(STAFF_SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.json({ ok: true });
});

export default router;
