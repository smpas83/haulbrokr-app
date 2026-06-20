import type { ErrorRequestHandler } from "express";

/**
 * Central error handler — catches errors passed via `next(err)` from async
 * middleware and route handlers. Keeps client responses generic while logging
 * full details server-side.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  req.log?.error?.({ err }, "Unhandled request error");
  const status = typeof err?.status === "number" ? err.status : 500;
  const message =
    status < 500 && err?.message
      ? err.message
      : "Internal server error";
  res.status(status).json({ error: message });
};
