import { defineCompanyWorkspace } from "@kip/workflows";

export const haulbrokrWorkspace = defineCompanyWorkspace({
  key: "haulbrokr",
  name: "HaulBrokr",
  mission: "Operate the dump truck marketplace with disciplined dispatch, carrier compliance, customer growth, and margin-aware pricing.",
  tasks: [
    {
      id: "hb-dispatch-exceptions",
      title: "Clear dispatch exceptions before noon",
      owner: "HaulBrokr Dispatch",
      priority: "critical",
      status: "in-progress",
      outcome: "Every active load has a confirmed carrier, time window, and escalation owner."
    },
    {
      id: "hb-carrier-compliance",
      title: "Review carrier document expirations",
      owner: "HaulBrokr Compliance",
      priority: "high",
      status: "ready",
      outcome: "Insurance and operating documents are current before carriers receive work."
    },
    {
      id: "hb-pricing-review",
      title: "Audit quoted rates against margin guardrails",
      owner: "HaulBrokr Pricing",
      priority: "high",
      status: "review",
      outcome: "High-value bids preserve target contribution margin and site risk coverage."
    }
  ],
  documents: [
    {
      id: "hb-rate-book",
      title: "HaulBrokr pricing and route risk book",
      category: "finance",
      owner: "Finance",
      systemOfRecord: "supabase"
    },
    {
      id: "hb-carrier-compliance",
      title: "Carrier compliance packet library",
      category: "compliance",
      owner: "HaulBrokr Compliance",
      systemOfRecord: "google-drive"
    },
    {
      id: "hb-dispatch-runbook",
      title: "Dispatch escalation runbook",
      category: "operations",
      owner: "Operations",
      systemOfRecord: "github"
    }
  ],
  dashboards: [
    {
      id: "hb-command",
      title: "HaulBrokr Dispatch Command",
      widgets: ["Active loads", "Carrier readiness", "Pricing exceptions", "Approval queue", "Customer follow-ups"],
      audience: ["CEO", "Operations", "Dispatch", "Compliance"]
    }
  ],
  permissions: [
    {
      id: "hb-executive",
      name: "HaulBrokr Executive",
      grants: ["workspace.read", "workspace.write", "approvals.final", "finance.read", "memory.restricted"]
    },
    {
      id: "hb-operations",
      name: "HaulBrokr Operations",
      grants: ["tasks.write", "dispatch.write", "documents.compliance.read", "memory.internal"]
    },
    {
      id: "hb-growth",
      name: "HaulBrokr Growth",
      grants: ["customers.write", "vendors.write", "analytics.read", "memory.internal"]
    }
  ]
});

export default haulbrokrWorkspace;
