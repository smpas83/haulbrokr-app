import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  recurringGenerationRunsTable,
  recurringSchedulesTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { z } from "zod";

const router: IRouter = Router();

const upsertSchema = z.object({
  name: z.string().min(1).max(120),
  recurrenceType: z.enum(["daily", "weekly", "monthly", "custom"]),
  timezone: z.string().min(1).default("America/Chicago"),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  intervalDays: z.number().int().min(1).max(365).nullable().optional(),
  startDate: z.string().min(1),
  endDate: z.string().nullable().optional(),
  skipDates: z.array(z.string()).optional(),
  holidayBehavior: z.enum(["include", "skip", "next_business_day"]).optional(),
  materialType: z.enum([
    "dirt",
    "gravel",
    "sand",
    "concrete",
    "asphalt",
    "demolition",
    "topsoil",
    "fill",
    "other",
  ]),
  truckType: z.string().min(1),
  quantityTons: z.union([z.string(), z.number()]),
  pickupAddress: z.string().min(1),
  deliveryAddress: z.string().min(1),
  startTime: z.string().optional(),
  estimatedHours: z.union([z.string(), z.number()]).optional(),
  trucksNeeded: z.number().int().min(1).optional(),
  budgetPerHour: z.union([z.string(), z.number()]).nullable().optional(),
  projectId: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  generateHorizonDays: z.number().int().min(1).max(90).optional(),
});

router.get(
  "/recurring-schedules",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const rows = await db
      .select()
      .from(recurringSchedulesTable)
      .where(eq(recurringSchedulesTable.customerId, profile.id))
      .orderBy(desc(recurringSchedulesTable.createdAt));
    res.json(rows);
  },
);

router.post(
  "/recurring-schedules",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    if (profile.role !== "customer" && profile.role !== "supervisor") {
      res
        .status(403)
        .json({ error: "Only customers can create recurring haul schedules." });
      return;
    }
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const [row] = await db
      .insert(recurringSchedulesTable)
      .values({
        customerId: profile.id,
        organizationId: profile.organizationId,
        name: d.name,
        recurrenceType: d.recurrenceType,
        timezone: d.timezone,
        daysOfWeek: d.daysOfWeek ?? [],
        dayOfMonth: d.dayOfMonth ?? null,
        intervalDays: d.intervalDays ?? null,
        startDate: new Date(d.startDate),
        endDate: d.endDate ? new Date(d.endDate) : null,
        skipDates: d.skipDates ?? [],
        holidayBehavior: d.holidayBehavior ?? "skip",
        materialType: d.materialType,
        truckType: d.truckType as any,
        quantityTons: String(d.quantityTons),
        pickupAddress: d.pickupAddress,
        deliveryAddress: d.deliveryAddress,
        startTime: d.startTime ?? "08:00",
        estimatedHours: String(d.estimatedHours ?? "8"),
        trucksNeeded: d.trucksNeeded ?? 1,
        budgetPerHour: d.budgetPerHour != null ? String(d.budgetPerHour) : null,
        projectId: d.projectId ?? null,
        notes: d.notes ?? null,
        generateHorizonDays: d.generateHorizonDays ?? 14,
        status: "active",
      })
      .returning();
    res.status(201).json(row);
  },
);

router.get(
  "/recurring-schedules/:id",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = Number(req.params.id);
    const [row] = await db
      .select()
      .from(recurringSchedulesTable)
      .where(
        and(
          eq(recurringSchedulesTable.id, id),
          eq(recurringSchedulesTable.customerId, profile.id),
        ),
      );
    if (!row) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }
    const history = await db
      .select()
      .from(recurringGenerationRunsTable)
      .where(eq(recurringGenerationRunsTable.scheduleId, id))
      .orderBy(desc(recurringGenerationRunsTable.createdAt))
      .limit(50);
    res.json({ ...row, generationHistory: history });
  },
);

router.patch(
  "/recurring-schedules/:id",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = Number(req.params.id);
    const [existing] = await db
      .select()
      .from(recurringSchedulesTable)
      .where(
        and(
          eq(recurringSchedulesTable.id, id),
          eq(recurringSchedulesTable.customerId, profile.id),
        ),
      );
    if (!existing) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }

    const status = req.body?.status as string | undefined;
    if (status && ["active", "paused", "cancelled"].includes(status)) {
      const [row] = await db
        .update(recurringSchedulesTable)
        .set({
          status: status as "active" | "paused" | "cancelled",
          lastError: null,
        })
        .where(eq(recurringSchedulesTable.id, id))
        .returning();
      res.json(row);
      return;
    }

    const parsed = upsertSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) {
      if (v === undefined) continue;
      if (k === "startDate" || k === "endDate")
        patch[k] = v ? new Date(String(v)) : null;
      else if (
        k === "quantityTons" ||
        k === "estimatedHours" ||
        k === "budgetPerHour"
      ) {
        patch[k] = v == null ? null : String(v);
      } else patch[k] = v;
    }
    const [row] = await db
      .update(recurringSchedulesTable)
      .set(patch)
      .where(eq(recurringSchedulesTable.id, id))
      .returning();
    res.json(row);
  },
);

router.post(
  "/recurring-schedules/:id/pause",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = Number(req.params.id);
    const [row] = await db
      .update(recurringSchedulesTable)
      .set({ status: "paused" })
      .where(
        and(
          eq(recurringSchedulesTable.id, id),
          eq(recurringSchedulesTable.customerId, profile.id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }
    res.json(row);
  },
);

router.post(
  "/recurring-schedules/:id/resume",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = Number(req.params.id);
    const [row] = await db
      .update(recurringSchedulesTable)
      .set({ status: "active", lastError: null, consecutiveFailures: 0 })
      .where(
        and(
          eq(recurringSchedulesTable.id, id),
          eq(recurringSchedulesTable.customerId, profile.id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }
    res.json(row);
  },
);

router.post(
  "/recurring-schedules/:id/cancel",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = Number(req.params.id);
    const [row] = await db
      .update(recurringSchedulesTable)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(recurringSchedulesTable.id, id),
          eq(recurringSchedulesTable.customerId, profile.id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Schedule not found" });
      return;
    }
    res.json(row);
  },
);

export default router;
