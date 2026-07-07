import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  tokens: [] as Array<{ expoPushToken: string }>,
  fetch: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve(h.tokens),
        }),
      }),
    },
    deviceTokensTable: makeTable("deviceTokens"),
  };
});

global.fetch = h.fetch as unknown as typeof fetch;

import { sendExpoPushToProfile, activityPushTitle } from "./pushNotifications";

beforeEach(() => {
  h.tokens = [];
  h.fetch.mockReset();
  h.fetch.mockResolvedValue({ ok: true, text: async () => "" });
});

describe("pushNotifications", () => {
  it("maps activity types to push titles", () => {
    expect(activityPushTitle("payment_failed")).toBe("Payment failed");
    expect(activityPushTitle("unknown_type")).toBe("HaulBrokr update");
  });

  it("sends Expo push when device tokens exist", async () => {
    h.tokens = [{ expoPushToken: "ExponentPushToken[abc]" }];
    await sendExpoPushToProfile(1, "Test", "Body", { relatedId: 10 });
    expect(h.fetch).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("skips fetch when no tokens registered", async () => {
    await sendExpoPushToProfile(1, "Test", "Body");
    expect(h.fetch).not.toHaveBeenCalled();
  });
});
