import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, staffUsersTable } from "@workspace/db";
import { verifyStaffPassword } from "../lib/staffPassword";
import { signStaffSession, STAFF_SESSION_COOKIE } from "../lib/staffSession";
import { ROLE_PERMISSIONS, type StaffRole } from "../middlewares/requireAdmin";

const router: IRouter = Router();
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type LoginAttempt = {
  count: number;
  firstAttemptAt: number;
};

const failedLoginAttempts = new Map<string, LoginAttempt>();

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

function loginAttemptKey(ip: string | undefined, username: string): string {
  return `${ip ?? "unknown"}:${username}`;
}

function currentAttempt(key: string, now = Date.now()): LoginAttempt {
  const existing = failedLoginAttempts.get(key);
  if (!existing || now - existing.firstAttemptAt > LOGIN_WINDOW_MS) {
    const fresh = { count: 0, firstAttemptAt: now };
    failedLoginAttempts.set(key, fresh);
    return fresh;
  }
  return existing;
}

function isLoginRateLimited(key: string): boolean {
  return currentAttempt(key).count >= MAX_FAILED_LOGIN_ATTEMPTS;
}

function recordFailedLogin(key: string): void {
  const attempt = currentAttempt(key);
  attempt.count += 1;
}

function clearFailedLogins(key: string): void {
  failedLoginAttempts.delete(key);
}

export function __resetStaffLoginRateLimitForTests(): void {
  if (process.env.NODE_ENV === "test") {
    failedLoginAttempts.clear();
  }
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const username = parsed.data.username.toLowerCase();
  const attemptKey = loginAttemptKey(req.ip, username);
  if (isLoginRateLimited(attemptKey)) {
    res.status(429).json({ error: "Too many failed login attempts. Try again later." });
    return;
  }
  const [user] = await db
    .select()
    .from(staffUsersTable)
    .where(eq(staffUsersTable.username, username));
  if (!user?.active) {
    recordFailedLogin(attemptKey);
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }
  const ok = await verifyStaffPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    recordFailedLogin(attemptKey);
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }
  clearFailedLogins(attemptKey);
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
