import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express, { type Express } from "express";
import request from "supertest";
import { eq } from "drizzle-orm";

/**
 * End-to-end company/team flow against the REAL development database.
 *
 * Exercises the full journey the user asked for, through the actual route
 * handlers and SQL (only Clerk auth is bypassed):
 *
 *   company adds a truck → has a driver → assigns a job (driver + truck)
 *   → driver checks in → foreman approves completion
 *
 * All seeded rows are namespaced with a unique run id and removed in afterAll.
 */

// A mutable holder lets each request act as a different profile.
const actor = vi.hoisted(() => ({ current: null as any }));

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!actor.current) { res.status(401).json({ error: "No actor" }); return; }
    req.clerkId = actor.current.clerkId;
    next();
  },
  requireProfile: (req: any, res: any, next: any) => {
    if (!actor.current) { res.status(401).json({ error: "No actor" }); return; }
    req.profile = actor.current;
    req.clerkId = actor.current.clerkId;
    next();
  },
  getRequestProfile: (req: any) => req.profile,
}));

import jobsRouter from "./jobs";
import trucksRouter from "./trucks";
import ticketsRouter from "./tickets";
import projectsRouter from "./projects";
import organizationsRouter from "./organizations";
import {
  db,
  profilesTable,
  trucksTable,
  jobsTable,
  ticketsTable,
  requestsTable,
  bidsTable,
  projectsTable,
  jobStatusUpdatesTable,
  projectAssignmentsTable,
} from "@workspace/db";

const TAG = `test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(trucksRouter);
  app.use(ticketsRouter);
  app.use(projectsRouter);
  app.use(organizationsRouter);
  app.use(jobsRouter);
  return app;
}

const app = makeApp();
function as(profile: any) { actor.current = profile; }

// Seeded entities (filled in beforeAll).
let customerOwner: any;   // role customer, org owner of customer org
let providerOwner: any;   // role provider, org owner of provider org
let driver: any;          // role driver, member of provider org
let foreman: any;         // role supervisor, member of customer org
let foreman2: any;        // role supervisor, member of customer org, NOT assigned
let customerOrgId: number;
let providerOrgId: number;
let project: any;
let request_: any;
let bid: any;
let job: any;
let truckId: number;
let ticketId: number;

beforeAll(async () => {
  // Two org "owner" accounts. organizationId points at the owner's own id.
  [customerOwner] = await db.insert(profilesTable).values({
    clerkId: `${TAG}-cust`, role: "customer", companyName: `${TAG} Builders`,
    contactName: "Carol Customer", orgRole: "owner",
  }).returning();
  customerOrgId = customerOwner.id;
  [customerOwner] = await db.update(profilesTable)
    .set({ organizationId: customerOrgId }).where(eq(profilesTable.id, customerOwner.id)).returning();

  [providerOwner] = await db.insert(profilesTable).values({
    clerkId: `${TAG}-prov`, role: "provider", companyName: `${TAG} Hauling`,
    contactName: "Pat Provider", orgRole: "owner",
  }).returning();
  providerOrgId = providerOwner.id;
  [providerOwner] = await db.update(profilesTable)
    .set({ organizationId: providerOrgId }).where(eq(profilesTable.id, providerOwner.id)).returning();

  // Team members.
  [driver] = await db.insert(profilesTable).values({
    clerkId: `${TAG}-drv`, role: "driver", companyName: `${TAG} Hauling`,
    contactName: "Dave Driver", organizationId: providerOrgId, orgRole: "member",
  }).returning();
  [foreman] = await db.insert(profilesTable).values({
    clerkId: `${TAG}-fore`, role: "supervisor", companyName: `${TAG} Builders`,
    contactName: "Fran Foreman", organizationId: customerOrgId, orgRole: "member",
  }).returning();
  [foreman2] = await db.insert(profilesTable).values({
    clerkId: `${TAG}-fore2`, role: "supervisor", companyName: `${TAG} Builders`,
    contactName: "Fred Foreman", organizationId: customerOrgId, orgRole: "member",
  }).returning();

  // Project (customer site), request, bid, then job.
  [project] = await db.insert(projectsTable).values({
    customerId: customerOwner.id, name: `${TAG} Site`, siteAddress: "1 Dirt Rd",
  }).returning();
  [request_] = await db.insert(requestsTable).values({
    customerId: customerOwner.id, materialType: "dirt", truckType: "dump_truck", quantityTons: "100",
    pickupAddress: "1 Pit Rd", deliveryAddress: "1 Dirt Rd", scheduledDate: new Date(),
    startTime: "08:00", estimatedHours: "8",
    projectId: project.id, status: "accepted",
  }).returning();
  [bid] = await db.insert(bidsTable).values({
    requestId: request_.id, providerId: providerOwner.id, ratePerHour: "100", status: "accepted",
  }).returning();
  [job] = await db.insert(jobsTable).values({
    requestId: request_.id, bidId: bid.id, customerId: customerOwner.id, providerId: providerOwner.id,
    projectId: project.id, ratePerHour: "100", materialType: "dirt", truckType: "dump_truck",
    pickupAddress: "1 Pit Rd", deliveryAddress: "1 Dirt Rd", scheduledDate: new Date(),
    startTime: "08:00", estimatedHours: "8",
    status: "completed",
  }).returning();
});

afterAll(async () => {
  // Children first to satisfy FKs (most cascade, but be explicit).
  await db.delete(projectAssignmentsTable).where(eq(projectAssignmentsTable.projectId, project.id));
  await db.delete(jobStatusUpdatesTable).where(eq(jobStatusUpdatesTable.jobId, job.id));
  await db.delete(ticketsTable).where(eq(ticketsTable.jobId, job.id));
  await db.delete(jobsTable).where(eq(jobsTable.id, job.id));
  await db.delete(bidsTable).where(eq(bidsTable.id, bid.id));
  await db.delete(requestsTable).where(eq(requestsTable.id, request_.id));
  await db.delete(projectsTable).where(eq(projectsTable.id, project.id));
  for (const p of [driver, foreman, foreman2, customerOwner, providerOwner]) {
    if (p) await db.delete(profilesTable).where(eq(profilesTable.id, p.id));
  }
});

describe("Company/team full flow", () => {
  it("1. provider company adds a truck to its fleet", async () => {
    as(providerOwner);
    const res = await request(app).post("/trucks").send({
      truckType: "dump_truck", capacityTons: 20, ratePerHour: 100,
      truckNumber: "T-1", coiStatus: "active",
    });
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(providerOwner.id);
    truckId = res.body.id;
  });

  it("2. the driver is listed as a member of the provider org", async () => {
    as(providerOwner);
    const res = await request(app).get("/organizations/members");
    expect(res.status).toBe(200);
    const ids = res.body.members.map((m: any) => m.id);
    expect(ids).toContain(driver.id);
    const drv = res.body.members.find((m: any) => m.id === driver.id);
    expect(drv.role).toBe("driver");
  });

  it("2b. driver sees the company's job in their job list (org-member visibility)", async () => {
    as(driver);
    const res = await request(app).get("/jobs");
    expect(res.status).toBe(200);
    expect(res.body.map((j: any) => j.id)).toContain(job.id);
  });

  it("3. owner assigns the job to the driver + truck (creates a load ticket)", async () => {
    as(providerOwner);
    const res = await request(app).post(`/jobs/${job.id}/assign`).send({
      driverProfileId: driver.id, truckId,
    });
    expect(res.status).toBe(201);
    expect(res.body.driverProfileId).toBe(driver.id);
    expect(res.body.truckId).toBe(truckId);
    ticketId = res.body.id;
  });

  it("3b. a non-manager driver cannot assign jobs", async () => {
    as(driver);
    const res = await request(app).post(`/jobs/${job.id}/assign`).send({
      driverProfileId: driver.id, truckId,
    });
    expect(res.status).toBe(403);
  });

  it("4. driver checks in (clock-in) on the assigned ticket", async () => {
    as(driver);
    const res = await request(app).post(`/tickets/${ticketId}/clock-in`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("in_progress");
    expect(res.body.clockedInAt).toBeTruthy();
  });

  it("4b. driver posts a status update on the job", async () => {
    as(driver);
    const res = await request(app).post(`/jobs/${job.id}/status-updates`).send({
      status: "arrived", ticketId, note: "On site",
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("arrived");
  });

  it("4c. status update rejects a ticket that belongs to a different job", async () => {
    // Throwaway job + ticket on it, then try to attach that ticket to our job.
    const [otherJob] = await db.insert(jobsTable).values({
      requestId: request_.id, bidId: bid.id, customerId: customerOwner.id, providerId: providerOwner.id,
      projectId: project.id, ratePerHour: "100", materialType: "dirt", truckType: "dump_truck",
      pickupAddress: "1 Pit Rd", deliveryAddress: "1 Dirt Rd", scheduledDate: new Date(),
      startTime: "08:00", estimatedHours: "8",
      status: "in_progress",
    }).returning();
    const [otherTicket] = await db.insert(ticketsTable).values({
      jobId: otherJob.id, driverProfileId: driver.id, truckId, loadNumber: 1, status: "pending",
    }).returning();
    try {
      as(driver);
      const res = await request(app).post(`/jobs/${job.id}/status-updates`).send({
        status: "arrived", ticketId: otherTicket.id,
      });
      expect(res.status).toBe(400);
    } finally {
      await db.delete(ticketsTable).where(eq(ticketsTable.id, otherTicket.id));
      await db.delete(jobsTable).where(eq(jobsTable.id, otherJob.id));
    }
  });

  it("5. customer assigns the foreman to the project site", async () => {
    as(customerOwner);
    const res = await request(app).post(`/projects/${project.id}/assignments`).send({
      supervisorProfileId: foreman.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.supervisorProfileId).toBe(foreman.id);
  });

  it("5b. an unassigned foreman in the same org cannot approve completion", async () => {
    as(foreman2);
    const res = await request(app).post(`/jobs/${job.id}/approve-completion`);
    expect(res.status).toBe(403);
  });

  it("5c. completion cannot be reviewed until the job is marked completed", async () => {
    await db.update(jobsTable).set({ status: "in_progress" }).where(eq(jobsTable.id, job.id));
    try {
      as(foreman);
      const res = await request(app).post(`/jobs/${job.id}/approve-completion`);
      expect(res.status).toBe(409);
    } finally {
      await db.update(jobsTable).set({ status: "completed" }).where(eq(jobsTable.id, job.id));
    }
  });

  it("6. assigned foreman (supervisor) approves job completion", async () => {
    as(foreman);
    const res = await request(app).post(`/jobs/${job.id}/approve-completion`);
    expect(res.status).toBe(200);
    expect(res.body.completionApproval).toBe("approved");
    expect(res.body.approvedByProfileId).toBe(foreman.id);

    const [persisted] = await db.select().from(jobsTable).where(eq(jobsTable.id, job.id));
    expect(persisted.completionApproval).toBe("approved");
    expect(persisted.approvedByProfileId).toBe(foreman.id);
  });

  it("6b. a provider-side driver cannot approve completion", async () => {
    as(driver);
    const res = await request(app).post(`/jobs/${job.id}/approve-completion`);
    expect(res.status).toBe(403);
  });
});
