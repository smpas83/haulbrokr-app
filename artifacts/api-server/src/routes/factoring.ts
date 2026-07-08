import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  factoringRequestsTable,
  jobsTable,
  profilesTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { requirePermission } from "../middlewares/requireAdmin";
import {
  attachStaffSession,
  requireStaffOrProfile,
} from "../middlewares/staffAuth";

const FACTORING_FEE_RATE = 0.03; // 3% same-day advance fee

const router: IRouter = Router();

router.get("/factoring", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const rows = await db
    .select()
    .from(factoringRequestsTable)
    .where(eq(factoringRequestsTable.providerId, profile.id))
    .orderBy(sql`${factoringRequestsTable.createdAt} desc`);
  res.json(
    rows.map((r) => ({
      ...r,
      invoiceAmount: parseFloat(r.invoiceAmount),
      feeRate: parseFloat(r.feeRate),
      feeAmount: parseFloat(r.feeAmount),
      netAmount: parseFloat(r.netAmount),
    })),
  );
});

router.post("/factoring", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role !== "provider") {
    res.status(403).json({ error: "Only providers can request factoring" });
    return;
  }
  const { jobId } = req.body;
  if (!jobId) {
    res.status(400).json({ error: "jobId is required" });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.id, jobId), eq(jobsTable.providerId, profile.id)));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "completed" && job.status !== "in_progress") {
    res
      .status(400)
      .json({ error: "Job must be in progress or completed to factor" });
    return;
  }
  const existing = await db
    .select()
    .from(factoringRequestsTable)
    .where(eq(factoringRequestsTable.jobId, jobId));
  if (existing.length > 0) {
    res
      .status(400)
      .json({ error: "A factoring request already exists for this job" });
    return;
  }

  const invoiceAmount = job.totalAmount
    ? parseFloat(job.totalAmount)
    : parseFloat(job.ratePerHour) * 8;
  const feeAmount = invoiceAmount * FACTORING_FEE_RATE;
  const netAmount = invoiceAmount - feeAmount;

  const [request] = await db
    .insert(factoringRequestsTable)
    .values({
      jobId,
      providerId: profile.id,
      invoiceAmount: String(invoiceAmount),
      feeRate: String(FACTORING_FEE_RATE),
      feeAmount: String(feeAmount),
      netAmount: String(netAmount),
      status: "pending",
    })
    .returning();

  res.status(201).json({
    ...request,
    invoiceAmount: parseFloat(request.invoiceAmount),
    feeRate: parseFloat(request.feeRate),
    feeAmount: parseFloat(request.feeAmount),
    netAmount: parseFloat(request.netAmount),
  });
});

router.patch(
  "/factoring/:id/approve",
  attachStaffSession,
  requireStaffOrProfile,
  requirePermission("credit"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    const [updated] = await db
      .update(factoringRequestsTable)
      .set({ status: "approved", fundedAt: new Date() })
      .where(eq(factoringRequestsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Factoring request not found" });
      return;
    }
    res.json({
      ...updated,
      invoiceAmount: parseFloat(updated.invoiceAmount),
      feeAmount: parseFloat(updated.feeAmount),
      netAmount: parseFloat(updated.netAmount),
    });
  },
);

router.patch(
  "/factoring/:id/reject",
  attachStaffSession,
  requireStaffOrProfile,
  requirePermission("credit"),
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    const [updated] = await db
      .update(factoringRequestsTable)
      .set({ status: "denied" })
      .where(eq(factoringRequestsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Factoring request not found" });
      return;
    }
    res.json({
      ...updated,
      invoiceAmount: parseFloat(updated.invoiceAmount),
      feeAmount: parseFloat(updated.feeAmount),
      netAmount: parseFloat(updated.netAmount),
    });
  },
);

export default router;
