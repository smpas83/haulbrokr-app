import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  deriveJobPaymentStatusAfterRefund,
  mapStripeRefundStatus,
  sumRefundedForJob,
} from "./refunds";

describe("refunds lib helpers", () => {
  it("maps Stripe refund statuses", () => {
    expect(mapStripeRefundStatus("succeeded")).toBe("succeeded");
    expect(mapStripeRefundStatus("failed")).toBe("failed");
    expect(mapStripeRefundStatus("canceled")).toBe("canceled");
    expect(mapStripeRefundStatus("pending")).toBe("pending");
    expect(mapStripeRefundStatus(undefined)).toBe("pending");
  });

  it("derives payment status from refunded totals", () => {
    expect(deriveJobPaymentStatusAfterRefund("100.00", 100)).toBe("refunded");
    expect(deriveJobPaymentStatusAfterRefund("100.00", 40)).toBe(
      "partially_refunded",
    );
    expect(deriveJobPaymentStatusAfterRefund("100.00", 0)).toBe("released");
  });
});
