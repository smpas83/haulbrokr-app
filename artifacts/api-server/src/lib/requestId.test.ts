import { describe, expect, it } from "vitest";
import { createRequestId, requestIdFromHeaders } from "./requestId";

describe("requestId", () => {
  it("accepts a safe inbound x-request-id", () => {
    expect(requestIdFromHeaders({ "x-request-id": "beta-run_123" })).toBe("beta-run_123");
  });

  it("falls back to x-correlation-id when x-request-id is absent", () => {
    expect(requestIdFromHeaders({ "x-correlation-id": "trace-abc" })).toBe("trace-abc");
  });

  it("rejects unsafe or oversized inbound IDs", () => {
    expect(requestIdFromHeaders({ "x-request-id": "bad value with spaces" })).toBeUndefined();
    expect(requestIdFromHeaders({ "x-request-id": "x".repeat(129) })).toBeUndefined();
  });

  it("creates a UUID when no safe inbound ID exists", () => {
    expect(createRequestId({ "x-request-id": "bad value" })).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
