import { describe, expect, it } from "vitest";

import { getLiveActivityToastCopy } from "@/hooks/use-realtime-feedback";

describe("live activity toast copy", () => {
  it("maps dispatch and driver acceptance events to Sprint 16 notification labels", () => {
    expect(getLiveActivityToastCopy("request_posted")?.title).toBe("New dispatch");
    expect(getLiveActivityToastCopy("bid_accepted")?.title).toBe("Driver accepted");
    expect(getLiveActivityToastCopy("job_started")?.title).toBe("Driver arrived");
  });

  it("maps completion and payment events", () => {
    expect(getLiveActivityToastCopy("job_completed")?.title).toBe("Job completed");
    expect(getLiveActivityToastCopy("payment_requires_action")?.title).toBe("Payment needs attention");
  });

  it("ignores unknown event types", () => {
    expect(getLiveActivityToastCopy("unknown_event")).toBeNull();
  });
});
