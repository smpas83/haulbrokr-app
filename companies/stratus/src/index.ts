import { defineCompanyWorkspace } from "@kip/workflows";

export const stratusWorkspace = defineCompanyWorkspace({
  key: "stratus",
  name: "Stratus Group",
  mission: "Coordinate projects, sales, accounting, and operations with clear client commitments and cash-flow visibility.",
  tasks: [
    {
      id: "stratus-project-risk",
      title: "Review elevated project risks",
      owner: "Stratus Projects",
      priority: "critical",
      status: "in-progress",
      outcome: "Every elevated project has a risk owner, client message, and mitigation path."
    },
    {
      id: "stratus-sales-proposals",
      title: "Finalize active proposal follow-ups",
      owner: "Stratus Sales",
      priority: "high",
      status: "ready",
      outcome: "Open proposals have next contact, pricing context, and decision timeline."
    },
    {
      id: "stratus-invoice-cycle",
      title: "Audit completed work awaiting invoice",
      owner: "Stratus Accounting",
      priority: "high",
      status: "review",
      outcome: "Completed billable work is converted into reviewed invoices or documented holds."
    }
  ],
  documents: [
    {
      id: "stratus-project-charters",
      title: "Project charter library",
      category: "operations",
      owner: "Stratus Projects",
      systemOfRecord: "google-drive"
    },
    {
      id: "stratus-proposal-template",
      title: "Proposal and scope template",
      category: "strategy",
      owner: "Sales",
      systemOfRecord: "github"
    },
    {
      id: "stratus-accounting-policy",
      title: "Billing and collections policy",
      category: "finance",
      owner: "Finance",
      systemOfRecord: "supabase"
    }
  ],
  dashboards: [
    {
      id: "stratus-command",
      title: "Stratus Operating Command",
      widgets: ["Project risk", "Proposal pipeline", "Invoice cycle", "Operations queue", "Client follow-ups"],
      audience: ["CEO", "Projects", "Sales", "Accounting", "Operations"]
    }
  ],
  permissions: [
    {
      id: "stratus-executive",
      name: "Stratus Executive",
      grants: ["workspace.read", "workspace.write", "approvals.final", "finance.read", "memory.restricted"]
    },
    {
      id: "stratus-delivery",
      name: "Stratus Delivery",
      grants: ["projects.write", "operations.write", "documents.operations.write", "memory.internal"]
    },
    {
      id: "stratus-finance",
      name: "Stratus Finance",
      grants: ["finance.write", "documents.financial.write", "approval.finance", "memory.confidential"]
    }
  ]
});

export default stratusWorkspace;
