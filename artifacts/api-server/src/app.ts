import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import cors from "cors";
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

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://haulbrokr.com",
  "https://www.haulbrokr.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
]);

function configuredAllowedOrigins(): Set<string> {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return configuredAllowedOrigins().has(origin);
}

const corsOptions: cors.CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (isAllowedCorsOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("CORS origin not allowed"), false);
  },
};

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
