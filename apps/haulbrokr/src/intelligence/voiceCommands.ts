import type { VoiceCommandRegistry } from "@workspace/platform";

export function registerHaulBrokrVoiceCommands(
  registry: VoiceCommandRegistry,
): void {
  registry.registerMany([
    {
      id: "haulbrokr.open-loads",
      phrases: ["open loads", "show loads", "load board"],
      description: "Show open haul loads on the marketplace board",
      handler: () => ({
        spoken: "Opening the load board.",
        action: "navigate:/(tabs)/map",
      }),
    },
    {
      id: "haulbrokr.active-jobs",
      phrases: ["active jobs", "my jobs", "current jobs"],
      description: "Show active jobs assigned to the user",
      handler: () => ({
        spoken: "Showing your active jobs.",
        action: "navigate:/(tabs)/jobs",
      }),
    },
    {
      id: "haulbrokr.fleet-status",
      phrases: ["fleet status", "my fleet", "truck status"],
      description: "Show fleet availability and truck status",
      handler: () => ({
        spoken: "Opening fleet management.",
        action: "navigate:/fleet",
      }),
    },
    {
      id: "haulbrokr.dispatch",
      phrases: ["dispatch", "assign driver", "dispatch today"],
      description: "Open dispatch view for providers",
      handler: () => ({
        spoken: "Opening dispatch.",
        action: "navigate:/foreman",
      }),
    },
    {
      id: "haulbrokr.check-in",
      phrases: ["check in", "check-in", "arrive on site"],
      description: "Instructions for driver field check-in",
      handler: () => ({
        spoken:
          "Open your active job, then use Driver Field Ops to check in with GPS and upload your scale ticket.",
        action: "help:driver-check-in",
      }),
    },
  ]);
}
