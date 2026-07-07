import { describe, expect, it, vi } from "vitest";
import { VoiceCommandRegistry } from "@workspace/platform";
import { registerHaulBrokrVoiceCommands } from "../src/intelligence/voiceCommands";
import {
  answerHaulBrokrIntelligenceQuery,
  HAULBROKR_COPILOT_SUGGESTIONS,
} from "../src/intelligence/copilotLogic";

vi.mock("@workspace/db", () => ({
  db: {},
  jobsTable: {},
  requestsTable: {},
  trucksTable: {},
  activityTable: {},
}));

describe("HaulBrokr intelligence", () => {
  it("exposes role-based copilot suggestions", () => {
    expect(HAULBROKR_COPILOT_SUGGESTIONS.provider).toContain(
      "Show me nearby open loads",
    );
  });

  it("registers haulbrokr voice commands", async () => {
    const registry = new VoiceCommandRegistry();
    registerHaulBrokrVoiceCommands(registry);
    const match = await registry.execute("show open loads");
    expect(match?.action).toContain("map");
  });

  it("answers intelligence queries with haulbrokr copy", () => {
    const reply = answerHaulBrokrIntelligenceQuery(
      "show fleet",
      { id: 1, role: "provider", companyName: "Demo" },
      {
        openRequests: [],
        activeJobs: [],
        recentActivity: [],
        trucksAvailable: 3,
      },
    );
    expect(reply).toContain("3 truck");
  });
});

describe("HaulBrokrAdapter", () => {
  it("uses haulbrokr app id", async () => {
    const { haulBrokrAdapter } = await import("../src/HaulBrokrAdapter");
    expect(haulBrokrAdapter.id).toBe("haulbrokr");
    expect(haulBrokrAdapter.getCopilotSuggestions("provider")).toContain(
      "Show me nearby open loads",
    );
  });
});
