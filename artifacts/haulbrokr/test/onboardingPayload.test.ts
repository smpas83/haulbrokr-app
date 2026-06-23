import { describe, it, expect } from "vitest";
import { buildCreateProfilePayload } from "@/lib/onboardingPayload";

describe("buildCreateProfilePayload", () => {
  it("sends invite code and pending company for drivers", () => {
    expect(
      buildCreateProfilePayload({
        role: "driver",
        inviteCode: "abc123",
        phone: "555-0100",
      }),
    ).toEqual({
      role: "driver",
      companyName: "Pending team assignment",
      contactName: undefined,
      phone: "555-0100",
      inviteCode: "ABC123",
    });
  });

  it("includes provider carrier fields", () => {
    const payload = buildCreateProfilePayload({
      role: "provider",
      companyName: "MW Hauling",
      mcNumber: "MC-1",
      equipmentTypes: ["end_dump", "super_10"],
    });
    expect(payload.role).toBe("provider");
    expect(payload.companyName).toBe("MW Hauling");
    expect(payload.equipmentTypes).toBe("end_dump,super_10");
  });
});
