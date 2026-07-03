import { describe, it, expect } from "vitest";
import { distanceMiles } from "../lib/geocode";

describe("distanceMiles", () => {
  it("returns ~0 for identical coordinates", () => {
    const dallas = { latitude: 32.7767, longitude: -96.797 };
    expect(distanceMiles(dallas, dallas)).toBeLessThan(0.01);
  });

  it("returns a positive distance between two US cities", () => {
    const dallas = { latitude: 32.7767, longitude: -96.797 };
    const fortWorth = { latitude: 32.7555, longitude: -97.3308 };
    const miles = distanceMiles(dallas, fortWorth);
    expect(miles).toBeGreaterThan(20);
    expect(miles).toBeLessThan(60);
  });
});
