import { defineCompanyWorkspace } from "@kip/workflows";

export const gwfgWorkspace = defineCompanyWorkspace({
  key: "gwfg",
  name: "Golden West Food Group",
  mission: "Run production, inventory, warehouse, maintenance, quality, and labor through one food-safety-aware control tower.",
  tasks: [
    {
      id: "gwfg-line-attainment",
      title: "Review production line attainment and exceptions",
      owner: "Golden West Control Tower",
      priority: "critical",
      status: "in-progress",
      outcome: "Line misses have assigned corrective actions and updated production plans."
    },
    {
      id: "gwfg-inventory-shortage",
      title: "Resolve at-risk ingredient and packaging shortages",
      owner: "Golden West Inventory",
      priority: "critical",
      status: "ready",
      outcome: "Shortage risks are linked to purchase orders, substitutions, or production schedule changes."
    },
    {
      id: "gwfg-food-safety",
      title: "Prepare food safety audit evidence",
      owner: "Golden West QA Food Safety",
      priority: "high",
      status: "review",
      outcome: "Audit evidence is complete, source-linked, and ready for leadership review."
    }
  ],
  documents: [
    {
      id: "gwfg-haccp",
      title: "Food safety and HACCP controls",
      category: "compliance",
      owner: "Golden West QA Food Safety",
      systemOfRecord: "google-drive"
    },
    {
      id: "gwfg-production-plan",
      title: "Production planning model",
      category: "operations",
      owner: "Golden West Production",
      systemOfRecord: "supabase"
    },
    {
      id: "gwfg-maintenance-runbook",
      title: "Maintenance escalation and downtime runbook",
      category: "operations",
      owner: "Golden West Maintenance",
      systemOfRecord: "github"
    }
  ],
  dashboards: [
    {
      id: "gwfg-command",
      title: "Golden West Control Tower",
      widgets: ["Line attainment", "Inventory risk", "Warehouse dock flow", "Maintenance downtime", "Food safety actions", "Labor coverage"],
      audience: ["CEO", "Operations", "Production", "QA Food Safety"]
    }
  ],
  permissions: [
    {
      id: "gwfg-executive",
      name: "Golden West Executive",
      grants: ["workspace.read", "workspace.write", "approvals.final", "finance.read", "memory.restricted"]
    },
    {
      id: "gwfg-operations",
      name: "Golden West Operations",
      grants: ["production.write", "inventory.write", "warehouse.write", "memory.internal"]
    },
    {
      id: "gwfg-quality",
      name: "Golden West Quality and Food Safety",
      grants: ["documents.compliance.write", "approval.quality", "memory.confidential"]
    }
  ]
});

export default gwfgWorkspace;
