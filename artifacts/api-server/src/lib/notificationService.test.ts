import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserts: [] as { table: unknown; values: Record<string, unknown> }[],
  profiles: [] as Record<string, unknown>[],
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_target, prop) => `${name}.${String(prop)}` });
  const activityTable = makeTable("activity");
  const notificationDeliveriesTable = makeTable("notificationDeliveries");
  const profilesTable = makeTable("profiles");
  const db = {
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        h.inserts.push({ table, values });
        return Promise.resolve(undefined);
      },
    }),
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(h.profiles),
      }),
    }),
  };
  return { db, activityTable, notificationDeliveriesTable, profilesTable };
});

vi.mock("./resendClient", () => ({
  getUncachableResendClient: vi.fn(async () => ({
    fromEmail: "ops@haulbrokr.test",
    client: { emails: { send: vi.fn(async () => ({ data: { id: "email_1" }, error: null })) } },
  })),
}));

import { activityTable, notificationDeliveriesTable } from "@workspace/db";
import { sendNotification } from "./notificationService";

beforeEach(() => {
  h.inserts = [];
  h.profiles = [{ email: "customer@example.test" }];
});

describe("sendNotification", () => {
  it("records in-app activity and a sent delivery row", async () => {
    await sendNotification({
      eventType: "job_assigned",
      recipientProfileId: 10,
      jobId: 99,
      subject: "Job assigned",
      body: "You were assigned job #99.",
    });

    expect(h.inserts.find((entry) => entry.table === activityTable)?.values).toMatchObject({
      profileId: 10,
      type: "bid_awarded",
      description: "You were assigned job #99.",
      relatedId: 99,
    });
    expect(h.inserts.find((entry) => entry.table === notificationDeliveriesTable)?.values).toMatchObject({
      eventType: "job_assigned",
      channel: "in_app",
      status: "sent",
      recipientProfileId: 10,
      jobId: 99,
    });
  });

  it("records skipped delivery rows for unconfigured SMS and push providers", async () => {
    await sendNotification({
      eventType: "driver_arrived",
      recipientProfileId: 10,
      jobId: 99,
      body: "Driver arrived.",
      channels: ["sms", "push"],
    });

    const deliveryRows = h.inserts
      .filter((entry) => entry.table === notificationDeliveriesTable)
      .map((entry) => entry.values);
    expect(deliveryRows).toEqual([
      expect.objectContaining({ channel: "sms", status: "skipped" }),
      expect.objectContaining({ channel: "push", status: "skipped" }),
    ]);
  });
});
