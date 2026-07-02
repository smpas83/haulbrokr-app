import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 1, role: "customer", companyName: "Test Co", staffRole: null } as Record<string, unknown>,
  sites: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
  nextSiteId: 1,
}));

vi.mock("@workspace/db", () => {
  const dumpSitesTable = new Proxy({}, { get: (_t, p) => `dumpSites.${String(p)}` });

  function rowsResult(rows: Record<string, unknown>[]) {
    const promise = Promise.resolve(rows);
    return Object.assign(promise, {
      orderBy: () => Promise.resolve(rows),
    });
  }

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === dumpSitesTable) return rowsResult(h.sites.filter((s) => s.isActive !== false));
          return rowsResult([]);
        },
      }),
    }),
    selectDistinct: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          const states = table === dumpSitesTable
            ? [...new Set(h.sites.filter((s) => s.isActive !== false).map((s) => s.state))]
            : [];
          return Object.assign(Promise.resolve(states.map((state) => ({ state }))), {
            orderBy: () => Promise.resolve(states.map((state) => ({ state }))),
          });
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (row: Record<string, unknown>) => {
        h.inserts.push(row);
        if (table === dumpSitesTable) {
          const site = {
            id: h.nextSiteId++,
            acceptedMaterials: [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...row,
          };
          h.sites.push(site);
          return { returning: () => Promise.resolve([site]) };
        }
        return { returning: () => Promise.resolve([]) };
      },
    }),
  };

  return { db, dumpSitesTable };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = h.profile;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import dumpSitesRouter from "./dump-sites";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(dumpSitesRouter);
  return app;
}

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: h.nextSiteId++,
    name: "Apex Landfill",
    address: "4250 Losee Rd",
    city: "North Las Vegas",
    state: "NV",
    zip: "89030",
    type: "landfill",
    phone: "702-555-0100",
    latitude: "36.2400000",
    longitude: "-115.1200000",
    hours: "Mon-Fri 6a-4p",
    acceptedMaterials: ["dirt", "concrete"],
    tippingFeeDetails: "$55/ton",
    paymentMethods: "Account or credit card",
    instructions: "Check in at scale house",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  h.profile = { id: 1, role: "customer", companyName: "Test Co", staffRole: null };
  h.sites = [site()];
  h.inserts = [];
  h.nextSiteId = 100;
});

describe("dump site facility directory", () => {
  it("lists active facilities with facility metadata", async () => {
    const res = await request(makeApp()).get("/dump-sites?state=NV");

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      name: "Apex Landfill",
      latitude: 36.24,
      longitude: -115.12,
      acceptedMaterials: ["dirt", "concrete"],
      tippingFeeDetails: "$55/ton",
      fullAddress: "Apex Landfill, 4250 Losee Rd, North Las Vegas, NV 89030",
    });
  });

  it("returns states without being captured by the id route", async () => {
    const res = await request(makeApp()).get("/dump-sites/states");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(["NV"]);
  });

  it("gets a facility by id", async () => {
    const res = await request(makeApp()).get("/dump-sites/1");

    expect(res.status).toBe(200);
    expect(res.body.instructions).toBe("Check in at scale house");
  });

  it("requires staff to create facilities", async () => {
    const res = await request(makeApp()).post("/dump-sites").send({
      name: "New Facility",
      address: "10 Gate Rd",
      city: "Austin",
      state: "tx",
      zip: "78701",
      type: "transfer_station",
    });

    expect(res.status).toBe(403);
  });

  it("creates a facility for staff users", async () => {
    h.profile = { id: 2, role: "customer", companyName: "Staff", staffRole: "cto" };
    const res = await request(makeApp()).post("/dump-sites").send({
      name: "New Facility",
      address: "10 Gate Rd",
      city: "Austin",
      state: "tx",
      zip: "78701",
      type: "transfer_station",
      latitude: 30.25,
      longitude: -97.75,
      acceptedMaterials: ["asphalt"],
      tippingFeeDetails: "$40/ton",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "New Facility",
      state: "TX",
      latitude: 30.25,
      acceptedMaterials: ["asphalt"],
    });
    expect(h.inserts[0]).toMatchObject({
      state: "TX",
      latitude: "30.25",
      longitude: "-97.75",
    });
  });
});
