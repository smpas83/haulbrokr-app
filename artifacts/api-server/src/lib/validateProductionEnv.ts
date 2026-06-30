export type ProductionService =
  | "neon"
  | "clerk"
  | "stripe"
  | "resend"
  | "r2"
  | "render"
  | "vercel"
  | "core";

export interface EnvRequirement {
  service: ProductionService;
  variable: string;
  required: boolean;
  description: string;
}

export interface EnvValidationIssue {
  service: ProductionService;
  variable: string;
  message: string;
}

/** Audit catalog of production environment variables by integration. */
export const PRODUCTION_ENV_REQUIREMENTS: EnvRequirement[] = [
  // Neon (Postgres)
  { service: "neon", variable: "DATABASE_URL", required: true, description: "Neon Postgres connection string (pooled URL with sslmode=require)." },

  // Clerk
  { service: "clerk", variable: "CLERK_SECRET_KEY", required: true, description: "Clerk secret key for backend auth (sk_…)." },
  { service: "clerk", variable: "CLERK_PUBLISHABLE_KEY", required: true, description: "Clerk publishable key for JWT verification (pk_…)." },

  // Stripe
  { service: "stripe", variable: "STRIPE_SECRET_KEY", required: true, description: "Stripe secret API key (sk_live_… or sk_test_…)." },
  { service: "stripe", variable: "STRIPE_PUBLISHABLE_KEY", required: true, description: "Stripe publishable key (pk_live_… or pk_test_…)." },
  { service: "stripe", variable: "STRIPE_WEBHOOK_SECRET", required: true, description: "Stripe webhook signing secret (whsec_…)." },
  { service: "stripe", variable: "PAYMENTS_MOCK_MODE", required: true, description: "Must be unset or false in production — mock payments are not allowed." },

  // Resend
  { service: "resend", variable: "RESEND_API_KEY", required: true, description: "Resend API key (re_…)." },
  { service: "resend", variable: "RESEND_FROM_EMAIL", required: true, description: "Verified sender address for transactional email." },

  // Cloudflare R2
  { service: "r2", variable: "R2_ACCOUNT_ID", required: true, description: "Cloudflare account ID for R2 S3 endpoint." },
  { service: "r2", variable: "R2_ACCESS_KEY_ID", required: true, description: "R2 access key ID." },
  { service: "r2", variable: "R2_SECRET_ACCESS_KEY", required: true, description: "R2 secret access key." },
  { service: "r2", variable: "R2_BUCKET", required: true, description: "R2 bucket name." },
  { service: "r2", variable: "R2_PUBLIC_URL", required: true, description: "Public R2/custom CDN base URL (https://…)." },
  { service: "r2", variable: "PRIVATE_OBJECT_DIR", required: true, description: "Private object key prefix within R2_BUCKET." },
  { service: "r2", variable: "PUBLIC_OBJECT_SEARCH_PATHS", required: true, description: "Comma-separated public object key prefixes within R2_BUCKET." },

  // Render (API host)
  { service: "render", variable: "PORT", required: true, description: "HTTP listen port (8080 on Render)." },
  { service: "render", variable: "NODE_ENV", required: true, description: "Must be production on Render." },
  { service: "render", variable: "CORS_ALLOWED_ORIGINS", required: false, description: "Optional comma-separated browser origins beyond haulbrokr.com/www/haulbrokr.vercel.app." },

  // Vercel (web app — validated at build/runtime on Vercel, documented for ops)
  { service: "vercel", variable: "VITE_CLERK_PUBLISHABLE_KEY", required: true, description: "Clerk publishable key baked into the Vercel web build." },
  { service: "vercel", variable: "VITE_CLERK_PROXY_URL", required: true, description: "Clerk proxy URL on the Vercel domain (https://your-domain/api/__clerk)." },

  // Core API secrets
  { service: "core", variable: "UPLOAD_TOKEN_SECRET", required: true, description: "HMAC secret for upload tokens (≥32 chars)." },
  { service: "core", variable: "TICKET_QR_SECRET", required: true, description: "HMAC secret for ticket QR codes (≥32 chars)." },
  { service: "core", variable: "STAFF_AUTH_SECRET", required: true, description: "Staff session HMAC secret (≥32 chars; TICKET_QR_SECRET may substitute)." },
  { service: "core", variable: "ADMIN_USER_IDS", required: true, description: "Comma-separated Clerk user IDs with admin access." },
  { service: "core", variable: "AUTOMATION_KEY", required: false, description: "Optional shared key for internal automation endpoints." },
];

const PLACEHOLDER_PATTERNS = [
  "ep-xxxxx",
  "@ep-xxx.",
  "user:pass@",
  "your_real_password",
  "your_password",
  "paste_key_here",
  "changeme",
  "replace_me",
];

const MIN_SECRET_LENGTH = 32;

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function envValue(env: NodeJS.ProcessEnv, name: string): string {
  return (env[name] ?? "").trim();
}

function isTruthyMockFlag(value: string): boolean {
  const v = value.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function looksLikeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function containsPlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()));
}

function pushMissing(issues: EnvValidationIssue[], service: ProductionService, variable: string): void {
  issues.push({
    service,
    variable,
    message: `${variable} is required in production but is missing or empty.`,
  });
}

function pushInvalid(
  issues: EnvValidationIssue[],
  service: ProductionService,
  variable: string,
  message: string,
): void {
  issues.push({ service, variable, message });
}

function validateDatabaseUrl(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
  let url = envValue(env, "DATABASE_URL");
  if (!url) {
    pushMissing(issues, "neon", "DATABASE_URL");
    return;
  }

  url = url.replace(/^DATABASE_URL\s*=\s*/i, "").replace(/^['"]|['"]$/g, "");
  if (containsPlaceholder(url)) {
    pushInvalid(issues, "neon", "DATABASE_URL", "DATABASE_URL contains placeholder text — paste your real Neon connection string.");
    return;
  }
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    pushInvalid(issues, "neon", "DATABASE_URL", "DATABASE_URL must start with postgres:// or postgresql://.");
    return;
  }

  try {
    const normalized = url.replace(/^postgres:/, "postgresql:");
    const parsed = new URL(normalized);
    if (!parsed.hostname.includes(".")) {
      pushInvalid(issues, "neon", "DATABASE_URL", `DATABASE_URL hostname looks invalid: ${parsed.hostname}`);
    }
    if (containsPlaceholder(parsed.hostname)) {
      pushInvalid(issues, "neon", "DATABASE_URL", "DATABASE_URL hostname looks like a documentation example, not a real Neon host.");
    }
    const ssl = parsed.searchParams.get("sslmode") ?? parsed.searchParams.get("ssl");
    if (ssl !== "require" && ssl !== "true") {
      pushInvalid(
        issues,
        "neon",
        "DATABASE_URL",
        "DATABASE_URL must include sslmode=require for Neon production (append ?sslmode=require to the pooled URL).",
      );
    }
  } catch {
    pushInvalid(issues, "neon", "DATABASE_URL", "DATABASE_URL is not a valid Postgres URL.");
  }
}

function validateClerk(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
  const secret = envValue(env, "CLERK_SECRET_KEY");
  const publishable = envValue(env, "CLERK_PUBLISHABLE_KEY");

  if (!secret) pushMissing(issues, "clerk", "CLERK_SECRET_KEY");
  else if (!secret.startsWith("sk_")) {
    pushInvalid(issues, "clerk", "CLERK_SECRET_KEY", "CLERK_SECRET_KEY must start with sk_.");
  }

  if (!publishable) pushMissing(issues, "clerk", "CLERK_PUBLISHABLE_KEY");
  else if (!publishable.startsWith("pk_")) {
    pushInvalid(issues, "clerk", "CLERK_PUBLISHABLE_KEY", "CLERK_PUBLISHABLE_KEY must start with pk_.");
  }
}

function validateStripe(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
  if (isTruthyMockFlag(envValue(env, "PAYMENTS_MOCK_MODE"))) {
    pushInvalid(
      issues,
      "stripe",
      "PAYMENTS_MOCK_MODE",
      "PAYMENTS_MOCK_MODE must be unset or false in production — real Stripe keys are required.",
    );
  }

  const secret = envValue(env, "STRIPE_SECRET_KEY");
  const publishable = envValue(env, "STRIPE_PUBLISHABLE_KEY");
  const webhook = envValue(env, "STRIPE_WEBHOOK_SECRET");

  if (!secret) pushMissing(issues, "stripe", "STRIPE_SECRET_KEY");
  else if (!secret.startsWith("sk_")) {
    pushInvalid(issues, "stripe", "STRIPE_SECRET_KEY", "STRIPE_SECRET_KEY must start with sk_.");
  }

  if (!publishable) pushMissing(issues, "stripe", "STRIPE_PUBLISHABLE_KEY");
  else if (!publishable.startsWith("pk_")) {
    pushInvalid(issues, "stripe", "STRIPE_PUBLISHABLE_KEY", "STRIPE_PUBLISHABLE_KEY must start with pk_.");
  }

  if (!webhook) pushMissing(issues, "stripe", "STRIPE_WEBHOOK_SECRET");
  else if (!webhook.startsWith("whsec_")) {
    pushInvalid(issues, "stripe", "STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET must start with whsec_.");
  }
}

function validateResend(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
  const apiKey = envValue(env, "RESEND_API_KEY");
  const fromEmail = envValue(env, "RESEND_FROM_EMAIL");

  if (!apiKey) pushMissing(issues, "resend", "RESEND_API_KEY");
  else if (!apiKey.startsWith("re_")) {
    pushInvalid(issues, "resend", "RESEND_API_KEY", "RESEND_API_KEY must start with re_.");
  }

  if (!fromEmail) pushMissing(issues, "resend", "RESEND_FROM_EMAIL");
  else if (!looksLikeEmail(fromEmail)) {
    pushInvalid(issues, "resend", "RESEND_FROM_EMAIL", "RESEND_FROM_EMAIL must be a valid email address.");
  }
}

function validateR2(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
  for (const variable of [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "PRIVATE_OBJECT_DIR",
    "PUBLIC_OBJECT_SEARCH_PATHS",
  ] as const) {
    if (!envValue(env, variable)) pushMissing(issues, "r2", variable);
  }

  const publicUrl = envValue(env, "R2_PUBLIC_URL");
  if (!publicUrl) {
    pushMissing(issues, "r2", "R2_PUBLIC_URL");
  } else if (!looksLikeHttpsUrl(publicUrl)) {
    pushInvalid(issues, "r2", "R2_PUBLIC_URL", "R2_PUBLIC_URL must be a valid https:// URL.");
  }
}

function validateRender(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
  const port = envValue(env, "PORT");
  if (!port) {
    pushMissing(issues, "render", "PORT");
  } else {
    const parsed = Number(port);
    if (Number.isNaN(parsed) || parsed <= 0) {
      pushInvalid(issues, "render", "PORT", `PORT must be a positive integer (got "${port}").`);
    }
  }

  if (env.NODE_ENV !== "production") {
    pushInvalid(issues, "render", "NODE_ENV", 'NODE_ENV must be "production" on Render.');
  }
}

function validateCoreSecrets(env: NodeJS.ProcessEnv, issues: EnvValidationIssue[]): void {
  const uploadSecret = envValue(env, "UPLOAD_TOKEN_SECRET");
  if (!uploadSecret) {
    pushMissing(issues, "core", "UPLOAD_TOKEN_SECRET");
  } else if (uploadSecret.length < MIN_SECRET_LENGTH) {
    pushInvalid(issues, "core", "UPLOAD_TOKEN_SECRET", `UPLOAD_TOKEN_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  }

  const ticketSecret = envValue(env, "TICKET_QR_SECRET");
  if (!ticketSecret) {
    pushMissing(issues, "core", "TICKET_QR_SECRET");
  } else if (ticketSecret.length < MIN_SECRET_LENGTH) {
    pushInvalid(issues, "core", "TICKET_QR_SECRET", `TICKET_QR_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  }

  const staffSecret = envValue(env, "STAFF_AUTH_SECRET");
  const effectiveStaffSecret = staffSecret || ticketSecret;
  if (!effectiveStaffSecret) {
    pushMissing(issues, "core", "STAFF_AUTH_SECRET");
  } else if (effectiveStaffSecret.length < MIN_SECRET_LENGTH) {
    pushInvalid(
      issues,
      "core",
      "STAFF_AUTH_SECRET",
      `STAFF_AUTH_SECRET (or TICKET_QR_SECRET fallback) must be at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }

  const adminIds = envValue(env, "ADMIN_USER_IDS");
  if (!adminIds) {
    pushMissing(issues, "core", "ADMIN_USER_IDS");
  } else if (adminIds.split(",").every((id) => !id.trim())) {
    pushInvalid(issues, "core", "ADMIN_USER_IDS", "ADMIN_USER_IDS must contain at least one Clerk user ID.");
  }
}

/** Collect all production configuration issues. Empty when not in production. */
export function collectProductionEnvIssues(env: NodeJS.ProcessEnv = process.env): EnvValidationIssue[] {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const issues: EnvValidationIssue[] = [];
  validateDatabaseUrl(env, issues);
  validateClerk(env, issues);
  validateStripe(env, issues);
  validateResend(env, issues);
  validateR2(env, issues);
  validateRender(env, issues);
  validateCoreSecrets(env, issues);
  return issues;
}

function formatIssues(issues: EnvValidationIssue[]): string {
  const byService = new Map<ProductionService, EnvValidationIssue[]>();
  for (const issue of issues) {
    const group = byService.get(issue.service) ?? [];
    group.push(issue);
    byService.set(issue.service, group);
  }

  const serviceOrder: ProductionService[] = [
    "neon",
    "clerk",
    "stripe",
    "resend",
    "r2",
    "render",
    "core",
  ];

  const lines: string[] = [
    "Production environment validation failed. Fix the following before starting the API server:",
    "",
    "Vercel web app (haulbrokr.com) also requires VITE_CLERK_PUBLISHABLE_KEY and VITE_CLERK_PROXY_URL — set those in the Vercel project dashboard.",
    "",
  ];

  for (const service of serviceOrder) {
    const group = byService.get(service);
    if (!group?.length) continue;
    lines.push(`[${service.toUpperCase()}]`);
    for (const issue of group) {
      lines.push(`  - ${issue.variable}: ${issue.message}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/** Fail fast when critical production env vars are missing or invalid. No-op outside production. */
export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  const issues = collectProductionEnvIssues(env);
  if (issues.length > 0) {
    throw new Error(formatIssues(issues));
  }
}
