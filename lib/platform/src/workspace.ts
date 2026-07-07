import type { ApplicationAdapter } from "./ApplicationAdapter";

let activeAdapter: ApplicationAdapter | null = null;

export function setActiveApplicationAdapter(adapter: ApplicationAdapter): void {
  activeAdapter = adapter;
}

export function getActiveApplicationAdapter(): ApplicationAdapter {
  if (!activeAdapter) {
    throw new Error(
      "No ApplicationAdapter registered. Call setActiveApplicationAdapter() at workspace bootstrap.",
    );
  }
  return activeAdapter;
}

export function tryGetActiveApplicationAdapter(): ApplicationAdapter | null {
  return activeAdapter;
}
