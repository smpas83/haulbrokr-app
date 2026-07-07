export type {
  ApplicationAdapter,
  IntelligenceContext,
  IntelligenceProfile,
  IntelligenceSummary,
} from "./ApplicationAdapter";
export { IntelligenceRouter } from "./IntelligenceRouter";
export type {
  CopilotChatResponse,
  CopilotInsightsResponse,
} from "./IntelligenceRouter";
export {
  VoiceCommandRegistry,
  registerAdapterVoiceCommands,
  voiceCommandRegistry,
} from "./voice-commands";
export type {
  VoiceCommand,
  VoiceCommandContext,
  VoiceCommandResult,
} from "./voice-commands";
export {
  getActiveApplicationAdapter,
  setActiveApplicationAdapter,
  tryGetActiveApplicationAdapter,
} from "./workspace";
