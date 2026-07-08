import type { Request, Response, NextFunction } from "express";

/**
 * Guards automation-only endpoints with a static service key.
 * The key is supplied via the `x-automation-key` header and must match
 * the AUTOMATION_KEY environment variable. Read-only endpoints only.
 */
export function requireAutomationKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.AUTOMATION_KEY;
  if (!expected) {
    res.status(503).json({ error: "Automation key not configured" });
    return;
  }
  const provided = req.header("x-automation-key");
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "Invalid automation key" });
    return;
  }
  next();
}
