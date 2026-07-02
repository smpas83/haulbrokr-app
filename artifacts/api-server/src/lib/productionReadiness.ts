import { PRODUCTION_ENV_REQUIREMENTS } from "./validateProductionEnv";

type ReadinessStatus = "pass" | "warn" | "fail";
type ReadinessArea =
  | "auth"
  | "database"
  | "payments"
  | "storage"
  | "notifications"
  | "maps"
  | "mobile"
  | "operations"
  | "observability"
  | "document-ai"
  | "integrations";

export interface ReadinessCheck {
  area: ReadinessArea;
  name: string;
  status: ReadinessStatus;
  launchCritical: boolean;
  message: string;
}

export interface ProductionReadinessReport {
  generatedAt: string;
  targetEnv: string;
  goNoGo: "go" | "no-go";
  summary: {
    pass: number;
    warn: number;
    fail: number;
    launchCriticalFailures: number;
  };
  checks: ReadinessCheck[];
}

const EXTRA_REQUIRED_ENV = [
  { area: "auth" as const, variable: "VITE_CLERK_PUBLISHABLE_KEY", message: "Vercel web build must include the Clerk publishable key." },
  { area: "auth" as const, variable: "VITE_CLERK_PROXY_URL", message: "Vercel web build must proxy Clerk through the production domain." },
  { area: "auth" as const, variable: "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY", message: "Expo builds must include the Clerk publishable key." },
  { area: "mobile" as const, variable: "EXPO_PUBLIC_DOMAIN", message: "Expo builds must point at the production API/web domain." },
  { area: "maps" as const, variable: "GOOGLE_MAPS_API_KEY", message: "Google Maps key is required before enabling live map builds." },
];

function value(env: NodeJS.ProcessEnv, name: string): string {
  return (env[name] ?? "").trim();
}

function isTruthy(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function serviceArea(service: string): ReadinessArea {
  switch (service) {
    case "neon":
      return "database";
    case "clerk":
    case "vercel":
      return "auth";
    case "stripe":
      return "payments";
    case "resend":
      return "notifications";
    case "r2":
      return "storage";
    case "render":
    case "core":
    default:
      return "operations";
  }
}

export function collectProductionReadiness(env: NodeJS.ProcessEnv = process.env): ProductionReadinessReport {
  const checks: ReadinessCheck[] = [];
  const targetEnv = value(env, "TARGET_ENV") || value(env, "NODE_ENV") || "development";

  for (const req of PRODUCTION_ENV_REQUIREMENTS.filter((item) => item.required && item.variable !== "PAYMENTS_MOCK_MODE")) {
    const configured = Boolean(value(env, req.variable));
    checks.push({
      area: serviceArea(req.service),
      name: req.variable,
      status: configured ? "pass" : "fail",
      launchCritical: true,
      message: configured ? `${req.variable} is configured.` : req.description,
    });
  }

  for (const req of EXTRA_REQUIRED_ENV) {
    const configured = Boolean(value(env, req.variable));
    checks.push({
      area: req.area,
      name: req.variable,
      status: configured ? "pass" : "fail",
      launchCritical: true,
      message: configured ? `${req.variable} is configured.` : req.message,
    });
  }

  const mockPaymentsEnabled = isTruthy(value(env, "PAYMENTS_MOCK_MODE"));
  checks.push({
    area: "payments",
    name: "PAYMENTS_MOCK_MODE",
    status: mockPaymentsEnabled ? (targetEnv === "production" ? "fail" : "warn") : "pass",
    launchCritical: targetEnv === "production",
    message: mockPaymentsEnabled
      ? "Mock payments are enabled; disable this before production or any money-moving beta."
      : "Mock payments are disabled.",
  });

  checks.push(
    {
      area: "document-ai",
      name: "DOCUMENT_AI_PROVIDER",
      status: value(env, "DOCUMENT_AI_PROVIDER") ? "pass" : "warn",
      launchCritical: false,
      message: value(env, "DOCUMENT_AI_PROVIDER")
        ? "Document AI provider is configured."
        : "OCR/AI verification is not configured; document review remains manual.",
    },
    {
      area: "observability",
      name: "ERROR_TRACKING_DSN",
      status: value(env, "ERROR_TRACKING_DSN") ? "pass" : "warn",
      launchCritical: false,
      message: value(env, "ERROR_TRACKING_DSN")
        ? "Error tracking DSN is configured."
        : "External error tracking is not configured; rely on structured logs until a vendor is connected.",
    },
    {
      area: "integrations",
      name: "QUICKBOOKS_CLIENT_ID",
      status: value(env, "QUICKBOOKS_CLIENT_ID") ? "pass" : "warn",
      launchCritical: false,
      message: value(env, "QUICKBOOKS_CLIENT_ID")
        ? "QuickBooks OAuth is configured."
        : "QuickBooks remains disabled for production accounting sync until OAuth credentials and redirect handling are connected.",
    },
  );

  const summary = {
    pass: checks.filter((check) => check.status === "pass").length,
    warn: checks.filter((check) => check.status === "warn").length,
    fail: checks.filter((check) => check.status === "fail").length,
    launchCriticalFailures: checks.filter((check) => check.launchCritical && check.status === "fail").length,
  };

  return {
    generatedAt: new Date().toISOString(),
    targetEnv,
    goNoGo: summary.launchCriticalFailures === 0 ? "go" : "no-go",
    summary,
    checks,
  };
}
