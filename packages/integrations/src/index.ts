import type { WorkspaceKey } from "@kip/agents";

export type IntegrationProvider =
  | "supabase"
  | "clerk"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "github"
  | "n8n"
  | "stripe"
  | "google"
  | "vercel"
  | "railway";

export type IntegrationCapability =
  | "identity"
  | "database"
  | "memory"
  | "llm"
  | "source-control"
  | "workflow-automation"
  | "payments"
  | "calendar"
  | "email"
  | "deployment"
  | "hosting";

export type IntegrationDefinition = {
  readonly provider: IntegrationProvider;
  readonly displayName: string;
  readonly capabilities: readonly IntegrationCapability[];
  readonly requiredEnvironment: readonly string[];
  readonly workspaceScopes: readonly WorkspaceKey[] | "all";
  readonly productionUse: string;
};

export type IntegrationRuntimeState = IntegrationDefinition & {
  readonly status: "configured" | "missing-configuration";
  readonly missingEnvironment: readonly string[];
};

export const integrationRegistry = [
  {
    provider: "supabase",
    displayName: "Supabase",
    capabilities: ["database", "memory"],
    requiredEnvironment: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    workspaceScopes: "all",
    productionUse: "PostgreSQL storage, vector memory search, and workspace-scoped operational data."
  },
  {
    provider: "clerk",
    displayName: "Clerk",
    capabilities: ["identity"],
    requiredEnvironment: ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
    workspaceScopes: "all",
    productionUse: "Enterprise identity, sessions, organization membership, and permission boundaries."
  },
  {
    provider: "openai",
    displayName: "OpenAI",
    capabilities: ["llm", "memory"],
    requiredEnvironment: ["OPENAI_API_KEY"],
    workspaceScopes: "all",
    productionUse: "Fast agent execution, embeddings, voice transcription, and streaming responses."
  },
  {
    provider: "anthropic",
    displayName: "Anthropic",
    capabilities: ["llm"],
    requiredEnvironment: ["ANTHROPIC_API_KEY"],
    workspaceScopes: "all",
    productionUse: "Executive reasoning, architecture review, legal analysis, and higher-context agent work."
  },
  {
    provider: "openrouter",
    displayName: "OpenRouter",
    capabilities: ["llm"],
    requiredEnvironment: ["OPENROUTER_API_KEY"],
    workspaceScopes: "all",
    productionUse: "Model routing for specialist agents and cost-aware inference fallbacks."
  },
  {
    provider: "github",
    displayName: "GitHub",
    capabilities: ["source-control"],
    requiredEnvironment: ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_WEBHOOK_SECRET"],
    workspaceScopes: "all",
    productionUse: "Repository intelligence, issue triage, pull request review, and release signals."
  },
  {
    provider: "n8n",
    displayName: "n8n",
    capabilities: ["workflow-automation"],
    requiredEnvironment: ["N8N_BASE_URL", "N8N_API_KEY"],
    workspaceScopes: "all",
    productionUse: "Durable automation workflows and human approval handoffs."
  },
  {
    provider: "stripe",
    displayName: "Stripe",
    capabilities: ["payments"],
    requiredEnvironment: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    workspaceScopes: ["haulbrokr", "merchnow", "stratus"],
    productionUse: "Billing, checkout, account balances, payment events, and finance reconciliation."
  },
  {
    provider: "google",
    displayName: "Google APIs",
    capabilities: ["calendar", "email"],
    requiredEnvironment: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    workspaceScopes: "all",
    productionUse: "Calendar orchestration, Gmail drafting, Drive document references, and account context."
  },
  {
    provider: "vercel",
    displayName: "Vercel",
    capabilities: ["deployment", "hosting"],
    requiredEnvironment: ["VERCEL_TOKEN", "VERCEL_TEAM_ID"],
    workspaceScopes: "all",
    productionUse: "Dashboard, admin, and voice app deployment visibility."
  },
  {
    provider: "railway",
    displayName: "Railway",
    capabilities: ["deployment", "hosting"],
    requiredEnvironment: ["RAILWAY_TOKEN"],
    workspaceScopes: "all",
    productionUse: "Express API service deployment and background worker hosting."
  }
] as const satisfies readonly IntegrationDefinition[];

export function getIntegrationsForWorkspace(workspace: WorkspaceKey): readonly IntegrationDefinition[] {
  return integrationRegistry.filter((integration) => {
    if (integration.workspaceScopes === "all") {
      return true;
    }

    return integration.workspaceScopes.includes(workspace);
  });
}

export function resolveIntegrationState(
  workspace: WorkspaceKey,
  environment: Record<string, string | undefined>
): readonly IntegrationRuntimeState[] {
  return getIntegrationsForWorkspace(workspace).map((integration) => {
    const missingEnvironment = integration.requiredEnvironment.filter((key) => !environment[key]);

    return {
      ...integration,
      status: missingEnvironment.length === 0 ? "configured" : "missing-configuration",
      missingEnvironment
    };
  });
}
