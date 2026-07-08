import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const OWNER_PROFILE_ID = 99;
const ORG_ID = 5;

const h = vi.hoisted(() => ({
  profile: null as any,
  org: null as any,
  snapshot: null as any,
  snapshotProfileId: null as number | null,
}));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.clerkId = "test-clerk";
    next();
  },
}));

vi.mock("@workspace/db", () => {
  const profilesTable = { _: "profiles" };
  const organizationsTable = { _: "organizations" };
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === organizationsTable) {
            return Promise.resolve(h.org ? [h.org] : []);
          }
          return Promise.resolve(h.profile ? [h.profile] : []);
        },
      }),
    }),
  };
  return { db, profilesTable, organizationsTable };
});

vi.mock("../lib/adminComplianceBundle", () => ({
  getCarrierComplianceSnapshot: async (profileId: number) => {
    h.snapshotProfileId = profileId;
    if (profileId !== OWNER_PROFILE_ID) return null;
    return h.snapshot;
  },
}));

import organizationsRouter from "./organizations";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(organizationsRouter);
  return app;
}

beforeEach(() => {
  h.snapshotProfileId = null;
  h.org = {
    id: ORG_ID,
    type: "provider",
    ownerProfileId: OWNER_PROFILE_ID,
    name: "Acme Hauling",
  };
  h.snapshot = {
    w9Status: "verified",
    insuranceStatus: "pending",
    dotCdlStatus: "verified",
    payoutStatus: "pending",
    canBid: false,
    w9ReviewNote: null,
    insuranceReviewNote: null,
    dotCdlReviewNote: null,
  };
});

describe("GET /organizations/compliance-status", () => {
  it("returns carrier compliance snapshot for the provider owner", async () => {
    h.profile = {
      id: OWNER_PROFILE_ID,
      role: "provider",
      organizationId: ORG_ID,
      clerkId: "test-clerk",
    };

    const res = await request(makeApp()).get(
      "/organizations/compliance-status",
    );
    expect(res.status).toBe(200);
    expect(h.snapshotProfileId).toBe(OWNER_PROFILE_ID);
    expect(res.body).toMatchObject({
      w9Status: "verified",
      insuranceStatus: "pending",
      dotCdlStatus: "verified",
      canBid: false,
    });
  });

  it("returns the same carrier snapshot for an org driver member", async () => {
    h.profile = {
      id: 7,
      role: "driver",
      organizationId: ORG_ID,
      clerkId: "test-clerk",
    };

    const res = await request(makeApp()).get(
      "/organizations/compliance-status",
    );
    expect(res.status).toBe(200);
    expect(h.snapshotProfileId).toBe(OWNER_PROFILE_ID);
    expect(res.body.insuranceStatus).toBe("pending");
  });

  it("returns 404 when user has no organization", async () => {
    h.profile = {
      id: 7,
      role: "driver",
      organizationId: null,
      clerkId: "test-clerk",
    };
    const res = await request(makeApp()).get(
      "/organizations/compliance-status",
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for a customer organization", async () => {
    h.profile = {
      id: 12,
      role: "supervisor",
      organizationId: ORG_ID,
      clerkId: "test-clerk",
    };
    h.org = {
      id: ORG_ID,
      type: "customer",
      ownerProfileId: 50,
      name: "Builders Inc",
    };

    const res = await request(makeApp()).get(
      "/organizations/compliance-status",
    );
    expect(res.status).toBe(404);
    expect(h.snapshotProfileId).toBeNull();
  });

  it("returns 404 when the provider org has no owner profile", async () => {
    h.profile = {
      id: 7,
      role: "driver",
      organizationId: ORG_ID,
      clerkId: "test-clerk",
    };
    h.org = {
      id: ORG_ID,
      type: "provider",
      ownerProfileId: null,
      name: "Acme Hauling",
    };

    const res = await request(makeApp()).get(
      "/organizations/compliance-status",
    );
    expect(res.status).toBe(404);
  });
});
