import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  prefs: null as any,
  profile: {
    id: 1,
    email: "a@b.com",
    phone: "+15551212",
    companyName: "Acme",
  } as any,
  inserts: [] as any[],
  pushCalls: [] as any[],
  smsCalls: [] as any[],
  emailCalls: [] as any[],
}));

vi.mock("@workspace/db", () => {
  const notificationPreferencesTable = { _: "prefs" };
  const profilesTable = { _: "profiles" };
  const activityTable = { _: "activity" };
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === notificationPreferencesTable) {
            return Promise.resolve(h.prefs ? [h.prefs] : []);
          }
          if (table === profilesTable) {
            return Promise.resolve([h.profile]);
          }
          return Promise.resolve([]);
        },
      }),
    }),
    insert: () => ({
      values: (vals: any) => {
        h.inserts.push(vals);
        if (
          (vals as any).profileId != null &&
          (vals as any).pushEnabled != null
        ) {
          h.prefs = { id: 1, ...vals };
          return { returning: async () => [h.prefs] };
        }
        return Promise.resolve(undefined);
      },
    }),
    update: () => ({
      set: (vals: any) => ({
        where: () => {
          h.prefs = { ...h.prefs, ...vals };
          return { returning: async () => [h.prefs] };
        },
      }),
    }),
  };
  return { db, notificationPreferencesTable, profilesTable, activityTable };
});

vi.mock("./pushNotifications", () => ({
  activityPushTitle: (type: string) => `Title:${type}`,
  sendExpoPushToProfile: vi.fn(async (...args: any[]) => {
    h.pushCalls.push(args);
  }),
}));

vi.mock("./resendClient", () => ({
  getUncachableResendClient: vi.fn(async () => ({
    fromEmail: "noreply@haulbrokr.com",
    client: {
      emails: {
        send: vi.fn(async (payload: any) => {
          h.emailCalls.push(payload);
        }),
      },
    },
  })),
}));

vi.mock("./smsClient", () => ({
  sendSms: vi.fn(async (to: string, body: string) => {
    h.smsCalls.push({ to, body });
    return { ok: true, sid: "SM123" };
  }),
  isSmsConfigured: () => true,
}));

import {
  notifyUser,
  getNotificationPreferences,
  upsertNotificationPreferences,
  topicAllowed,
  DEFAULT_NOTIFICATION_PREFS,
} from "./notificationPlatform";

beforeEach(() => {
  h.prefs = null;
  h.inserts = [];
  h.pushCalls = [];
  h.smsCalls = [];
  h.emailCalls = [];
});

describe("notificationPlatform", () => {
  it("returns defaults when no prefs row exists", async () => {
    const prefs = await getNotificationPreferences(1);
    expect(prefs.pushEnabled).toBe(true);
    expect(prefs.smsEnabled).toBe(false);
  });

  it("upserts preferences", async () => {
    const created = await upsertNotificationPreferences(1, {
      smsEnabled: true,
      reminders: false,
    });
    expect(created.smsEnabled).toBe(true);
    expect(created.reminders).toBe(false);

    const updated = await upsertNotificationPreferences(1, {
      emailEnabled: false,
    });
    expect(updated.emailEnabled).toBe(false);
  });

  it("gates topics by preference flags", () => {
    expect(topicAllowed(DEFAULT_NOTIFICATION_PREFS, "job")).toBe(true);
    expect(
      topicAllowed(
        { ...DEFAULT_NOTIFICATION_PREFS, marketing: false },
        "marketing",
      ),
    ).toBe(false);
  });

  it("records activity and fans out to enabled channels", async () => {
    h.prefs = {
      profileId: 1,
      ...DEFAULT_NOTIFICATION_PREFS,
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: true,
      smsPhone: "+19998887777",
    };

    await notifyUser({
      profileId: 1,
      type: "job_reminder",
      topic: "reminder",
      title: "Reminder",
      description: "Haul tomorrow",
      relatedId: 9,
    });

    expect(h.inserts.some((i) => i.type === "job_reminder")).toBe(true);
    expect(h.pushCalls).toHaveLength(1);
    expect(h.emailCalls).toHaveLength(1);
    expect(h.smsCalls).toEqual([
      { to: "+19998887777", body: expect.stringContaining("Reminder") },
    ]);
  });

  it("skips channels when topic is disabled", async () => {
    h.prefs = {
      profileId: 1,
      ...DEFAULT_NOTIFICATION_PREFS,
      reminders: false,
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: true,
    };

    await notifyUser({
      profileId: 1,
      type: "job_reminder",
      topic: "reminder",
      description: "Should not fan out",
    });

    expect(h.inserts.some((i) => i.type === "job_reminder")).toBe(true);
    expect(h.pushCalls).toHaveLength(0);
    expect(h.emailCalls).toHaveLength(0);
    expect(h.smsCalls).toHaveLength(0);
  });
});
