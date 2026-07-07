import type { IntelligenceProfile } from "./ApplicationAdapter";
import { getActiveApplicationAdapter } from "./workspace";

export interface CopilotInsightsResponse {
  suggestions: string[];
  summary: {
    openLoads: number;
    activeJobs: number;
    trucksAvailable: number;
  };
  recentActivity: Array<{ description: string; type: string; createdAt: Date }>;
}

export interface CopilotChatResponse {
  role: "assistant";
  content: string;
  timestamp: string;
}

/**
 * Platform intelligence entry point. Routes all copilot / AI queries through
 * the active ApplicationAdapter so core code never hardcodes app logic.
 */
export class IntelligenceRouter {
  static async getInsights(
    profile: IntelligenceProfile,
  ): Promise<CopilotInsightsResponse> {
    const adapter = getActiveApplicationAdapter();
    const ctx = await adapter.buildIntelligenceContext(profile);
    const role =
      profile.role === "driver"
        ? "driver"
        : profile.role === "provider"
          ? "provider"
          : "customer";

    return {
      suggestions: adapter.getCopilotSuggestions(role),
      summary: adapter.summarizeContext(ctx),
      recentActivity: ctx.recentActivity,
    };
  }

  static async chat(
    message: string,
    profile: IntelligenceProfile,
  ): Promise<CopilotChatResponse> {
    const adapter = getActiveApplicationAdapter();
    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error("message is required");
    }

    const ctx = await adapter.buildIntelligenceContext(profile);
    const content = adapter.answerIntelligenceQuery(trimmed, profile, ctx);

    return {
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
    };
  }
}
