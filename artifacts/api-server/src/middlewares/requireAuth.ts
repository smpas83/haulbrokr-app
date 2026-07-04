import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import type { Profile } from "@workspace/db";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkId = clerkId;
  next();
}

export async function requireProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  req.clerkId = clerkId;
  req.profile = profile;
  next();
}

/** Load profile when Clerk session exists; never rejects unauthenticated requests. */
export async function attachClerkProfileIfPresent(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.profile) {
    next();
    return;
  }
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    next();
    return;
  }
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  if (profile) {
    req.clerkId = clerkId;
    req.profile = profile;
  }
  next();
}

/** Profile for handlers that run after `requireProfile`. */
export function getRequestProfile(req: Request): Profile {
  const profile = req.profile;
  if (!profile) {
    throw new Error("requireProfile middleware must run before this handler");
  }
  return profile;
}
