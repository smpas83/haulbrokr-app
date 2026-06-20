import { describe, it, expect } from "vitest";

import { liveActivityToView, type LiveActivity } from "@/lib/liveJob";

/**
 * Coverage for the bin-notification deep-link mapping in `liveActivityToView`.
 *
 * Tappable bin notifications depend on three things this mapper produces from a
 * raw `/dashboard/activity` record:
 *   - a recognizable per-type `icon`
 *   - the category `"bin"` (so the feed treats the row as a bin row, not a
 *     generic job/alert row)
 *   - the `binOrderId` passthrough from `relatedBinOrderId` (the uuid the bins
 *     screen deep-links to via `?order=<id>`)
 *
 * A regression in the type→icon or type→category table, or in the id
 * passthrough, silently breaks tappable bin notifications — exactly what this
 * test guards. All four bin status types are exercised.
 */

const BASE = {
  description: "Your 20-yard roll-off was delivered.",
  createdAt: new Date().toISOString(),
  relatedBinOrderId: "bin-order-uuid-123",
} as const;

const BIN_CASES: ReadonlyArray<{
  type: LiveActivity["type"];
  icon: string;
}> = [
  { type: "bin_confirmed", icon: "check-circle" },
  { type: "bin_delivered", icon: "package" },
  { type: "bin_picked_up", icon: "truck" },
  { type: "bin_cancelled", icon: "x-circle" },
];

describe("liveActivityToView — bin notifications", () => {
  BIN_CASES.forEach(({ type, icon }, i) => {
    it(`maps ${type} to the bin category, its icon, and passes the order id through`, () => {
      const view = liveActivityToView({
        id: i + 1,
        type,
        ...BASE,
      });

      expect(view.type).toBe("bin");
      expect(view.icon).toBe(icon);
      expect(view.binOrderId).toBe("bin-order-uuid-123");
      expect(view.id).toBe(`act-${i + 1}`);
      expect(view.text).toBe(BASE.description);
    });
  });

  it("leaves binOrderId null when the record has no related bin order", () => {
    const view = liveActivityToView({
      id: 99,
      type: "bin_confirmed",
      description: "Confirmed",
      createdAt: new Date().toISOString(),
    });

    expect(view.type).toBe("bin");
    expect(view.binOrderId).toBeNull();
  });
});
