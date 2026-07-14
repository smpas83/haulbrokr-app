import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  recurringHaulsTable,
  recurringHaulOccurrencesTable,
} from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  computeNextRunAt,
  listCalendarOccurrences,
  serializeRecurringHaul,
  processDueRecurringHauls,
  processRecurringReminders,
} from "../lib/recurringHauls";
import { canDispatch } from "../lib/orgPermissions";

const router: IRouter = Router();

const TruckType = z.enum([
  "standard",
  "articulated",
  "side_dump",
  "bottom_dump",
  "transfer",
  "dump_truck",
  "super_10",
  "end_dump",
  "belly_dump",
  "lowboy",
  "water_truck",
  "excavator",
  "dozer",
  "skid_steer",
]);

const CreateBody = z.object({
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
  truckType: TruckType,
  quantityTons: z.number().positive(),
  pickupAddress: z.string().min(3),
  deliveryAddress: z.string().min(3),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("08:00"),
  estimatedHours: z.number().positive(),
  trucksNeeded: z.number().int().positive().default(1),
  budgetPerHour: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  projectId: z.number().int().positive().optional().nullable(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly"]),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(28).optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  reminderHoursBefore: z.number().int().min(1).max(168).optional().nullable(),
  maxOccurrences: z.number().int().positive().optional().nullable(),
});

const UpdateBody = CreateBody.partial().extend({
  status: z.enum(["active", "paused", "cancelled"]).optional(),
});

router.get(
  "/recurring-hauls",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const rows = await db
      .select()
      .from(recurringHaulsTable)
      .where(eq(recurringHaulsTable.customerId, profile.id))
      .orderBy(desc(recurringHaulsTable.createdAt));
    res.json({ items: rows.map(serializeRecurringHaul) });
  },
);

/** Calendar view of recurring haul occurrences in a date range. */
router.get(
  "/recurring-hauls/calendar",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const fromRaw = String(req.query.from ?? "");
    const toRaw = String(req.query.to ?? "");
    const from = fromRaw ? new Date(fromRaw) : new Date();
    const to = toRaw ? new Date(toRaw) : new Date(Date.now() + 30 * 86_400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      res.status(400).json({ error: "Invalid from/to date" });
      return;
    }
    const items = await listCalendarOccurrences({
      customerId: profile.id,
      organizationId: profile.organizationId,
      from,
      to,
    });
    res.json({ from, to, items });
  },
);

/** Manual trigger for ops / tests — processes due series + reminders. */
router.post(
  "/recurring-hauls/run-scheduler",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    if (!profile.staffRole && profile.role !== "customer") {
      res.status(403).json({ error: "Not allowed" });
      return;
    }
    const due = await processDueRecurringHauls();
    const reminders = await processRecurringReminders();
    res.json({ due, reminders });
  },
);

router.post(
  "/recurring-hauls",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    if (profile.role !== "customer" && !canDispatch(profile)) {
      res
        .status(403)
        .json({
          error: "Only customers or dispatchers can create recurring hauls.",
        });
      return;
    }
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const d = parsed.data;
    const startDate = new Date(d.startDate);
    const nextRunAt = startDate;

    const [row] = await db
      .insert(recurringHaulsTable)
      .values({
        customerId: profile.id,
        organizationId: profile.organizationId,
        projectId: d.projectId ?? null,
        materialType: d.materialType,
        truckType: d.truckType,
        quantityTons: String(d.quantityTons),
        pickupAddress: d.pickupAddress,
        deliveryAddress: d.deliveryAddress,
        startTime: d.startTime,
        estimatedHours: String(d.estimatedHours),
        trucksNeeded: d.trucksNeeded,
        budgetPerHour: d.budgetPerHour != null ? String(d.budgetPerHour) : null,
        notes: d.notes ?? null,
        frequency: d.frequency,
        daysOfWeek: d.daysOfWeek?.length ? d.daysOfWeek.join(",") : null,
        dayOfMonth: d.dayOfMonth ?? null,
        startDate,
        endDate: d.endDate ?? null,
        nextRunAt,
        reminderHoursBefore: d.reminderHoursBefore ?? 24,
        maxOccurrences: d.maxOccurrences ?? null,
        status: "active",
      })
      .returning();

    res.status(201).json(serializeRecurringHaul(row));
  },
);

router.get(
  "/recurring-hauls/:id",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [row] = await db
      .select()
      .from(recurringHaulsTable)
      .where(eq(recurringHaulsTable.id, id));
    if (!row || row.customerId !== profile.id) {
      res.status(404).json({ error: "Recurring haul not found" });
      return;
    }
    const occurrences = await db
      .select()
      .from(recurringHaulOccurrencesTable)
      .where(eq(recurringHaulOccurrencesTable.recurringHaulId, id))
      .orderBy(desc(recurringHaulOccurrencesTable.scheduledDate))
      .limit(50);
    res.json({
      ...serializeRecurringHaul(row),
      occurrences: occurrences.map((o) => ({
        id: o.id,
        requestId: o.requestId,
        scheduledDate: o.scheduledDate,
        reminderSentAt: o.reminderSentAt,
        createdAt: o.createdAt,
      })),
    });
  },
);

router.patch(
  "/recurring-hauls/:id",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select()
      .from(recurringHaulsTable)
      .where(eq(recurringHaulsTable.id, id));
    if (!existing || existing.customerId !== profile.id) {
      res.status(404).json({ error: "Recurring haul not found" });
      return;
    }

    const d = parsed.data;
    const patch: Record<string, unknown> = {};
    if (d.materialType != null) patch.materialType = d.materialType;
    if (d.truckType != null) patch.truckType = d.truckType;
    if (d.quantityTons != null) patch.quantityTons = String(d.quantityTons);
    if (d.pickupAddress != null) patch.pickupAddress = d.pickupAddress;
    if (d.deliveryAddress != null) patch.deliveryAddress = d.deliveryAddress;
    if (d.startTime != null) patch.startTime = d.startTime;
    if (d.estimatedHours != null)
      patch.estimatedHours = String(d.estimatedHours);
    if (d.trucksNeeded != null) patch.trucksNeeded = d.trucksNeeded;
    if (d.budgetPerHour !== undefined)
      patch.budgetPerHour =
        d.budgetPerHour != null ? String(d.budgetPerHour) : null;
    if (d.notes !== undefined) patch.notes = d.notes;
    if (d.projectId !== undefined) patch.projectId = d.projectId;
    if (d.frequency != null) patch.frequency = d.frequency;
    if (d.daysOfWeek !== undefined)
      patch.daysOfWeek = d.daysOfWeek?.length ? d.daysOfWeek.join(",") : null;
    if (d.dayOfMonth !== undefined) patch.dayOfMonth = d.dayOfMonth;
    if (d.startDate != null) patch.startDate = d.startDate;
    if (d.endDate !== undefined) patch.endDate = d.endDate;
    if (d.reminderHoursBefore !== undefined)
      patch.reminderHoursBefore = d.reminderHoursBefore;
    if (d.maxOccurrences !== undefined) patch.maxOccurrences = d.maxOccurrences;
    if (d.status != null) patch.status = d.status;

    if (
      d.frequency != null ||
      d.daysOfWeek !== undefined ||
      d.dayOfMonth !== undefined ||
      d.startDate != null
    ) {
      const merged = {
        frequency:
          (patch.frequency as typeof existing.frequency) ?? existing.frequency,
        daysOfWeek:
          (patch.daysOfWeek as string | null | undefined) ??
          existing.daysOfWeek,
        dayOfMonth:
          (patch.dayOfMonth as number | null | undefined) ??
          existing.dayOfMonth,
        startDate: (patch.startDate as Date) ?? existing.startDate,
        endDate:
          (patch.endDate as Date | null | undefined) !== undefined
            ? (patch.endDate as Date | null)
            : existing.endDate,
      };
      const next = computeNextRunAt(merged, new Date(Date.now() - 1000));
      if (next) patch.nextRunAt = next;
    }

    const [updated] = await db
      .update(recurringHaulsTable)
      .set(patch)
      .where(
        and(
          eq(recurringHaulsTable.id, id),
          eq(recurringHaulsTable.customerId, profile.id),
        ),
      )
      .returning();
    res.json(serializeRecurringHaul(updated));
  },
);

router.delete(
  "/recurring-hauls/:id",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [updated] = await db
      .update(recurringHaulsTable)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(recurringHaulsTable.id, id),
          eq(recurringHaulsTable.customerId, profile.id),
        ),
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Recurring haul not found" });
      return;
    }
    res.json(serializeRecurringHaul(updated));
  },
);

export default router;
