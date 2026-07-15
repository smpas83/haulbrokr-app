import { describe, it, expect } from "vitest";
import {
  classifyFunnelStage,
  matchesFunnelFilter,
  completionPercent,
  buildTimeline,
} from "./onboardingFunnel";

describe("classifyFunnelStage", () => {
  const base = {
    profileComplete: false,
    truckAdded: false,
    hasAnyDocumentOrForm: false,
    hasPendingReview: false,
    isApproved: false,
    canBid: false,
    lastActivityIso: new Date().toISOString(),
    nowMs: Date.now(),
  };

  it("classifies new registration", () => {
    expect(classifyFunnelStage(base)).toBe("new_registration");
  });

  it("classifies setup started", () => {
    expect(classifyFunnelStage({ ...base, profileComplete: true })).toBe("setup_started");
  });

  it("classifies waiting documents", () => {
    expect(classifyFunnelStage({
      ...base,
      profileComplete: true,
      truckAdded: true,
      hasAnyDocumentOrForm: true,
    })).toBe("waiting_documents");
  });

  it("classifies waiting approval", () => {
    expect(classifyFunnelStage({
      ...base,
      profileComplete: true,
      hasAnyDocumentOrForm: true,
      hasPendingReview: true,
    })).toBe("waiting_approval");
  });

  it("classifies approved", () => {
    expect(classifyFunnelStage({ ...base, canBid: true, isApproved: true })).toBe("approved");
  });

  it("classifies stalled after 24h without approval", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(classifyFunnelStage({
      ...base,
      profileComplete: true,
      lastActivityIso: old,
    })).toBe("stalled");
  });
});

describe("matchesFunnelFilter", () => {
  it("filters pending review", () => {
    expect(matchesFunnelFilter("waiting_approval", "pending_review", {
      isApproved: false,
      profileComplete: true,
      truckAdded: true,
      hasDocs: true,
    })).toBe(true);
  });

  it("filters registered only", () => {
    expect(matchesFunnelFilter("new_registration", "registered_only", {
      isApproved: false,
      profileComplete: false,
      truckAdded: false,
      hasDocs: false,
    })).toBe(true);
  });
});

describe("completionPercent", () => {
  it("rounds percent", () => {
    expect(completionPercent(3, 6)).toBe(50);
    expect(completionPercent(0, 6)).toBe(0);
    expect(completionPercent(1, 0)).toBe(0);
  });
});

describe("buildTimeline", () => {
  it("defaults status from timestamp", () => {
    const events = buildTimeline([
      { type: "signup", label: "Signup", at: "2026-01-01T00:00:00.000Z" },
      { type: "equipment_added", label: "Equipment", at: null },
    ]);
    expect(events[0].status).toBe("complete");
    expect(events[1].status).toBe("missing");
  });
});
