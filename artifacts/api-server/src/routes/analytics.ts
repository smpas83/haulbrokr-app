import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db, pageViewsTable } from "@workspace/db";

const router: IRouter = Router();

const PageViewBody = z.object({
  path: z.string().min(1).max(500),
  referrer: z.string().max(1000).optional().nullable(),
  sessionId: z.string().min(8).max(128),
});

/** Normalize a client path: leading slash, no query/hash, capped length. */
export function normalizePagePath(raw: string): string | null {
  let path = raw.trim();
  if (!path) return null;
  // Reject absolute URLs and protocol-relative URLs.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path) || path.startsWith("//")) return null;
  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);
  const h = path.indexOf("#");
  if (h >= 0) path = path.slice(0, h);
  if (!path.startsWith("/")) path = `/${path}`;
  // Collapse duplicate slashes and strip trailing slash (except root).
  path = path.replace(/\/+/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  // Skip noisy / non-marketing routes.
  if (
    path.startsWith("/api") ||
    path.startsWith("/admin") ||
    path.startsWith("/assets") ||
    path.includes("..")
  ) {
    return null;
  }
  if (path.length > 500) path = path.slice(0, 500);
  return path;
}

/**
 * Public beacon — records a page view for the admin traffic dashboard.
 * No auth. Best-effort; never blocks the client UX.
 */
router.post("/analytics/pageview", async (req, res): Promise<void> => {
  const parsed = PageViewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid page view payload" });
    return;
  }

  const path = normalizePagePath(parsed.data.path);
  if (!path) {
    res.status(204).end();
    return;
  }

  let referrer: string | null = parsed.data.referrer?.trim() || null;
  if (referrer && referrer.length > 1000) referrer = referrer.slice(0, 1000);

  try {
    await db.insert(pageViewsTable).values({
      path,
      referrer,
      sessionId: parsed.data.sessionId,
    });
  } catch {
    // Swallow insert failures — analytics must not break the site.
    res.status(204).end();
    return;
  }

  res.status(204).end();
});

export default router;
