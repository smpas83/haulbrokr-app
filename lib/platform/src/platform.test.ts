import { describe, expect, it, beforeEach } from "vitest";
import {
  IntelligenceRouter,
  VoiceCommandRegistry,
  setActiveApplicationAdapter,
} from "../src/index";
import type {
  ApplicationAdapter,
  IntelligenceContext,
  IntelligenceProfile,
} from "../src/ApplicationAdapter";

const stubContext: IntelligenceContext = {
  openRequests: [{ id: 1, status: "open", materialType: "dirt" }],
  activeJobs: [],
  recentActivity: [],
  trucksAvailable: 2,
};

const stubAdapter: ApplicationAdapter = {
  id: "test-app",
  displayName: "Test App",
  getCopilotSuggestions: () => ["hello"],
  buildIntelligenceContext: async () => stubContext,
  summarizeContext: (ctx) => ({
    openLoads: ctx.openRequests.length,
    activeJobs: ctx.activeJobs.length,
    trucksAvailable: ctx.trucksAvailable,
  }),
  answerIntelligenceQuery: () => "stub reply",
  registerVoiceCommands(registry) {
    registry.register({
      id: "test.hello",
      phrases: ["hello test"],
      description: "test",
      handler: () => ({ spoken: "hi" }),
    });
  },
};

describe("IntelligenceRouter", () => {
  beforeEach(() => {
    setActiveApplicationAdapter(stubAdapter);
  });

  it("routes insights through active adapter", async () => {
    const profile: IntelligenceProfile = {
      id: 1,
      role: "customer",
      companyName: "Acme",
    };
    const insights = await IntelligenceRouter.getInsights(profile);
    expect(insights.suggestions).toEqual(["hello"]);
    expect(insights.summary.openLoads).toBe(1);
  });

  it("routes chat through active adapter", async () => {
    const profile: IntelligenceProfile = {
      id: 1,
      role: "customer",
      companyName: "Acme",
    };
    const reply = await IntelligenceRouter.chat("hello", profile);
    expect(reply.content).toBe("stub reply");
  });
});

describe("VoiceCommandRegistry", () => {
  it("matches and executes registered commands", async () => {
    const registry = new VoiceCommandRegistry();
    stubAdapter.registerVoiceCommands?.(registry);
    const result = await registry.execute("please hello test now");
    expect(result?.spoken).toBe("hi");
  });
});
