# Kash Intelligence Platform Foundation

Kash AI OS is the interface. Kash Intelligence Platform is the multi-business operating platform behind it.

## Monorepo layout

- `apps/dashboard` is the Next.js command center for workspace switching, agents, chat, voice, priorities, approvals, memory, integrations, notifications, and analytics.
- `apps/admin` is the enterprise governance console for permissions, documents, and integration requirements.
- `apps/voice` is the talking interface for company-aware speech commands.
- `apps/api` is the Express API exposing typed workspace, integration, memory, and voice command contracts.
- `packages/agents` owns the full agent registry and workspace-scoped agent filtering.
- `packages/memory` owns Supabase long-term memory contracts, scoring, and vector search SQL.
- `packages/integrations` owns provider requirements for Supabase, Clerk, OpenAI, Anthropic, OpenRouter, GitHub, n8n, Stripe, Google APIs, Vercel, and Railway.
- `packages/workflows` assembles complete company workspaces and governance workflows.
- `packages/ui` owns reusable React glassmorphism and motion components.
- `packages/analytics` owns reusable metric and dashboard definitions.
- `packages/notifications` owns notification routing policy.
- `packages/voice` owns voice configuration, conversation turns, and command classification.
- `companies/*` are first-class workspace packages for HaulBrokr, MerchNow, Golden West Food Group, Stratus Group, and Personal.

## Workspace contract

Each company workspace exports a `CompanyWorkspace` with dedicated memory, agents, tasks, analytics, documents, integrations, dashboards, permissions, and notifications. Apps consume that contract directly, so new company capabilities are added once and immediately become available to the dashboard, admin console, voice interface, and API.

## Memory

KIP memory uses Supabase PostgreSQL with `pgvector`. The schema stores workspace-scoped records for company memory, conversations, decisions, documents, projects, tasks, and integrations. Retrieval combines semantic similarity with importance, confidence, and recency into a single memory score.

## Integration posture

Integrations are registered as production provider contracts. Runtime endpoints report missing configuration from environment variables instead of pretending unavailable external systems are connected.

## Agent posture

Agents are strongly typed by tier, runtime, company scope, mission, responsibilities, tools, and escalation path. Core executive, engineering, business, automation, and company-specific agents are all in `packages/agents`.

## Remaining production work

- Attach Clerk organization membership to workspace permission groups.
- Execute Supabase migrations and wire service-role data access.
- Implement provider clients for GitHub, Google APIs, Stripe, n8n, Vercel, Railway, OpenAI, Anthropic, and OpenRouter.
- Add durable background workers for agent execution and approval routing.
- Add end-to-end browser tests after deployment environment variables are available.
