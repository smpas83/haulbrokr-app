export type RuntimeIntegrationStatus = {
  id: string;
  label: string;
  configured: boolean;
  requiredFor: string;
  missingEnvVars: string[];
  unavailableMessage: string;
};

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? "";

export const runtimeConfig = {
  clerkPublishableKey,
  isClerkConfigured: clerkPublishableKey.length > 0,
};

export const runtimeIntegrationStatuses: RuntimeIntegrationStatus[] = [
  {
    id: "clerk",
    label: "Clerk authentication",
    configured: runtimeConfig.isClerkConfigured,
    requiredFor: "Sign-in, sign-up, and authenticated app routes",
    missingEnvVars: ["VITE_CLERK_PUBLISHABLE_KEY"],
    unavailableMessage:
      "Authentication is unavailable because VITE_CLERK_PUBLISHABLE_KEY is not configured.",
  },
];

let warnedAboutMissingOptionalIntegrations = false;

export function warnAboutRuntimeConfig(): void {
  if (!import.meta.env.DEV || warnedAboutMissingOptionalIntegrations) {
    return;
  }

  const missingIntegrations = runtimeIntegrationStatuses.filter(
    (status) => !status.configured,
  );

  if (missingIntegrations.length === 0) {
    return;
  }

  warnedAboutMissingOptionalIntegrations = true;

  for (const status of missingIntegrations) {
    console.warn(
      `[runtime-config] ${status.label} unavailable: ${status.missingEnvVars.join(
        ", ",
      )} missing. Public pages will continue to render.`,
    );
  }
}
