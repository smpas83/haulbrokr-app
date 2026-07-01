import {
  customerInvoicesTable,
  db,
  financialAuditLogsTable,
  invoiceItemsTable,
  marketplaceTransactionsTable,
  vendorSettlementsTable,
  type Job,
} from "@workspace/db";
import {
  computeDynamicQuote,
  type PricingInput,
  type PricingQuote,
} from "./dynamicPricing";
import { moneyToCents } from "./marketplacePayments";

export type FinancialInput = PricingInput & {
  quantityTons?: number | null;
  loads?: number | null;
  bridgeTolls?: number | null;
  permitFees?: number | null;
  taxes?: number | null;
  fees?: number | null;
  fuelSurchargeAmount?: number | null;
  region?: string | null;
};

export type FinancialCalculation = PricingQuote & {
  taxes: number;
  fees: number;
  fuelSurcharge: number;
  bridgeTolls: number;
  permitFees: number;
  finalInvoice: number;
  netMarketplaceRevenue: number;
  pricingExplanation: PricingQuote["pricingBreakdown"];
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function computeFinancialQuote(
  input: FinancialInput,
): Promise<FinancialCalculation> {
  const quote = await computeDynamicQuote(input);
  const taxes = roundMoney(input.taxes ?? 0);
  const fees = roundMoney(input.fees ?? 0);
  const fuelSurcharge = roundMoney(input.fuelSurchargeAmount ?? 0);
  const bridgeTolls = roundMoney(input.bridgeTolls ?? 0);
  const permitFees = roundMoney(input.permitFees ?? 0);
  const finalInvoice = roundMoney(
    quote.customerTotal + taxes + fees + fuelSurcharge,
  );
  return {
    ...quote,
    customerQuote: finalInvoice,
    customerTotal: finalInvoice,
    taxes,
    fees,
    fuelSurcharge,
    bridgeTolls,
    permitFees,
    finalInvoice,
    netMarketplaceRevenue: quote.marketplaceRevenue + fees,
    pricingExplanation: quote.pricingBreakdown,
  };
}

export function financialJobUpdate(calculation: FinancialCalculation) {
  return {
    customerTotalAmount: String(calculation.customerTotal),
    providerNetAmount: String(calculation.vendorPayout),
    platformFeeAmount: String(calculation.platformCommission),
    driverPayoutAmount: String(calculation.driverPayout),
    taxesAmount: String(calculation.taxes),
    feesAmount: String(
      calculation.fees + calculation.bridgeTolls + calculation.permitFees,
    ),
    fuelSurchargeAmount: String(calculation.fuelSurcharge),
    gmvAmount: String(calculation.gmv),
    netMarketplaceRevenueAmount: String(calculation.netMarketplaceRevenue),
  };
}

function invoiceNumber(jobId: number, at = new Date()): string {
  return `HB-${at.getFullYear()}-${String(jobId).padStart(6, "0")}`;
}

export async function createCustomerInvoiceForJob(job: Job): Promise<void> {
  if (
    !job.customerTotalAmount ||
    !job.providerNetAmount ||
    !job.platformFeeAmount
  )
    return;
  const taxes = Number.parseFloat(job.taxesAmount ?? "0");
  const fees = Number.parseFloat(job.feesAmount ?? "0");
  const total = Number.parseFloat(job.customerTotalAmount);
  const [invoice] = await db
    .insert(customerInvoicesTable)
    .values({
      jobId: job.id,
      customerId: job.customerId,
      invoiceNumber: invoiceNumber(job.id),
      status: job.paidAt ? "paid" : "open",
      subtotal: job.providerNetAmount,
      taxes: String(taxes),
      fees: String(fees),
      totalAmount: job.customerTotalAmount,
      outstandingBalance: job.paidAt ? "0" : job.customerTotalAmount,
      dueDate: job.paymentDueDate ?? null,
      paidAt: job.paidAt ?? null,
      statementJson: {
        jobId: job.id,
        gmv: job.gmvAmount ?? job.customerTotalAmount,
        netMarketplaceRevenue:
          job.netMarketplaceRevenueAmount ?? job.platformFeeAmount,
      },
    })
    .returning();

  await db.insert(invoiceItemsTable).values([
    {
      invoiceId: invoice.id,
      kind: "vendor_payout",
      description: `Hauling services for job #${job.id}`,
      unitAmount: job.providerNetAmount,
      totalAmount: job.providerNetAmount,
    },
    {
      invoiceId: invoice.id,
      kind: "platform_commission",
      description: "HaulBrokr marketplace commission",
      unitAmount: job.platformFeeAmount,
      totalAmount: job.platformFeeAmount,
    },
    ...(taxes > 0
      ? [
          {
            invoiceId: invoice.id,
            kind: "tax",
            description: "Taxes",
            unitAmount: String(taxes),
            totalAmount: String(taxes),
          },
        ]
      : []),
    ...(fees > 0
      ? [
          {
            invoiceId: invoice.id,
            kind: "fee",
            description: "Fees and surcharges",
            unitAmount: String(fees),
            totalAmount: String(fees),
          },
        ]
      : []),
  ]);
}

export async function createVendorSettlementForJob(job: Job): Promise<void> {
  if (!job.providerNetAmount) return;
  await db.insert(vendorSettlementsTable).values({
    jobId: job.id,
    vendorId: job.providerId,
    status: job.paymentStatus === "released" ? "paid" : "approved_invoice",
    approvedInvoiceAmount: job.providerNetAmount,
    pendingPayoutAmount:
      job.paymentStatus === "released" ? "0" : job.providerNetAmount,
    paidAmount: job.paymentStatus === "released" ? job.providerNetAmount : "0",
    driverPayoutAmount: job.driverPayoutAmount ?? "0",
    reconciliationStatus:
      job.paymentStatus === "released" ? "reconciled" : "unreconciled",
    metadata: {
      jobId: job.id,
      transferId: job.stripeTransferId,
    },
  });
}

export async function recordMarketplaceFinancialTransaction(input: {
  job: Job;
  type:
    | "customer_charge"
    | "vendor_payout"
    | "platform_commission"
    | "tax"
    | "fee"
    | "refund";
  amount: string | number | null | undefined;
  status?: "pending" | "succeeded" | "failed" | "cancelled";
  idempotencyKey: string;
  metadata?: unknown;
}): Promise<void> {
  const amountCents = moneyToCents(input.amount);
  if (amountCents == null) return;
  await db.insert(marketplaceTransactionsTable).values({
    jobId: input.job.id,
    customerId: input.job.customerId,
    vendorId: input.job.providerId,
    type: input.type,
    amountCents,
    status: input.status ?? "pending",
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata ?? null,
  });
}

export async function recordFinancialAudit(input: {
  actorProfileId?: number | null;
  action: string;
  entityType: string;
  entityId: string | number;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  idempotencyKey?: string | null;
}): Promise<void> {
  await db.insert(financialAuditLogsTable).values({
    actorProfileId: input.actorProfileId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: String(input.entityId),
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
  });
}
