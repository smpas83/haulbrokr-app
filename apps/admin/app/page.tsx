import { gwfgWorkspace } from "@kip/company-gwfg";
import { haulbrokrWorkspace } from "@kip/company-haulbrokr";
import { merchnowWorkspace } from "@kip/company-merchnow";
import { personalWorkspace } from "@kip/company-personal";
import { stratusWorkspace } from "@kip/company-stratus";
import type { CompanyWorkspace } from "@kip/workflows";

const workspaces = [
  haulbrokrWorkspace,
  merchnowWorkspace,
  gwfgWorkspace,
  stratusWorkspace,
  personalWorkspace
] as const satisfies readonly CompanyWorkspace[];

export default function Page() {
  return (
    <main className="min-h-screen px-6 py-8">
      <section className="mx-auto max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200">KIP Admin</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Enterprise workspace governance</h1>
        <p className="mt-4 max-w-3xl text-slate-400">
          Admin controls for workspace permissions, document ownership, integration requirements, and agent scope across the Kash Intelligence Platform.
        </p>
        <div className="mt-8 grid gap-5">
          {workspaces.map((workspace) => (
            <article key={workspace.key} className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">{workspace.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{workspace.mission}</p>
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <AdminCount label="Agents" value={workspace.agents.length} />
                  <AdminCount label="Docs" value={workspace.documents.length} />
                  <AdminCount label="Integrations" value={workspace.integrations.length} />
                  <AdminCount label="Groups" value={workspace.permissions.length} />
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <AdminList title="Permission groups" items={workspace.permissions.map((group) => `${group.name}: ${group.grants.join(", ")}`)} />
                <AdminList title="Document systems" items={workspace.documents.map((document) => `${document.title} / ${document.systemOfRecord}`)} />
                <AdminList title="Integration requirements" items={workspace.integrations.map((integration) => `${integration.displayName}: ${integration.requiredEnvironment.join(", ")}`)} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function AdminCount({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </div>
  );
}

function AdminList({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="font-semibold text-white">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
