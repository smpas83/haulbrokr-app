import { describe, it, expect } from "vitest";
import { buildDemoLoads, buildDemoMarketplace, buildDemoTrucks, buildEmptyMarketplace } from "./demoMarketplace";

describe("demoMarketplace", () => {
  it("generates 250 nationwide loads with coordinates", () => {
    const loads = buildDemoLoads(250);
    expect(loads).toHaveLength(250);
    for (const load of loads) {
      expect(load.latitude).toBeGreaterThan(24);
      expect(load.latitude).toBeLessThan(50);
      expect(load.longitude).toBeGreaterThan(-125);
      expect(load.longitude).toBeLessThan(-70);
      expect(load.pickupAddress.length).toBeGreaterThan(5);
    }
  });

  it("generates 150 trucks with motion fields", () => {
    const trucks = buildDemoTrucks(150);
    expect(trucks).toHaveLength(150);
    expect(trucks.some((t) => t.status === "available")).toBe(true);
    expect(trucks.some((t) => t.status === "en_route")).toBe(true);
  });

  it("buildEmptyMarketplace returns production-safe empty payload", () => {
    const payload = buildEmptyMarketplace();
    expect(payload.demoMode).toBe(false);
    expect(payload.loads).toEqual([]);
    expect(payload.trucks).toEqual([]);
    expect(payload.heatZones).toEqual([]);
    expect(payload.stats.openLoads).toBe(0);
  });
});
