import { describe, expect, it } from "vitest";

import { trackingProgressFromTimeline } from "@/lib/trackingProgress";
import type { JobStatusUpdate } from "@/hooks/useLiveApi";

function update(status: JobStatusUpdate["status"], createdAt: string): JobStatusUpdate {
  return {
    id: Math.floor(Date.parse(createdAt) / 1000),
    jobId: 7,
    actorProfileId: 42,
    status,
    createdAt,
  };
}

describe("trackingProgressFromTimeline", () => {
  it("uses the newest backend timeline update for live tracking progress", () => {
    const state = trackingProgressFromTimeline("in_progress", [
      update("arrived", "2026-06-30T10:00:00.000Z"),
      update("loaded", "2026-06-30T10:30:00.000Z"),
      update("loading", "2026-06-30T10:15:00.000Z"),
    ]);

    expect(state).toEqual({ progressPct: 66, etaMinutes: 16, label: "Loaded" });
  });

  it("falls back to the live job status before drivers report timeline updates", () => {
    expect(trackingProgressFromTimeline("accepted", [])).toEqual({
      progressPct: 10,
      etaMinutes: 40,
      label: "Accepted",
    });
  });
});
