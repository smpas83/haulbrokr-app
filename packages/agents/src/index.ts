export type WorkspaceKey = "haulbrokr" | "merchnow" | "gwfg" | "stratus" | "personal";

export type AgentTier = "executive" | "engineering" | "business" | "company" | "automation";

export type AgentRuntime = "openai" | "anthropic" | "openrouter";

export type AgentDefinition = {
  readonly id: string;
  readonly name: string;
  readonly tier: AgentTier;
  readonly runtime: AgentRuntime;
  readonly companyScope: readonly WorkspaceKey[] | "all";
  readonly mission: string;
  readonly responsibilities: readonly string[];
  readonly tools: readonly string[];
  readonly escalationPath: readonly string[];
};

const leadershipAgents = [
  {
    id: "ceo",
    name: "CEO",
    tier: "executive",
    runtime: "anthropic",
    companyScope: "all",
    mission: "Own strategy, capital allocation, and final operating judgment across KIP workspaces.",
    responsibilities: ["Executive synthesis", "Risk review", "Decision history stewardship"],
    tools: ["memory.search", "analytics.executive", "approval.queue"],
    escalationPath: ["chief-of-staff", "legal", "finance"]
  },
  {
    id: "chief-of-staff",
    name: "Chief of Staff",
    tier: "executive",
    runtime: "anthropic",
    companyScope: "all",
    mission: "Translate strategy into priorities, owner assignments, and accountability loops.",
    responsibilities: ["Daily priorities", "Meeting prep", "Cross-company follow-up"],
    tools: ["calendar.read", "tasks.assign", "notifications.route"],
    escalationPath: ["ceo"]
  },
  {
    id: "executive-assistant",
    name: "Executive Assistant",
    tier: "executive",
    runtime: "openai",
    companyScope: "all",
    mission: "Coordinate calendars, email triage, travel details, and executive communications.",
    responsibilities: ["Calendar blocks", "Inbox triage", "Document preparation"],
    tools: ["calendar.write", "email.draft", "documents.prepare"],
    escalationPath: ["chief-of-staff"]
  }
] as const satisfies readonly AgentDefinition[];

const engineeringAgents = [
  {
    id: "cto",
    name: "CTO",
    tier: "engineering",
    runtime: "anthropic",
    companyScope: "all",
    mission: "Set technical architecture, reliability standards, and engineering execution quality.",
    responsibilities: ["Architecture review", "Technical roadmap", "Security alignment"],
    tools: ["github.read", "analytics.engineering", "memory.decisions"],
    escalationPath: ["ceo", "security", "devops"]
  },
  {
    id: "lead-developer",
    name: "Lead Developer",
    tier: "engineering",
    runtime: "anthropic",
    companyScope: "all",
    mission: "Coordinate implementation work and maintain code quality across product surfaces.",
    responsibilities: ["Pull request planning", "Code review", "Release readiness"],
    tools: ["github.prs", "tasks.assign", "documents.architecture"],
    escalationPath: ["cto"]
  },
  {
    id: "backend",
    name: "Backend",
    tier: "engineering",
    runtime: "openai",
    companyScope: "all",
    mission: "Build APIs, data models, queues, integrations, and service contracts.",
    responsibilities: ["Express services", "Supabase data access", "Integration webhooks"],
    tools: ["postgres.query", "supabase.rpc", "n8n.webhook"],
    escalationPath: ["lead-developer", "security"]
  },
  {
    id: "frontend",
    name: "Frontend",
    tier: "engineering",
    runtime: "openai",
    companyScope: "all",
    mission: "Build fast, accessible, polished React and Next.js interfaces.",
    responsibilities: ["Dashboard UI", "Design system", "Interaction quality"],
    tools: ["next.render", "ui.tokens", "analytics.ui"],
    escalationPath: ["lead-developer"]
  },
  {
    id: "mobile",
    name: "Mobile",
    tier: "engineering",
    runtime: "openai",
    companyScope: "all",
    mission: "Own mobile operating surfaces and voice-first field workflows.",
    responsibilities: ["Mobile UX", "Push workflows", "Offline readiness"],
    tools: ["notifications.push", "voice.commands", "analytics.mobile"],
    escalationPath: ["lead-developer"]
  },
  {
    id: "qa",
    name: "QA",
    tier: "engineering",
    runtime: "openrouter",
    companyScope: "all",
    mission: "Validate product behavior, regression risk, and launch readiness.",
    responsibilities: ["Acceptance tests", "Regression audits", "Release sign-off"],
    tools: ["github.checks", "analytics.quality", "documents.release"],
    escalationPath: ["lead-developer"]
  },
  {
    id: "security",
    name: "Security",
    tier: "engineering",
    runtime: "anthropic",
    companyScope: "all",
    mission: "Protect identity, permissions, secrets, financial data, and operational systems.",
    responsibilities: ["Permission audits", "Threat modeling", "Incident review"],
    tools: ["clerk.audit", "github.security", "documents.incidents"],
    escalationPath: ["cto", "legal"]
  },
  {
    id: "devops",
    name: "DevOps",
    tier: "engineering",
    runtime: "openrouter",
    companyScope: "all",
    mission: "Operate deployment, observability, rollback, and infrastructure workflows.",
    responsibilities: ["Vercel deploys", "Railway services", "Incident response"],
    tools: ["vercel.deployments", "railway.services", "notifications.pager"],
    escalationPath: ["cto", "security"]
  }
] as const satisfies readonly AgentDefinition[];

const businessAgents = [
  {
    id: "marketing",
    name: "Marketing",
    tier: "business",
    runtime: "openai",
    companyScope: "all",
    mission: "Drive brand, campaigns, content, and growth experiments.",
    responsibilities: ["Campaign briefs", "Content calendar", "Conversion analysis"],
    tools: ["analytics.marketing", "documents.brand", "email.campaigns"],
    escalationPath: ["ceo", "sales"]
  },
  {
    id: "sales",
    name: "Sales",
    tier: "business",
    runtime: "openai",
    companyScope: "all",
    mission: "Manage pipeline, customer development, and revenue operations.",
    responsibilities: ["Pipeline review", "Account plans", "Follow-up drafting"],
    tools: ["email.draft", "calendar.schedule", "analytics.revenue"],
    escalationPath: ["ceo", "finance"]
  },
  {
    id: "finance",
    name: "Finance",
    tier: "business",
    runtime: "anthropic",
    companyScope: "all",
    mission: "Track cash, margins, payments, budgets, and financial controls.",
    responsibilities: ["Cash view", "Pricing guardrails", "Stripe reconciliation"],
    tools: ["stripe.read", "analytics.finance", "documents.financial"],
    escalationPath: ["ceo", "legal"]
  },
  {
    id: "legal",
    name: "Legal",
    tier: "business",
    runtime: "anthropic",
    companyScope: "all",
    mission: "Review contracts, compliance exposure, approvals, and policy risk.",
    responsibilities: ["Contract review", "Compliance tracking", "Approval policy"],
    tools: ["documents.contracts", "memory.decisions", "approval.queue"],
    escalationPath: ["ceo", "security"]
  },
  {
    id: "research",
    name: "Research",
    tier: "business",
    runtime: "openrouter",
    companyScope: "all",
    mission: "Investigate markets, vendors, competitors, and strategic options.",
    responsibilities: ["Market briefs", "Vendor analysis", "Knowledge capture"],
    tools: ["memory.search", "documents.research", "analytics.market"],
    escalationPath: ["chief-of-staff"]
  },
  {
    id: "operations",
    name: "Operations",
    tier: "business",
    runtime: "openai",
    companyScope: "all",
    mission: "Improve execution, throughput, process design, and operating cadence.",
    responsibilities: ["Process maps", "Queue health", "Operating reviews"],
    tools: ["workflows.run", "analytics.operations", "tasks.assign"],
    escalationPath: ["chief-of-staff"]
  }
] as const satisfies readonly AgentDefinition[];

const automationAgents = [
  {
    id: "github",
    name: "GitHub",
    tier: "automation",
    runtime: "openai",
    companyScope: "all",
    mission: "Monitor repositories, issues, pull requests, deployments, and engineering signals.",
    responsibilities: ["PR summaries", "Issue triage", "Release notes"],
    tools: ["github.issues", "github.pulls", "github.actions"],
    escalationPath: ["lead-developer", "devops"]
  },
  {
    id: "calendar",
    name: "Calendar",
    tier: "automation",
    runtime: "openai",
    companyScope: "all",
    mission: "Protect focus time, schedule meetings, and prepare calendar-aware briefs.",
    responsibilities: ["Calendar search", "Scheduling", "Meeting agendas"],
    tools: ["google.calendar", "documents.agenda", "notifications.route"],
    escalationPath: ["executive-assistant"]
  },
  {
    id: "email",
    name: "Email",
    tier: "automation",
    runtime: "openai",
    companyScope: "all",
    mission: "Triage inboxes, draft replies, and route critical communications.",
    responsibilities: ["Inbox triage", "Draft generation", "Follow-up detection"],
    tools: ["google.gmail", "memory.search", "tasks.assign"],
    escalationPath: ["executive-assistant", "legal"]
  }
] as const satisfies readonly AgentDefinition[];

const companyAgents = [
  {
    id: "haulbrokr-dispatch",
    name: "HaulBrokr Dispatch",
    tier: "company",
    runtime: "openai",
    companyScope: ["haulbrokr"],
    mission: "Coordinate dump truck capacity, job timing, site readiness, and field exceptions.",
    responsibilities: ["Dispatch board", "Driver coordination", "Exception routing"],
    tools: ["haulbrokr.loads", "calendar.schedule", "notifications.sms"],
    escalationPath: ["operations", "customer-growth"]
  },
  {
    id: "haulbrokr-vendor-growth",
    name: "HaulBrokr Vendor Growth",
    tier: "company",
    runtime: "openai",
    companyScope: ["haulbrokr"],
    mission: "Grow carrier supply and improve vendor activation quality.",
    responsibilities: ["Carrier pipeline", "Onboarding status", "Activation outreach"],
    tools: ["email.campaigns", "analytics.vendor", "documents.onboarding"],
    escalationPath: ["sales", "operations"]
  },
  {
    id: "haulbrokr-customer-growth",
    name: "HaulBrokr Customer Growth",
    tier: "company",
    runtime: "openai",
    companyScope: ["haulbrokr"],
    mission: "Expand contractor, broker, and construction customer demand.",
    responsibilities: ["Demand generation", "Account plans", "Quote follow-up"],
    tools: ["analytics.customer", "email.draft", "tasks.assign"],
    escalationPath: ["sales", "marketing"]
  },
  {
    id: "haulbrokr-pricing",
    name: "HaulBrokr Pricing",
    tier: "company",
    runtime: "anthropic",
    companyScope: ["haulbrokr"],
    mission: "Price hauls with margin discipline, carrier availability, and route risk.",
    responsibilities: ["Rate guidance", "Margin checks", "Bid review"],
    tools: ["analytics.finance", "memory.decisions", "approval.queue"],
    escalationPath: ["finance", "ceo"]
  },
  {
    id: "haulbrokr-compliance",
    name: "HaulBrokr Compliance",
    tier: "company",
    runtime: "anthropic",
    companyScope: ["haulbrokr"],
    mission: "Track carrier documents, insurance, job evidence, and operating compliance.",
    responsibilities: ["Document status", "Insurance review", "Audit packets"],
    tools: ["documents.compliance", "notifications.route", "memory.history"],
    escalationPath: ["legal", "security"]
  },
  {
    id: "merchnow-marketplace",
    name: "MerchNow Marketplace",
    tier: "company",
    runtime: "openai",
    companyScope: ["merchnow"],
    mission: "Optimize marketplace supply, demand, merchandising coverage, and transaction quality.",
    responsibilities: ["Marketplace health", "Listing quality", "Conversion review"],
    tools: ["analytics.marketplace", "documents.catalog", "tasks.assign"],
    escalationPath: ["operations", "sales"]
  },
  {
    id: "merchnow-retail-sales",
    name: "MerchNow Retail Sales",
    tier: "company",
    runtime: "openai",
    companyScope: ["merchnow"],
    mission: "Grow retail account pipeline and sell-through execution.",
    responsibilities: ["Retail pipeline", "Buyer follow-up", "Store performance"],
    tools: ["email.draft", "analytics.revenue", "calendar.schedule"],
    escalationPath: ["sales"]
  },
  {
    id: "merchnow-brand-success",
    name: "MerchNow Brand Success",
    tier: "company",
    runtime: "openai",
    companyScope: ["merchnow"],
    mission: "Support brands with launch plans, retail readiness, and performance insight.",
    responsibilities: ["Brand onboarding", "Campaign briefs", "Issue resolution"],
    tools: ["documents.brand", "analytics.brand", "tasks.assign"],
    escalationPath: ["marketing", "operations"]
  },
  {
    id: "merchnow-merchandiser-growth",
    name: "MerchNow Merchandiser Growth",
    tier: "company",
    runtime: "openai",
    companyScope: ["merchnow"],
    mission: "Recruit, onboard, and retain merchandisers with measurable field quality.",
    responsibilities: ["Recruiting funnel", "Activation tasks", "Coverage analysis"],
    tools: ["analytics.field", "email.campaigns", "documents.training"],
    escalationPath: ["operations"]
  },
  {
    id: "merchnow-photo-compliance",
    name: "MerchNow Photo Compliance",
    tier: "company",
    runtime: "openrouter",
    companyScope: ["merchnow"],
    mission: "Validate proof-of-work photo standards and route exceptions.",
    responsibilities: ["Photo review", "Compliance scoring", "Exception tickets"],
    tools: ["documents.media", "analytics.quality", "approval.queue"],
    escalationPath: ["qa", "legal"]
  },
  {
    id: "gwfg-production",
    name: "Golden West Production",
    tier: "company",
    runtime: "openai",
    companyScope: ["gwfg"],
    mission: "Coordinate production plans, line constraints, throughput, and shift execution.",
    responsibilities: ["Production schedule", "Line readiness", "Throughput review"],
    tools: ["analytics.production", "calendar.schedule", "notifications.route"],
    escalationPath: ["operations", "control-tower"]
  },
  {
    id: "gwfg-purchasing",
    name: "Golden West Purchasing",
    tier: "company",
    runtime: "openai",
    companyScope: ["gwfg"],
    mission: "Manage procurement risk, vendor commitments, and ingredient availability.",
    responsibilities: ["Purchase orders", "Vendor risk", "Cost variance"],
    tools: ["documents.purchase", "analytics.inventory", "email.draft"],
    escalationPath: ["finance", "operations"]
  },
  {
    id: "gwfg-inventory",
    name: "Golden West Inventory",
    tier: "company",
    runtime: "openai",
    companyScope: ["gwfg"],
    mission: "Track inventory posture, shortages, lot movement, and demand coverage.",
    responsibilities: ["Stock position", "Shortage alerts", "Lot traceability"],
    tools: ["analytics.inventory", "notifications.route", "memory.history"],
    escalationPath: ["purchasing", "warehouse"]
  },
  {
    id: "gwfg-warehouse",
    name: "Golden West Warehouse",
    tier: "company",
    runtime: "openai",
    companyScope: ["gwfg"],
    mission: "Improve dock flow, pick accuracy, staging, and warehouse labor coordination.",
    responsibilities: ["Dock schedule", "Pick exceptions", "Staging readiness"],
    tools: ["analytics.warehouse", "calendar.schedule", "tasks.assign"],
    escalationPath: ["operations", "labor"]
  },
  {
    id: "gwfg-maintenance",
    name: "Golden West Maintenance",
    tier: "company",
    runtime: "openrouter",
    companyScope: ["gwfg"],
    mission: "Reduce downtime with preventive maintenance and rapid equipment triage.",
    responsibilities: ["Maintenance calendar", "Downtime review", "Parts readiness"],
    tools: ["calendar.schedule", "documents.maintenance", "notifications.pager"],
    escalationPath: ["operations", "production"]
  },
  {
    id: "gwfg-qa-food-safety",
    name: "Golden West QA Food Safety",
    tier: "company",
    runtime: "anthropic",
    companyScope: ["gwfg"],
    mission: "Protect food safety, quality systems, audits, and compliance records.",
    responsibilities: ["Food safety checks", "Audit readiness", "Quality incidents"],
    tools: ["documents.compliance", "approval.queue", "memory.decisions"],
    escalationPath: ["legal", "security"]
  },
  {
    id: "gwfg-control-tower",
    name: "Golden West Control Tower",
    tier: "company",
    runtime: "anthropic",
    companyScope: ["gwfg"],
    mission: "Maintain end-to-end visibility across production, warehouse, inventory, and labor.",
    responsibilities: ["Operating picture", "Exception prioritization", "Executive summary"],
    tools: ["analytics.operations", "notifications.route", "memory.search"],
    escalationPath: ["chief-of-staff", "ceo"]
  },
  {
    id: "gwfg-labor",
    name: "Golden West Labor",
    tier: "company",
    runtime: "openai",
    companyScope: ["gwfg"],
    mission: "Plan staffing, shift coverage, overtime risk, and labor productivity.",
    responsibilities: ["Shift plans", "Overtime review", "Coverage gaps"],
    tools: ["analytics.labor", "calendar.schedule", "tasks.assign"],
    escalationPath: ["operations", "finance"]
  },
  {
    id: "stratus-projects",
    name: "Stratus Projects",
    tier: "company",
    runtime: "openai",
    companyScope: ["stratus"],
    mission: "Track project scope, milestones, blockers, owners, and client commitments.",
    responsibilities: ["Project plans", "Milestone review", "Risk escalation"],
    tools: ["documents.projects", "tasks.assign", "analytics.projects"],
    escalationPath: ["operations", "sales"]
  },
  {
    id: "stratus-sales",
    name: "Stratus Sales",
    tier: "company",
    runtime: "openai",
    companyScope: ["stratus"],
    mission: "Develop pipeline, proposals, and account expansion for Stratus Group.",
    responsibilities: ["Pipeline management", "Proposal drafting", "Client follow-up"],
    tools: ["email.draft", "documents.proposals", "analytics.revenue"],
    escalationPath: ["sales", "ceo"]
  },
  {
    id: "stratus-accounting",
    name: "Stratus Accounting",
    tier: "company",
    runtime: "anthropic",
    companyScope: ["stratus"],
    mission: "Monitor invoices, collections, job costing, and accounting controls.",
    responsibilities: ["Invoice review", "Collections alerts", "Cost variance"],
    tools: ["analytics.finance", "documents.financial", "notifications.route"],
    escalationPath: ["finance", "legal"]
  },
  {
    id: "stratus-operations",
    name: "Stratus Operations",
    tier: "company",
    runtime: "openai",
    companyScope: ["stratus"],
    mission: "Coordinate service delivery, staffing, vendors, and operational throughput.",
    responsibilities: ["Operating cadence", "Vendor coordination", "Issue routing"],
    tools: ["workflows.run", "tasks.assign", "analytics.operations"],
    escalationPath: ["operations", "chief-of-staff"]
  }
] as const satisfies readonly AgentDefinition[];

export const agentRegistry = [
  ...leadershipAgents,
  ...engineeringAgents,
  ...businessAgents,
  ...automationAgents,
  ...companyAgents
] as const satisfies readonly AgentDefinition[];

export type AgentId = (typeof agentRegistry)[number]["id"];

export function getAgentsForWorkspace(workspace: WorkspaceKey): readonly AgentDefinition[] {
  return agentRegistry.filter((agent) => {
    if (agent.companyScope === "all") {
      return true;
    }

    return agent.companyScope.includes(workspace);
  });
}

export function getAgentById(agentId: AgentId): AgentDefinition {
  const agent = agentRegistry.find((candidate) => candidate.id === agentId);

  if (!agent) {
    throw new Error(`Unknown KIP agent id: ${agentId}`);
  }

  return agent;
}
