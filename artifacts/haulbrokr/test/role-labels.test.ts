import { describe, it, expect } from "vitest";
import {
  getRoleLabel,
  MOBILE_NAV_PRIORITY,
  MOBILE_NAV_SHORT,
  ROLE_LABELS,
} from "@/lib/role-labels";

describe("role-labels", () => {
  it("returns human-readable role labels", () => {
    expect(getRoleLabel("customer")).toBe("Contractor");
    expect(getRoleLabel("provider")).toBe("Fleet Owner");
    expect(getRoleLabel("driver")).toBe("Driver");
    expect(getRoleLabel(null)).toBe("Member");
  });

  it("provides role-prioritized mobile nav", () => {
    expect(MOBILE_NAV_PRIORITY.provider).toContain("/fleet");
    expect(MOBILE_NAV_PRIORITY.customer).toContain("/requests");
    expect(MOBILE_NAV_SHORT["/dashboard"]).toBe("Home");
  });

  it("covers all known roles", () => {
    expect(Object.keys(ROLE_LABELS)).toEqual(
      expect.arrayContaining(["customer", "provider", "driver", "supervisor"]),
    );
  });
});
