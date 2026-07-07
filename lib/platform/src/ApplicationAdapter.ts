import type { VoiceCommandRegistry } from "./voice-commands";

export interface IntelligenceProfile {
  id: number;
  role: string;
  companyName: string;
}

export interface IntelligenceSummary {
  openLoads: number;
  activeJobs: number;
  trucksAvailable: number;
}

export interface IntelligenceContext {
  openRequests: Array<{ id: number; status: string; materialType: string }>;
  activeJobs: Array<{ id: number; status: string; materialType: string }>;
  recentActivity: Array<{ description: string; type: string; createdAt: Date }>;
  trucksAvailable: number;
}

/**
 * Workspace adapter contract. Each deployed application (HaulBrokr, future apps)
 * implements this interface so core platform code stays app-agnostic.
 */
export interface ApplicationAdapter {
  readonly id: string;
  readonly displayName: string;

  getCopilotSuggestions(role: string): string[];

  buildIntelligenceContext(
    profile: IntelligenceProfile,
  ): Promise<IntelligenceContext>;

  summarizeContext(ctx: IntelligenceContext): IntelligenceSummary;

  answerIntelligenceQuery(
    message: string,
    profile: IntelligenceProfile,
    ctx: IntelligenceContext,
  ): string;

  /** Optional hook for app-specific voice command registration. */
  registerVoiceCommands?(registry: VoiceCommandRegistry): void;
}
