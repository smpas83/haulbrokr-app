import { Router, type IRouter } from "express";
import { desc, or, eq } from "drizzle-orm";
import { db, marketplacePaymentsTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { serializeMarketplacePayment } from "../lib/paymentLedger";

const router: IRouter = Router();

router.get("/payments/history", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const rows = await db
    .select()
    .from(marketplacePaymentsTable)
    .where(or(
      eq(marketplacePaymentsTable.customerId, profile.id),
      eq(marketplacePaymentsTable.vendorId, profile.id),
    ))
    .orderBy(desc(marketplacePaymentsTable.createdAt));

  res.json({ payments: rows.map(serializeMarketplacePayment) });
});

export default router;
