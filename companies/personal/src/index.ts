import { defineCompanyWorkspace } from "@kip/workflows";

export const personalWorkspace = defineCompanyWorkspace({
  key: "personal",
  name: "Personal",
  mission: "Protect personal priorities, calendar capacity, decisions, documents, and follow-through alongside company operating systems.",
  tasks: [
    {
      id: "personal-priorities",
      title: "Confirm today's personal priority stack",
      owner: "Chief of Staff",
      priority: "high",
      status: "in-progress",
      outcome: "The day has a clear priority order, protected focus blocks, and visible trade-offs."
    },
    {
      id: "personal-calendar",
      title: "Clean up calendar conflicts",
      owner: "Executive Assistant",
      priority: "high",
      status: "ready",
      outcome: "Calendar conflicts, travel buffers, and preparation windows are resolved."
    },
    {
      id: "personal-followups",
      title: "Close overdue personal follow-ups",
      owner: "Executive Assistant",
      priority: "normal",
      status: "ready",
      outcome: "Personal commitments have drafted responses, next actions, or archived context."
    }
  ],
  documents: [
    {
      id: "personal-decision-log",
      title: "Personal decision log",
      category: "strategy",
      owner: "CEO",
      systemOfRecord: "supabase"
    },
    {
      id: "personal-calendar-prep",
      title: "Meeting and calendar preparation notes",
      category: "operations",
      owner: "Executive Assistant",
      systemOfRecord: "google-drive"
    },
    {
      id: "personal-systems",
      title: "Personal operating system architecture",
      category: "technical",
      owner: "CTO",
      systemOfRecord: "github"
    }
  ],
  dashboards: [
    {
      id: "personal-command",
      title: "Personal Command",
      widgets: ["Today priorities", "Calendar", "Email follow-ups", "Decision history", "Memory search"],
      audience: ["CEO", "Chief of Staff", "Executive Assistant"]
    }
  ],
  permissions: [
    {
      id: "personal-owner",
      name: "Personal Owner",
      grants: ["workspace.read", "workspace.write", "approvals.final", "memory.restricted"]
    },
    {
      id: "personal-support",
      name: "Personal Support",
      grants: ["calendar.write", "email.draft", "tasks.write", "memory.confidential"]
    }
  ]
});

export default personalWorkspace;
