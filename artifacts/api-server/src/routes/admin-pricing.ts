import { z } from "zod/v4";
import type { IRouter } from "express";
import { requireStaffOrProfile } from "../middlewares/staffAuth";
import { requirePermission } from "../middlewares/requireAdmin";
import {
  listPricingSettings,
  listFuelSurchargeWeeks,
  loadPricingRates,
  upsertPricingSetting,
  upsertFuelSurchargeWeek,
  deleteFuelSurchargeWeek,
  ensurePricingSettingsSeeded,
} from "../lib/pricing";

function serializeSetting(row: {
  id: number;
  key: string;
  value: string;
  description: string | null;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    key: row.key,
    value: parseFloat(row.value),
    description: row.description,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeFuelWeek(row: {
  id: number;
  weekStartDate: string;
  nationalDieselPrice: string | null;
  surchargeRate: string;
  notes: string | null;
  isActive: boolean;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    weekStartDate: row.weekStartDate,
    nationalDieselPrice:
      row.nationalDieselPrice != null ? parseFloat(row.nationalDieselPrice) : null,
    surchargeRate: parseFloat(row.surchargeRate),
    notes: row.notes,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function buildPricingConfig() {
  await ensurePricingSettingsSeeded();
  const [settings, fuelSurchargeWeeks, activeRates] = await Promise.all([
    listPricingSettings(),
    listFuelSurchargeWeeks(),
    loadPricingRates(),
  ]);
  return {
    settings: settings.map(serializeSetting),
    fuelSurchargeWeeks: fuelSurchargeWeeks.map(serializeFuelWeek),
    activeRates,
  };
}

const UpdateSettingsBody = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.number().finite(),
        description: z.string().optional(),
      }),
    )
    .min(1),
});

const UpsertFuelWeekBody = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  surchargeRate: z.number().min(0).max(1),
  nationalDieselPrice: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

/** Mount pricing admin endpoints on the shared admin router. */
export function registerPricingAdminRoutes(router: IRouter): void {
  router.get(
    "/admin/pricing",
    requireStaffOrProfile,
    requirePermission("overview"),
    async (_req, res): Promise<void> => {
      res.json(await buildPricingConfig());
    },
  );

  router.patch(
    "/admin/pricing",
    requireStaffOrProfile,
    requirePermission("overview"),
    async (req, res): Promise<void> => {
      const parsed = UpdateSettingsBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      for (const item of parsed.data.settings) {
        await upsertPricingSetting(item.key, item.value, item.description);
      }
      res.json(await buildPricingConfig());
    },
  );

  router.post(
    "/admin/pricing/fuel-surcharge",
    requireStaffOrProfile,
    requirePermission("overview"),
    async (req, res): Promise<void> => {
      const parsed = UpsertFuelWeekBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const row = await upsertFuelSurchargeWeek(parsed.data);
      res.json(serializeFuelWeek(row));
    },
  );

  router.delete(
    "/admin/pricing/fuel-surcharge/:id",
    requireStaffOrProfile,
    requirePermission("overview"),
    async (req, res): Promise<void> => {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }
      const deleted = await deleteFuelSurchargeWeek(id);
      if (!deleted) {
        res.status(404).json({ error: "Fuel surcharge week not found" });
        return;
      }
      res.json({ ok: true });
    },
  );
}
