import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, staffUsersTable } from "@workspace/db";
import { hasPermission, type StaffRole } from "./requireAdmin";
import { STAFF_SESSION_COOKIE, verifyStaffSession } from "../lib/staffSession";
import { requireProfile } from "./requireAuth";

export interface StaffSessionUser {
  id: number;
  username: string;
  staffRole: StaffRole;
  displayName: string;
}

/** Parse staff session cookie (if present) and attach `req.staffUser`. */
export async function attachStaffSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[STAFF_SESSION_COOKIE] as string | undefined;
  if (!token) {
    next();
    return;
  }
  const payload = verifyStaffSession(token);
  if (!payload) {
    next();
    return;
  }
  const [row] = await db
    .select({
      id: staffUsersTable.id,
      username: staffUsersTable.username,
      staffRole: staffUsersTable.staffRole,
      displayName: staffUsersTable.displayName,
      active: staffUsersTable.active,
    })
    .from(staffUsersTable)
    .where(eq(staffUsersTable.id, payload.uid));
  if (!row?.active || row.staffRole !== payload.role) {
    next();
    return;
  }
  req.staffUser = {
    id: row.id,
    username: row.username,
    staffRole: row.staffRole as StaffRole,
    displayName: row.displayName,
  };
  next();
}

/** Staff password session OR Clerk profile (for admin routes). */
export async function requireStaffOrProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.staffUser || req.profile) {
    next();
    return;
  }
  return requireProfile(req, res, next);
}

/**
 * Private document viewer: Clerk profile owner OR staff session with compliance.
 * Staff-password admins previously hit requireProfile → 401 Unauthorized on View.
 */
export async function requireProfileOrStaffCompliance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.staffUser) {
    try {
      if (await hasPermission(req, "compliance")) {
        next();
        return;
      }
      res.status(403).json({ error: "Forbidden" });
      return;
    } catch (err) {
      next(err);
      return;
    }
  }
  if (req.profile) {
    next();
    return;
  }
  return requireProfile(req, res, next);
}
