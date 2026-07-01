export type IntegrationStatus = "configured" | "missing" | "disabled";

export type IntegrationStatusItem = {
  key: "stripe" | "googleMaps" | "clerk" | "email" | "sms" | "push" | "cloudStorage";
  label: string;
  status: IntegrationStatus;
  required: boolean;
  details: string;
};

function hasEvery(env: NodeJS.ProcessEnv, names: string[]): boolean {
  return names.every((name) => (env[name] ?? "").trim().length > 0);
}

function isTruthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function item(
  key: IntegrationStatusItem["key"],
  label: string,
  status: IntegrationStatus,
  required: boolean,
  details: string,
): IntegrationStatusItem {
  return { key, label, status, required, details };
}

export function collectIntegrationStatus(
  env: NodeJS.ProcessEnv = process.env,
): { generatedAt: string; integrations: IntegrationStatusItem[] } {
  const stripeReady =
    hasEvery(env, ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"]) &&
    !isTruthy(env.PAYMENTS_MOCK_MODE);
  const mapsReady = !!(env.GOOGLE_MAPS_API_KEY || env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);
  const clerkReady = hasEvery(env, ["CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"]);
  const emailReady = hasEvery(env, ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]);
  const storageReady = hasEvery(env, [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_URL",
    "PRIVATE_OBJECT_DIR",
    "PUBLIC_OBJECT_SEARCH_PATHS",
  ]);

  return {
    generatedAt: new Date().toISOString(),
    integrations: [
      item(
        "stripe",
        "Stripe",
        stripeReady ? "configured" : "missing",
        true,
        stripeReady ? "Payments and Connect env vars are present." : "Stripe keys/webhook are incomplete or mock mode is enabled.",
      ),
      item(
        "googleMaps",
        "Google Maps",
        mapsReady ? "configured" : "missing",
        true,
        mapsReady ? "Maps SDK key is present." : "GOOGLE_MAPS_API_KEY is missing.",
      ),
      item(
        "clerk",
        "Clerk",
        clerkReady ? "configured" : "missing",
        true,
        clerkReady ? "Backend Clerk keys are present." : "Backend Clerk keys are incomplete.",
      ),
      item(
        "email",
        "Email",
        emailReady ? "configured" : "missing",
        true,
        emailReady ? "Resend key and sender are present." : "Resend key or sender is missing.",
      ),
      item(
        "sms",
        "SMS",
        "disabled",
        false,
        "No SMS provider is wired yet; local sms: links still work on devices.",
      ),
      item(
        "push",
        "Push notifications",
        "disabled",
        false,
        "No push provider or expo-notifications pipeline is wired yet.",
      ),
      item(
        "cloudStorage",
        "Cloud storage",
        storageReady ? "configured" : "missing",
        true,
        storageReady ? "R2 upload/public object env vars are present." : "R2 configuration is incomplete.",
      ),
    ],
  };
}
