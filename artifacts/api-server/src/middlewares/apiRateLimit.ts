import type { Request, RequestHandler } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 300;

const buckets = new Map<string, Bucket>();

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedFor = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();
  return firstForwardedIp || req.ip || req.socket.remoteAddress || "unknown";
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function apiRateLimit(): RequestHandler {
  const windowMs = envNumber("API_RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
  const maxRequests = envNumber("API_RATE_LIMIT_MAX", DEFAULT_MAX_REQUESTS);

  return (req, res, next) => {
    const now = Date.now();
    pruneExpired(now);

    const key = clientKey(req);
    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(maxRequests - bucket.count, 0);
    const resetSeconds = Math.ceil(bucket.resetAt / 1000);

    res.setHeader("RateLimit-Limit", String(maxRequests));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (bucket.count > maxRequests) {
      const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: "Too many requests. Try again later." });
      return;
    }

    next();
  };
}

export function __resetApiRateLimitForTests(): void {
  if (process.env.NODE_ENV === "test") {
    buckets.clear();
  }
}
