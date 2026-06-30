import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  rows: new Map<unknown, unknown[]>(),
  inserts: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  send: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => Promise.resolve(h.rows.get(table) ?? []),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown> | Record<string, unknown>[]) => {
        const list = Array.isArray(vals) ? vals : [vals];
        h.inserts.push(...list);
        return {
          returning: () => Promise.resolve(list.map((row, index) => ({ id: index + 1, createdAt: new Date(), updatedAt: new Date(), queuedAt: new Date(), ...row }))),
        };
      },
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => {
        h.updates.push(vals);
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: 1, createdAt: new Date(), updatedAt: new Date(), queuedAt: new Date(), ...vals }]),
          }),
        };
      },
    }),
  };
  return {
    db,
    notificationEventsTable: makeTable("notificationEvents"),
    profilesTable: makeTable("profiles"),
  };
});

vi.mock("./resendClient", () => ({
  getUncachableResendClient: vi.fn(async () => ({
    fromEmail: "noreply@haulbrokr.com",
    client: { emails: { send: h.send } },
  })),
}));

import { deliverNotification, enqueueNotification } from "./notifications";
import { profilesTable } from "@workspace/db";

beforeEach(() => {
  h.rows.clear();
  h.inserts = [];
  h.updates = [];
  h.send.mockReset();
});

describe("notifications service", () => {
  it("enqueues one event per requested channel", async () => {
    const events = await enqueueNotification({
      profileId: 1,
      channels: ["email", "sms", "push", "realtime"],
      eventType: "compliance.document_approved",
      title: "Approved",
      body: "Your document was approved.",
    });

    expect(events).toHaveLength(4);
    expect(h.inserts.map((row) => row.channel)).toEqual(["email", "sms", "push", "realtime"]);
  });

  it("delivers email through Resend and marks provider id", async () => {
    h.rows.set(profilesTable, [{ id: 1, email: "driver@example.com" }]);
    h.send.mockResolvedValue({ data: { id: "email_1" } });

    await deliverNotification({
      id: 1,
      profileId: 1,
      channel: "email",
      eventType: "test",
      title: "Hello",
      body: "World",
      status: "pending",
      destination: null,
      providerMessageId: null,
      error: null,
      metadataJson: null,
      queuedAt: new Date(),
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(h.send).toHaveBeenCalledWith(expect.objectContaining({ to: "driver@example.com", subject: "Hello" }));
    expect(h.updates.at(-1)).toMatchObject({ status: "sent", providerMessageId: "email_1", destination: "driver@example.com" });
  });

  it("keeps unconfigured SMS/push/realtime as skipped durable events", async () => {
    await deliverNotification({
      id: 2,
      profileId: 1,
      channel: "sms",
      eventType: "test",
      title: "Hello",
      body: "World",
      status: "pending",
      destination: null,
      providerMessageId: null,
      error: null,
      metadataJson: null,
      queuedAt: new Date(),
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(h.updates.at(-1)).toMatchObject({ status: "skipped" });
  });
});
