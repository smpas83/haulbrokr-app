import { getAgentsForWorkspace, type AgentDefinition, type WorkspaceKey } from "@kip/agents";
import { createAnalyticsDashboard, type AnalyticsDashboard } from "@kip/analytics";
import { getIntegrationsForWorkspace, type IntegrationDefinition } from "@kip/integrations";
import { createMemoryNamespace, type MemoryNamespace } from "@kip/memory";
import { getNotificationPolicies, type NotificationPolicy } from "@kip/notifications";

export type WorkspaceTask = {
  readonly id: string;
  readonly title: string;
  readonly owner: string;
  readonly priority: "critical" | "high" | "normal";
  readonly status: "ready" | "in-progress" | "blocked" | "review";
  readonly outcome: string;
};

export type WorkspaceDocument = {
  readonly id: string;
  readonly title: string;
  readonly category: "strategy" | "operations" | "finance" | "legal" | "technical" | "compliance";
  readonly owner: string;
  readonly systemOfRecord: "supabase" | "google-drive" | "github";
};

export type WorkspaceDashboard = {
  readonly id: string;
  readonly title: string;
  readonly widgets: readonly string[];
  readonly audience: readonly string[];
};

export type PermissionGroup = {
  readonly id: string;
  readonly name: string;
  readonly grants: readonly string[];
};

export type CompanyWorkspace = {
  readonly key: WorkspaceKey;
  readonly name: string;
  readonly mission: string;
  readonly memory: MemoryNamespace;
  readonly agents: readonly AgentDefinition[];
  readonly tasks: readonly WorkspaceTask[];
  readonly analytics: AnalyticsDashboard;
  readonly documents: readonly WorkspaceDocument[];
  readonly integrations: readonly IntegrationDefinition[];
  readonly dashboards: readonly WorkspaceDashboard[];
  readonly permissions: readonly PermissionGroup[];
  readonly notifications: readonly NotificationPolicy[];
};

export type CompanyWorkspaceInput = {
  readonly key: WorkspaceKey;
  readonly name: string;
  readonly mission: string;
  readonly tasks: readonly WorkspaceTask[];
  readonly documents: readonly WorkspaceDocument[];
  readonly dashboards: readonly WorkspaceDashboard[];
  readonly permissions: readonly PermissionGroup[];
};

export function defineCompanyWorkspace(input: CompanyWorkspaceInput): CompanyWorkspace {
  return {
    ...input,
    memory: createMemoryNamespace(input.key),
    agents: getAgentsForWorkspace(input.key),
    analytics: createAnalyticsDashboard(input.key, input.name),
    integrations: getIntegrationsForWorkspace(input.key),
    notifications: getNotificationPolicies(input.key)
  };
}

export const commandCenterWorkflow = {
  id: "command-center-daily-loop",
  title: "Command Center Daily Loop",
  trigger: "Workspace opens or daily priority brief is requested.",
  stages: [
    "Load company memory and decision history.",
    "Refresh integrations and approval queues.",
    "Rank today's priorities by urgency, owner, and blocked status.",
    "Route agent recommendations to the chat panel and voice assistant.",
    "Write accepted decisions back to Supabase memory."
  ]
} as const;

export const approvalWorkflow = {
  id: "approval-governance-loop",
  title: "Approval Governance Loop",
  trigger: "Agent action requires financial, legal, security, or executive approval.",
  stages: [
    "Classify approval category and workspace sensitivity.",
    "Retrieve supporting memory, documents, and prior decisions.",
    "Notify the accountable permission group.",
    "Record disposition, owner, and rationale in decision history."
  ]
} as const;
