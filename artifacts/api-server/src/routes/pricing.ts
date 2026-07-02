import { Router, type IRouter } from "express";
import { z } from "zod";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  DEFAULT_BROKER_MARGIN_RATE,
  computeMarketplacePricing,
  pricingForAudience,
  type MarketplacePricingRules,
  type PricingAudience,
} from "../lib/pricing";

const router: IRouter = Router();

const chargeSchema = z.union([
  z.number().nonnegative(),
  z.object({
    type: z.enum(["fixed", "percentage"]).optional(),
    value: z.number().nonnegative(),
    label: z.string().min(1).optional(),
    applies: z.boolean().optional(),
  }),
]);

const pricingBreakdownBody = z.object({
  driverRatePerHour: z.number().nonnegative(),
  estimatedHours: z.number().nonnegative(),
  truckCount: z.number().int().positive().optional(),
  brokerMarginType: z.enum(["fixed", "percentage"]).optional(),
  brokerMarginValue: z.number().nonnegative().optional().default(DEFAULT_BROKER_MARGIN_RATE),
  pricingRules: z.object({
    customerSpecific: chargeSchema.nullish(),
    fleetSpecific: chargeSchema.nullish(),
    driverSpecific: chargeSchema.nullish(),
    materialSpecific: chargeSchema.nullish(),
    rush: chargeSchema.nullish(),
    weekend: chargeSchema.nullish(),
    holiday: chargeSchema.nullish(),
    night: chargeSchema.nullish(),
    waitingCharge: chargeSchema.nullish(),
    fuelSurcharge: chargeSchema.nullish(),
    cancellationFee: chargeSchema.nullish(),
    noShowFee: chargeSchema.nullish(),
  }).partial().optional(),
});

export function pricingAudienceForProfile(profile: { role: string; staffRole?: string | null }): PricingAudience {
  if (profile.staffRole) return "broker";
  if (profile.role === "customer" || profile.role === "supervisor") return "customer";
  return "payee";
}

router.post("/pricing/breakdown", requireProfile, async (req, res): Promise<void> => {
  const parsed = pricingBreakdownBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const profile = getRequestProfile(req);
  const breakdown = computeMarketplacePricing({
    ...parsed.data,
    pricingRules: parsed.data.pricingRules as MarketplacePricingRules | undefined,
  });

  res.json(pricingForAudience(breakdown, pricingAudienceForProfile(profile)));
});

export default router;
