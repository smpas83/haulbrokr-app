import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
}));

h.connect.mockImplementation(async () => ({
  query: h.query,
  release: h.release,
}));

vi.mock("@workspace/db", () => ({
  pool: { connect: h.connect },
}));

import { runStartupMigrations } from "./startupMigrations";

beforeEach(() => {
  h.query.mockReset();
  h.connect.mockClear();
  h.query.mockResolvedValue({ rows: [] });
});

describe("runStartupMigrations", () => {
  it("runs idempotent refund schema SQL in a transaction", async () => {
    await runStartupMigrations();

    expect(h.connect).toHaveBeenCalledOnce();
    expect(h.query).toHaveBeenCalledWith("BEGIN");
    expect(h.query).toHaveBeenCalledWith("COMMIT");
    expect(
      h.query.mock.calls.some(([sql]) =>
        String(sql).includes("payment_refunds"),
      ),
    ).toBe(true);
    expect(
      h.query.mock.calls.some(([sql]) =>
        String(sql).includes("refunded_amount"),
      ),
    ).toBe(true);
  });

  it("rolls back on failure", async () => {
    h.query.mockImplementation(async (sql: string) => {
      if (String(sql).includes("payment_refunds")) {
        throw new Error("boom");
      }
      return { rows: [] };
    });

    await expect(runStartupMigrations()).rejects.toThrow("boom");
    expect(h.query).toHaveBeenCalledWith("ROLLBACK");
  });
});
