import type {
  ApplicationAdapter,
  IntelligenceContext,
  IntelligenceProfile,
  IntelligenceSummary,
  VoiceCommandRegistry,
} from "@workspace/platform";
import {
  HAULBROKR_COPILOT_SUGGESTIONS,
  answerHaulBrokrIntelligenceQuery,
  buildHaulBrokrIntelligenceContext,
} from "./intelligence/copilotLogic";
import { registerHaulBrokrVoiceCommands } from "./intelligence/voiceCommands";

export class HaulBrokrAdapter implements ApplicationAdapter {
  readonly id = "haulbrokr";
  readonly displayName = "HaulBrokr";

  getCopilotSuggestions(role: string): string[] {
    return (
      HAULBROKR_COPILOT_SUGGESTIONS[role] ??
      HAULBROKR_COPILOT_SUGGESTIONS.customer
    );
  }

  buildIntelligenceContext(
    profile: IntelligenceProfile,
  ): Promise<IntelligenceContext> {
    return buildHaulBrokrIntelligenceContext(profile);
  }

  summarizeContext(ctx: IntelligenceContext): IntelligenceSummary {
    return {
      openLoads: ctx.openRequests.length,
      activeJobs: ctx.activeJobs.length,
      trucksAvailable: ctx.trucksAvailable,
    };
  }

  answerIntelligenceQuery(
    message: string,
    profile: IntelligenceProfile,
    ctx: IntelligenceContext,
  ): string {
    return answerHaulBrokrIntelligenceQuery(message, profile, ctx);
  }

  registerVoiceCommands(registry: VoiceCommandRegistry): void {
    registerHaulBrokrVoiceCommands(registry);
  }
}

export const haulBrokrAdapter = new HaulBrokrAdapter();
