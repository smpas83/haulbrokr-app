import type { WorkspaceKey } from "@kip/agents";

export type VoiceMode = "push-to-talk" | "wake-word" | "hands-free";

export type VoiceConversationTurn = {
  readonly id: string;
  readonly workspace: WorkspaceKey;
  readonly speaker: "user" | "assistant" | "agent";
  readonly transcript: string;
  readonly agentId?: string;
  readonly createdAt: string;
};

export type VoiceAssistantConfig = {
  readonly recognition: {
    readonly provider: "openai";
    readonly model: "gpt-4o-transcribe";
    readonly interimResults: true;
  };
  readonly streaming: {
    readonly transport: "server-sent-events";
    readonly chunkTargetMs: 120;
  };
  readonly synthesis: {
    readonly provider: "openai";
    readonly voice: "alloy";
    readonly format: "pcm16";
  };
  readonly waveform: {
    readonly bars: number;
    readonly smoothing: number;
    readonly sensitivity: number;
  };
};

export type CompanyAwareCommand = {
  readonly workspace: WorkspaceKey;
  readonly intent: "search-memory" | "create-task" | "summarize-priorities" | "route-approval" | "open-dashboard";
  readonly utterance: string;
  readonly confidence: number;
};

export const defaultVoiceAssistantConfig = {
  recognition: {
    provider: "openai",
    model: "gpt-4o-transcribe",
    interimResults: true
  },
  streaming: {
    transport: "server-sent-events",
    chunkTargetMs: 120
  },
  synthesis: {
    provider: "openai",
    voice: "alloy",
    format: "pcm16"
  },
  waveform: {
    bars: 36,
    smoothing: 0.82,
    sensitivity: 0.74
  }
} as const satisfies VoiceAssistantConfig;

const workspaceAliases = {
  haulbrokr: ["haulbrokr", "haul broker", "dump trucks", "dispatch"],
  merchnow: ["merchnow", "merch now", "retail", "merchandiser"],
  gwfg: ["golden west", "gwfg", "food group", "production"],
  stratus: ["stratus", "stratus group", "projects"],
  personal: ["personal", "my day", "personal workspace"]
} as const satisfies Record<WorkspaceKey, readonly string[]>;

export function detectWorkspaceFromUtterance(utterance: string, fallback: WorkspaceKey): WorkspaceKey {
  const normalized = utterance.toLowerCase();
  const match = Object.entries(workspaceAliases).find(([_workspace, aliases]) =>
    aliases.some((alias) => normalized.includes(alias))
  );

  return match ? (match[0] as WorkspaceKey) : fallback;
}

export function classifyVoiceCommand(utterance: string, fallbackWorkspace: WorkspaceKey): CompanyAwareCommand {
  const normalized = utterance.toLowerCase();
  const workspace = detectWorkspaceFromUtterance(utterance, fallbackWorkspace);

  if (normalized.includes("memory") || normalized.includes("remember")) {
    return { workspace, intent: "search-memory", utterance, confidence: 0.86 };
  }

  if (normalized.includes("task") || normalized.includes("assign")) {
    return { workspace, intent: "create-task", utterance, confidence: 0.83 };
  }

  if (normalized.includes("approval") || normalized.includes("approve")) {
    return { workspace, intent: "route-approval", utterance, confidence: 0.82 };
  }

  if (normalized.includes("dashboard") || normalized.includes("open")) {
    return { workspace, intent: "open-dashboard", utterance, confidence: 0.8 };
  }

  return { workspace, intent: "summarize-priorities", utterance, confidence: 0.78 };
}
