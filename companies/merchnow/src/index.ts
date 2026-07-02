import { defineCompanyWorkspace } from "@kip/workflows";

export const merchnowWorkspace = defineCompanyWorkspace({
  key: "merchnow",
  name: "MerchNow",
  mission: "Scale retail execution through marketplace health, brand success, merchandiser quality, and proof-of-work compliance.",
  tasks: [
    {
      id: "mn-marketplace-health",
      title: "Review marketplace coverage gaps",
      owner: "MerchNow Marketplace",
      priority: "critical",
      status: "in-progress",
      outcome: "High-priority store and brand coverage gaps have owners and field capacity."
    },
    {
      id: "mn-photo-compliance",
      title: "Route failed photo compliance reviews",
      owner: "MerchNow Photo Compliance",
      priority: "high",
      status: "ready",
      outcome: "Every rejected photo set has a field correction, brand note, or manager override."
    },
    {
      id: "mn-retail-pipeline",
      title: "Prepare retail buyer follow-up queue",
      owner: "MerchNow Retail Sales",
      priority: "normal",
      status: "ready",
      outcome: "Active retail opportunities have next steps, account context, and sample status."
    }
  ],
  documents: [
    {
      id: "mn-brand-playbook",
      title: "Brand onboarding and retail launch playbook",
      category: "operations",
      owner: "MerchNow Brand Success",
      systemOfRecord: "google-drive"
    },
    {
      id: "mn-photo-standard",
      title: "Photo compliance standard",
      category: "compliance",
      owner: "QA",
      systemOfRecord: "supabase"
    },
    {
      id: "mn-marketplace-architecture",
      title: "Marketplace data and workflow architecture",
      category: "technical",
      owner: "CTO",
      systemOfRecord: "github"
    }
  ],
  dashboards: [
    {
      id: "mn-command",
      title: "MerchNow Marketplace Command",
      widgets: ["Store coverage", "Photo pass rate", "Brand launch status", "Merchandiser funnel", "Retail pipeline"],
      audience: ["CEO", "Operations", "Brand Success", "Sales"]
    }
  ],
  permissions: [
    {
      id: "mn-executive",
      name: "MerchNow Executive",
      grants: ["workspace.read", "workspace.write", "approvals.final", "analytics.read", "memory.restricted"]
    },
    {
      id: "mn-field-ops",
      name: "MerchNow Field Operations",
      grants: ["tasks.write", "field.write", "documents.compliance.read", "memory.internal"]
    },
    {
      id: "mn-brand-success",
      name: "MerchNow Brand Success",
      grants: ["brands.write", "documents.operations.write", "analytics.read", "memory.internal"]
    }
  ]
});

export default merchnowWorkspace;
