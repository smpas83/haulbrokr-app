export interface VoiceCommandContext {
  role?: string;
  profileId?: number;
}

export interface VoiceCommandResult {
  spoken: string;
  action?: string;
}

export interface VoiceCommand {
  id: string;
  phrases: string[];
  description: string;
  handler: (
    ctx: VoiceCommandContext,
  ) => VoiceCommandResult | Promise<VoiceCommandResult>;
}

export class VoiceCommandRegistry {
  private commands: VoiceCommand[] = [];

  register(command: VoiceCommand): void {
    if (this.commands.some((c) => c.id === command.id)) {
      throw new Error(`Voice command "${command.id}" is already registered.`);
    }
    this.commands.push(command);
  }

  registerMany(commands: VoiceCommand[]): void {
    for (const command of commands) {
      this.register(command);
    }
  }

  list(): readonly VoiceCommand[] {
    return this.commands;
  }

  clear(): void {
    this.commands = [];
  }

  /** Match an utterance to the first command whose phrase appears in the text. */
  match(utterance: string): VoiceCommand | null {
    const normalized = utterance.trim().toLowerCase();
    if (!normalized) return null;

    for (const command of this.commands) {
      for (const phrase of command.phrases) {
        if (normalized.includes(phrase.toLowerCase())) {
          return command;
        }
      }
    }
    return null;
  }

  async execute(
    utterance: string,
    ctx: VoiceCommandContext = {},
  ): Promise<VoiceCommandResult | null> {
    const command = this.match(utterance);
    if (!command) return null;
    return command.handler(ctx);
  }
}

export const voiceCommandRegistry = new VoiceCommandRegistry();

export function registerAdapterVoiceCommands(
  register?: (registry: VoiceCommandRegistry) => void,
): void {
  register?.(voiceCommandRegistry);
}
