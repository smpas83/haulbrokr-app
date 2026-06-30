import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserts: [] as Record<string, unknown>[],
  profile: { id: 7, email: "ops@example.com", phone: "+12055550100" } as any,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const notificationsTable = makeTable("notifications");
  const notificationDeliveriesTable = makeTable("notification_deliveries");
  const profilesTable = makeTable("profiles");

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === profilesTable) return Promise.resolve([h.profile]);
          return Promise.resolve([]);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        h.inserts.push({ __table: table, ...vals });
        return {
          returning: () => Promise.resolve([{ id: 100 + h.inserts.length, ...vals }]),
        };
      },
    }),
  };

  return { db, notificationsTable, notificationDeliveriesTable, profilesTable };
});

vi.mock("./resendClient", () => ({
  getUncachableResendClient: vi.fn(async () => ({
    fromEmail: "noreply@example.com",
    client: { emails: { send: vi.fn(async () => ({ id: "email_1" })) } },
  })),
}));

import { dispatchNotification } from "./notifications";

beforeEach(() => {
  h.inserts = [];
  process.env.SMS_WEBHOOK_URL = "https://sms.example.test/send";
  process.env.PUSH_WEBHOOK_URL = "https://push.example.test/send";
  process.env.REALTIME_WEBHOOK_URL = "https://realtime.example.test/fanout";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 202, headers: { "x-message-id": "msg_1" } })),
  );
});

describe("dispatchNotification", () => {
  it("creates in-app, email, SMS, push, and realtime delivery audit rows", async () => {
    await dispatchNotification({
      recipientProfileId: 7,
      type: "generic",
      title: "Compliance update",
      body: "Your document status changed.",
      channels: ["in_app", "email", "sms", "push", "realtime"],
    });

    const channels = h.inserts
      .filter((row) => row.channel)
      .map((row) => row.channel);
    expect(channels).toEqual(["in_app", "email", "sms", "push", "realtime"]);
    expect(h.inserts.filter((row) => row.status === "sent")).toHaveLength(5);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });
});
