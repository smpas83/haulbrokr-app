/**
 * Broker-fee model: the customer is billed the work value plus the platform fee.
 * The provider receives the work value, while HaulBrokr retains the fee.
 */
export function computeBreakdown(ratePerHour: number, hours: number, feeRate: number) {
  const base = Math.round(ratePerHour * hours * 100) / 100;
  const fee = Math.round(base * feeRate * 100) / 100;
  const gross = Math.round((base + fee) * 100) / 100;
  return { base, fee, gross };
}
