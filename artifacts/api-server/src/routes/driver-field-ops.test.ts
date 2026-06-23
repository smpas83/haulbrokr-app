import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  profile: { id: 30, role: "driver", companyName: "Haul Co", contactName: "Dave" } as Record<string, unknown>,
  jobs: [] as Record<string, unknown>[],
  tickets: [] as Record<string, unknown>[],
  evidence: [] as Record<string, unknown>[],
  timeline: [] as Record<string, unknown>[],
  nextTicketId: 1,
  nextEvidenceId: 1,
  nextTimelineId: 1,
}));

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });

  const jobsTable = makeTable("jobs");
  const ticketsTable = makeTable("tickets");
  const deliveryEvidenceTable = makeTable("delivery_evidence");
  const jobStatusUpdatesTable = makeTable("job_status_updates");
  const requestsTable = makeTable("requests");
  const activityTable = makeTable("activity");
  const profilesTable = makeTable("profiles");

  const thenable = (rows: unknown[], tableRef: unknown) => ({
    orderBy: () => Promise.resolve(tableRef === ticketsTable ? h.tickets : rows),
    leftJoin: () => ({
      where: () => ({
        orderBy: () => Promise.resolve(
          h.timeline.map((t) => ({ ...t, actorName: "Dave", actorCompany: "Haul Co" })),
        ),
      }),
    }),
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  });

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          if (table === deliveryEvidenceTable) return thenable(h.evidence, table);
          if (table === ticketsTable) return thenable(h.tickets, table);
          if (table === jobsTable) return thenable(h.jobs, table);
          if (table === jobStatusUpdatesTable) return thenable(h.timeline, table);
          if (table === profilesTable) return thenable([{ companyName: "Co" }], table);
          return thenable([], table);
        },
        orderBy: () => Promise.resolve(table === ticketsTable ? h.tickets : []),
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        if (table === ticketsTable) {
          const ticket = { id: h.nextTicketId++, ...vals };
          h.tickets.push(ticket);
          return { returning: () => Promise.resolve([ticket]) };
        }
        if (table === deliveryEvidenceTable) {
          const row = { id: h.nextEvidenceId++, ...vals };
          h.evidence.push(row);
          return { returning: () => Promise.resolve([row]) };
        }
        if (table === jobStatusUpdatesTable) {
          const row = { id: h.nextTimelineId++, ...vals };
          h.timeline.push(row);
          return Promise.resolve(undefined);
        }
        if (table === activityTable) {
          return Promise.resolve(undefined);
        }
        return Promise.resolve(undefined);
      },
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        where: (..._args: unknown[]) => ({
          returning: () => {
            if (table === ticketsTable) {
              const ticket = h.tickets.find((t) => t.id === 1);
              if (ticket) Object.assign(ticket, vals);
              return Promise.resolve(ticket ? [ticket] : []);
            }
            if (table === jobsTable) {
              for (const j of h.jobs) Object.assign(j, vals);
              return Promise.resolve(h.jobs[0] ? [h.jobs[0]] : []);
            }
            if (table === requestsTable) {
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          },
        }),
      }),
    }),
  };

  return {
    db,
    jobsTable,
    ticketsTable,
    deliveryEvidenceTable,
    jobStatusUpdatesTable,
    requestsTable,
    activityTable,
    profilesTable,
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireProfile: (req: any, _res: any, next: any) => {
    req.profile = { ...h.profile };
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

vi.mock("../lib/access", () => ({
  loadJobIfMember: async (jobId: number) => h.jobs.find((j) => j.id === jobId) ?? null,
  isDriverAssignedToJob: async (jobId: number, profileId: number) =>
    h.tickets.some((t) => t.jobId === jobId && t.driverProfileId === profileId),
  orgScopedActorIds: async () => [h.profile.id],
  isOrgManager: () => false,
  canReviewCompletion: () => false,
  DRIVER_SIDE: new Set(["provider", "driver"]),
  CUSTOMER_SIDE: new Set(["customer", "supervisor"]),
}));

import jobsRouter from "./jobs";
import ticketsRouter from "./tickets";
import evidenceRouter from "./evidence";

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(jobsRouter);
  app.use(ticketsRouter);
  app.use(evidenceRouter);
  return app;
}

function sampleJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    requestId: 1,
    bidId: 5,
    customerId: 10,
    providerId: 20,
    ratePerHour: "120.00",
    trucksAssigned: 2,
    status: "accepted",
    materialType: "dirt",
    truckType: "dump_truck",
    pickupAddress: "A",
    deliveryAddress: "B",
    scheduledDate: new Date(),
    startTime: "08:00",
    estimatedHours: "8",
    notes: "Check in with foreman at trailer.",
    paymentStatus: "unpaid",
    platformFeeRate: "0.15",
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  h.profile = { id: 30, role: "driver", companyName: "Haul Co", contactName: "Dave" };
  h.jobs = [sampleJob()];
  h.tickets = [{
    id: 1,
    jobId: 9,
    driverProfileId: 30,
    loadNumber: 1,
    status: "pending",
    clockedInAt: null,
    clockedOutAt: null,
  }];
  h.evidence = [];
  h.timeline = [];
  h.nextTicketId = 2;
  h.nextEvidenceId = 1;
  h.nextTimelineId = 1;
});

describe("Driver field operations workflow", () => {
  it("driver checks in, starts work, uploads ticket and photo, completes job", async () => {
    const app = makeApp();

    const checkIn = await request(app).post("/tickets/1/clock-in");
    expect(checkIn.status).toBe(200);
    expect(h.timeline.some((t) => t.status === "checked_in")).toBe(true);

    const start = await request(app).patch("/jobs/9").send({ status: "in_progress" });
    expect(start.status).toBe(200);
    expect(h.timeline.some((t) => t.status === "started")).toBe(true);

    const ticket = await request(app).post("/jobs/9/tickets").send({
      weightTons: 18,
      photoUrl: "https://example.com/ticket.jpg",
    });
    expect(ticket.status).toBe(201);
    expect(h.timeline.some((t) => t.status === "ticket_uploaded")).toBe(true);

    const photo = await request(app).post("/jobs/9/evidence").send({
      photoUrl: "https://example.com/site.jpg",
      photoCaption: "Dump zone",
    });
    expect(photo.status).toBe(201);
    expect(h.timeline.some((t) => t.status === "photo_uploaded")).toBe(true);

    h.jobs[0].status = "in_progress";
    const complete = await request(app).patch("/jobs/9").send({ status: "completed" });
    expect(complete.status).toBe(200);
    expect(h.timeline.some((t) => t.status === "completed")).toBe(true);
  });

  it("customer, provider, and admin can list tickets and evidence", async () => {
    h.evidence = [{ id: 1, jobId: 9, photoUrl: "https://example.com/x.jpg" }];
    const app = makeApp();

    h.profile = { id: 10, role: "customer", companyName: "Customer Co" };
    const custTickets = await request(app).get("/jobs/9/tickets");
    expect(custTickets.status).toBe(200);
    expect(custTickets.body.tickets).toHaveLength(1);

    const custEvidence = await request(app).get("/jobs/9/evidence");
    expect(custEvidence.status).toBe(200);
    expect(custEvidence.body).toHaveLength(1);

    h.profile = { id: 20, role: "provider", companyName: "Haul Co" };
    const provEvidence = await request(app).get("/jobs/9/evidence");
    expect(provEvidence.status).toBe(200);

    h.profile = { id: 99, role: "customer", staffRole: "ceo", companyName: "Staff" };
    const adminEvidence = await request(app).get("/jobs/9/evidence");
    expect(adminEvidence.status).toBe(200);
  });

  it("unassigned driver cannot upload evidence or update job status", async () => {
    h.tickets = [{ id: 1, jobId: 9, driverProfileId: 31, loadNumber: 1, status: "pending" }];
    h.profile = { id: 30, role: "driver", companyName: "Haul Co" };
    const app = makeApp();

    const evidence = await request(app).post("/jobs/9/evidence").send({ photoUrl: "https://example.com/x.jpg" });
    expect(evidence.status).toBe(403);

    const complete = await request(app).patch("/jobs/9").send({ status: "completed" });
    expect(complete.status).toBe(403);
  });
});
