"use client";

import { gwfgWorkspace } from "@kip/company-gwfg";
import { haulbrokrWorkspace } from "@kip/company-haulbrokr";
import { merchnowWorkspace } from "@kip/company-merchnow";
import { personalWorkspace } from "@kip/company-personal";
import { stratusWorkspace } from "@kip/company-stratus";
import { CommandInput, GlassCard, MetricCard, StatusPill, Waveform } from "@kip/ui";
import type { CompanyWorkspace } from "@kip/workflows";
import { Bell, Bot, CalendarDays, Github, Mail, Mic, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

const workspaces = [
  haulbrokrWorkspace,
  merchnowWorkspace,
  gwfgWorkspace,
  stratusWorkspace,
  personalWorkspace
] as const satisfies readonly CompanyWorkspace[];

const workspaceByKey = new Map(workspaces.map((workspace) => [workspace.key, workspace]));

export function KipDashboard() {
  const [workspaceKey, setWorkspaceKey] = useState<CompanyWorkspace["key"]>("haulbrokr");
  const workspace = workspaceByKey.get(workspaceKey) ?? haulbrokrWorkspace;
  const commandText = `Summarize ${workspace.name} priorities, approvals, memory, and agent status.`;

  const activeAgents = useMemo(() => workspace.agents.slice(0, 10), [workspace]);
  const executiveAgents = workspace.agents.filter((agent) => agent.tier === "executive").length;
  const companyAgents = workspace.agents.filter((agent) => agent.tier === "company").length;

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-6 text-white sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-5 rounded-[2.5rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-100">
              <Sparkles size={14} /> Kash AI OS
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">KIP Command Center</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">{workspace.mission}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="text-sm text-slate-400">
              Company
              <select
                className="mt-2 w-full rounded-full border border-white/10 bg-black/40 px-4 py-3 text-white outline-none ring-cyan-300/30 transition focus:ring-4"
                value={workspaceKey}
                onChange={(event) => setWorkspaceKey(event.target.value as CompanyWorkspace["key"])}
              >
                {workspaces.map((candidate) => (
                  <option key={candidate.key} value={candidate.key}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="group flex items-center justify-center gap-3 rounded-full bg-cyan-200 px-5 py-3 font-semibold text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:bg-white">
              <Mic size={18} />
              Voice
            </button>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <GlassCard title="Command center" eyebrow="Live operating system">
            <CommandInput value={commandText} />
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <MetricCard label="Agents online" value={String(workspace.agents.length)} detail={`${executiveAgents} executive and ${companyAgents} company agents scoped to this workspace.`} trend="up" />
              <MetricCard label="Tasks active" value={String(workspace.tasks.length)} detail="Priority work is assigned with owner, status, and outcome." trend="up" />
              <MetricCard label="Integrations" value={String(workspace.integrations.length)} detail="Provider contracts are registered with required production configuration." trend="flat" />
            </div>
          </GlassCard>

          <GlassCard title="Voice assistant" eyebrow="Speech interface" action={<StatusPill label="Company aware" tone="good" />}>
            <div className="rounded-3xl border border-cyan-200/10 bg-cyan-200/10 p-4">
              <Waveform bars={28} />
              <p className="mt-4 text-center text-sm leading-6 text-cyan-50">
                Listening surface supports speech recognition, streaming responses, synthesis, waveform visualization, history, and workspace-aware commands.
              </p>
            </div>
          </GlassCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr_0.8fr]">
          <GlassCard title="Today's priorities" eyebrow={workspace.name}>
            <div className="space-y-3">
              {workspace.tasks.map((task) => (
                <article key={task.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{task.title}</h3>
                      <p className="mt-1 text-sm text-slate-400">{task.outcome}</p>
                    </div>
                    <StatusPill label={task.priority} tone={task.priority === "critical" ? "critical" : "warning"} />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">{task.owner} / {task.status}</p>
                </article>
              ))}
            </div>
          </GlassCard>

          <GlassCard title="Chat panel" eyebrow="Agent collaboration">
            <div className="space-y-4">
              <div className="rounded-3xl bg-white/10 p-4">
                <p className="text-sm text-slate-300">User</p>
                <p className="mt-1 text-white">What needs approval before the next operating cycle?</p>
              </div>
              <div className="rounded-3xl border border-cyan-200/20 bg-cyan-200/10 p-4">
                <p className="flex items-center gap-2 text-sm text-cyan-100"><Bot size={16} /> KIP</p>
                <p className="mt-2 leading-7 text-slate-100">
                  {workspace.name} has {workspace.tasks.filter((task) => task.status === "review").length} review item, {workspace.permissions.length} permission groups, and {workspace.documents.length} governed document sets ready for context retrieval.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {activeAgents.map((agent) => (
                  <div key={agent.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="font-medium text-white">{agent.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-400">{agent.mission}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard title="Approval queue" eyebrow="Governance" action={<ShieldCheck className="text-cyan-100" size={20} />}>
            <div className="space-y-3">
              {workspace.permissions.map((group) => (
                <div key={group.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="font-semibold text-white">{group.name}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{group.grants.join(", ")}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          <GlassCard title="Memory search" eyebrow="Supabase vector">
            <PanelLine icon={<Search size={18} />} title={workspace.memory.embeddingModel} body={`${workspace.memory.embeddingDimensions} dimensions across ${workspace.memory.searchableKinds.length} memory kinds.`} />
          </GlassCard>
          <GlassCard title="Calendar" eyebrow="Google APIs">
            <PanelLine icon={<CalendarDays size={18} />} title="Schedule intelligence" body="Meeting prep, focus protection, operating cadence, and owner follow-ups." />
          </GlassCard>
          <GlassCard title="Email" eyebrow="Gmail">
            <PanelLine icon={<Mail size={18} />} title="Inbox routing" body="Drafting, triage, follow-up detection, and workspace memory enrichment." />
          </GlassCard>
          <GlassCard title="GitHub" eyebrow="Engineering">
            <PanelLine icon={<Github size={18} />} title="Repository intelligence" body="Issues, pull requests, deployments, releases, and security signals." />
          </GlassCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <GlassCard title="Notifications" eyebrow="Routing policy" action={<Bell className="text-cyan-100" size={20} />}>
            <div className="grid gap-3 md:grid-cols-2">
              {workspace.notifications.map((policy) => (
                <div key={policy.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="font-semibold text-white">{policy.targetRole}</p>
                  <p className="mt-2 text-sm text-slate-400">{policy.trigger}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-cyan-100">{policy.channel} / {policy.deliveryWindow}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard title="Analytics" eyebrow={workspace.analytics.cadence}>
            <div className="grid gap-3 md:grid-cols-2">
              {workspace.analytics.metrics.map((metric) => (
                <MetricCard key={metric.id} label={metric.label} value={metric.value} detail={metric.decisionUse} trend={metric.trend} />
              ))}
            </div>
          </GlassCard>
        </section>
      </div>
    </main>
  );
}

function PanelLine({ icon, title, body }: { readonly icon: React.ReactNode; readonly title: string; readonly body: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-cyan-100">{icon}</div>
      <div>
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
      </div>
    </div>
  );
}
