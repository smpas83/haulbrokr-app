import { describe, it, expect } from "vitest";
import { haversineMiles } from "./googleMapsService";

describe("googleMapsService", () => {
  it("computes haversine distance in miles", () => {
    const dallas = { latitude: 32.7767, longitude: -96.797 };
    const houston = { latitude: 29.7604, longitude: -95.3698 };
    const miles = haversineMiles(dallas, houston);
    expect(miles).toBeGreaterThan(200);
    expect(miles).toBeLessThan(260);
  });
});
