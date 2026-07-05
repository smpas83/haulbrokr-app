import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, jobsTable, factoringRequestsTable, payoutAccountsTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { GetWalletResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Provider/driver side only — customers do not have an earnings wallet.
const PROVIDER_ROLES = new Set(["provider", "driver"]);

// Money is settled to the provider once a job's payment is paid or released.
const AVAILABLE_STATUSES = new Set(["paid", "released"]);
// Refunded jobs claw back provider earnings from the available balance.
const REFUNDED_STATUSES = new Set(["refunded", "partially_refunded"]);
// Earned but not yet released to the provider.
const PENDING_STATUSES = new Set(["unpaid", "invoiced", "requires_action"]);

router.get("/wallet", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (!PROVIDER_ROLES.has(profile.role)) {
    res.status(403).json({ error: "Only providers and drivers have a wallet." });
    return;
  }

  const jobs = await db.select().from(jobsTable)
    .where(eq(jobsTable.providerId, profile.id));
  const factoringRows = await db.select().from(factoringRequestsTable)
    .where(eq(factoringRequestsTable.providerId, profile.id));
  const [payoutRow] = await db.select().from(payoutAccountsTable)
    .where(eq(payoutAccountsTable.profileId, profile.id));

  let availableBalance = 0;
  let pendingBalance = 0;
  const transactions: Array<{
    id: string;
    type: "payout" | "factoring" | "earning";
    description: string;
    amount: number;
    status: string;
    createdAt: Date | string;
  }> = [];

  for (const job of jobs) {
    const net = job.providerNetAmount != null ? parseFloat(job.providerNetAmount) : 0;
    const gross = job.customerTotalAmount != null ? parseFloat(job.customerTotalAmount) : 0;
    const refunded = job.refundedAmount != null ? parseFloat(job.refundedAmount) : 0;
    const refundRatio = gross > 0 ? Math.min(1, refunded / gross) : 0;
    const netAfterRefund = net * (1 - refundRatio);

    if (AVAILABLE_STATUSES.has(job.paymentStatus)) {
      availableBalance += net;
    } else if (REFUNDED_STATUSES.has(job.paymentStatus)) {
      availableBalance += Math.max(0, netAfterRefund);
    } else if (job.status === "completed" && PENDING_STATUSES.has(job.paymentStatus)) {
      pendingBalance += net;
    }
    // A completed job with a net amount is an earning line on the ledger.
    if (job.status === "completed" && net > 0) {
      transactions.push({
        id: `earning-${job.id}`,
        type: "earning",
        description: `Earnings — ${job.materialType} job #${job.id}`,
        amount: net,
        status: job.paymentStatus,
        createdAt: job.completedAt ?? job.createdAt,
      });
      if (refunded > 0) {
        const clawback = net - Math.max(0, netAfterRefund);
        transactions.push({
          id: `refund-${job.id}`,
          type: "payout",
          description: `Refund clawback — ${job.materialType} job #${job.id}`,
          amount: -clawback,
          status: job.paymentStatus,
          createdAt: job.releasedAt ?? job.completedAt ?? job.createdAt,
        });
      }
    }
  }

  for (const f of factoringRows) {
    transactions.push({
      id: `factoring-${f.id}`,
      type: "factoring",
      description: `Factoring advance — job #${f.jobId}`,
      amount: parseFloat(f.netAmount),
      status: f.status,
      createdAt: f.requestedAt ?? f.createdAt,
    });
  }

  transactions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const lifetimeEarnings = availableBalance + pendingBalance;

  res.json(GetWalletResponse.parse({
    availableBalance,
    pendingBalance,
    lifetimeEarnings,
    payoutAccount: {
      connected: !!payoutRow?.stripeAccountId,
      payoutsEnabled: (payoutRow?.payoutsEnabled ?? 0) === 1,
      bankLast4: payoutRow?.accountLast4 ? payoutRow.accountLast4 : null,
    },
    transactions,
  }));
});

export default router;
