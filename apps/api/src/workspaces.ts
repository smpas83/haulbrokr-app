import { gwfgWorkspace } from "@kip/company-gwfg";
import { haulbrokrWorkspace } from "@kip/company-haulbrokr";
import { merchnowWorkspace } from "@kip/company-merchnow";
import { personalWorkspace } from "@kip/company-personal";
import { stratusWorkspace } from "@kip/company-stratus";
import type { WorkspaceKey } from "@kip/agents";
import type { CompanyWorkspace } from "@kip/workflows";

export const workspaces = [
  haulbrokrWorkspace,
  merchnowWorkspace,
  gwfgWorkspace,
  stratusWorkspace,
  personalWorkspace
] as const satisfies readonly CompanyWorkspace[];

export function getWorkspace(key: WorkspaceKey): CompanyWorkspace {
  const workspace = workspaces.find((candidate) => candidate.key === key);

  if (!workspace) {
    throw new Error(`Unknown workspace key: ${key}`);
  }

  return workspace;
}
