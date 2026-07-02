import type { WorkspaceKey } from "@kip/agents";

export type NotificationChannel = "in-app" | "email" | "sms" | "push" | "pager";

export type NotificationSeverity = "info" | "action" | "urgent";

export type NotificationPolicy = {
  readonly id: string;
  readonly workspace: WorkspaceKey | "all";
  readonly channel: NotificationChannel;
  readonly severity: NotificationSeverity;
  readonly trigger: string;
  readonly targetRole: string;
  readonly deliveryWindow: "immediate" | "business-hours" | "daily-digest";
};

export const notificationPolicies = [
  {
    id: "approval-queue-urgent",
    workspace: "all",
    channel: "in-app",
    severity: "urgent",
    trigger: "Approval queue item exceeds policy threshold.",
    targetRole: "Chief of Staff",
    deliveryWindow: "immediate"
  },
  {
    id: "security-incident-pager",
    workspace: "all",
    channel: "pager",
    severity: "urgent",
    trigger: "Security, identity, or payment incident is opened.",
    targetRole: "Security",
    deliveryWindow: "immediate"
  },
  {
    id: "calendar-daily-brief",
    workspace: "all",
    channel: "email",
    severity: "info",
    trigger: "Daily calendar brief is ready.",
    targetRole: "Executive Assistant",
    deliveryWindow: "daily-digest"
  },
  {
    id: "haulbrokr-dispatch-sms",
    workspace: "haulbrokr",
    channel: "sms",
    severity: "action",
    trigger: "Dispatch exception needs driver or customer response.",
    targetRole: "HaulBrokr Dispatch",
    deliveryWindow: "immediate"
  },
  {
    id: "gwfg-production-push",
    workspace: "gwfg",
    channel: "push",
    severity: "action",
    trigger: "Production or inventory risk changes operating plan.",
    targetRole: "Golden West Control Tower",
    deliveryWindow: "immediate"
  }
] as const satisfies readonly NotificationPolicy[];

export function getNotificationPolicies(workspace: WorkspaceKey): readonly NotificationPolicy[] {
  return notificationPolicies.filter((policy) => policy.workspace === "all" || policy.workspace === workspace);
}
