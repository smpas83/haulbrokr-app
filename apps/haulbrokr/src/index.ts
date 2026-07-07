import {
  registerAdapterVoiceCommands,
  setActiveApplicationAdapter,
  voiceCommandRegistry,
} from "@workspace/platform";

import { haulBrokrAdapter } from "./HaulBrokrAdapter";

export { HaulBrokrAdapter, haulBrokrAdapter } from "./HaulBrokrAdapter";
export * from "./intelligence";
export * from "./features";
export * from "./components";

/** Bootstrap HaulBrokr as the active workspace application. */
export function bootstrapHaulBrokrWorkspace(): void {
  setActiveApplicationAdapter(haulBrokrAdapter);
  voiceCommandRegistry.clear();
  registerAdapterVoiceCommands(
    haulBrokrAdapter.registerVoiceCommands?.bind(haulBrokrAdapter),
  );
}
