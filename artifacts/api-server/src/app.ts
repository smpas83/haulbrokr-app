import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import healthRouter from "./routes/health";
import automationRouter from "./routes/automation";
import stripeWebhooksRouter from "./routes/stripe-webhooks";
import { errorHandler } from "./middlewares/errorHandler";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);

const DEFAULT_PRODUCTION_ORIGINS = [
  "https://haulbrokr.com",
  "https://www.haulbrokr.com",
  "https://haulbrokr.vercel.app",
];

function configuredCorsOrigins(): Set<string> {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_PRODUCTION_ORIGINS, ...fromEnv]);
}

function isLocalDevelopmentOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (configuredCorsOrigins().has(origin)) {
      callback(null, true);
      return;
    }
    if (process.env.NODE_ENV !== "production" && isLocalDevelopmentOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
};

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));
app.use(cookieParser());

// Stripe webhooks require the raw body for signature verification — mount before express.json().
app.use(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhooksRouter,
);

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// Health check must work without Clerk auth so deployment probes succeed
// even when Clerk keys are absent/invalid. Mount it before clerkMiddleware.
app.use("/api", healthRouter);
app.use("/api", automationRouter);

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

app.use(errorHandler);

export default app;
