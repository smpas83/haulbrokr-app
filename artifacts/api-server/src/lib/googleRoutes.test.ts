import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  decodePolyline,
  haversineMiles,
  computeDrivingRoute,
  computeDrivingDistances,
  formatEtaLabel,
} from "./googleRoutes";

describe("googleRoutes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: "development" };
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("decodes a known encoded polyline", () => {
    const points = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(points.length).toBeGreaterThan(1);
    expect(points[0].latitude).toBeCloseTo(38.5, 1);
    expect(points[0].longitude).toBeCloseTo(-120.2, 1);
  });

  it("haversineMiles returns expected distance for same point", () => {
    const p = { latitude: 32.7767, longitude: -96.797 };
    expect(haversineMiles(p, p)).toBe(0);
  });

  it("computeDrivingRoute falls back to haversine in development without API key", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const origin = { latitude: 32.7767, longitude: -96.797 };
    const dest = { latitude: 32.8998, longitude: -97.0403 };
    const route = await computeDrivingRoute(origin, dest);
    expect(route.source).toBe("haversine_dev_fallback");
    expect(route.distanceMiles).toBeGreaterThan(0);
    expect(route.polyline.length).toBe(2);
  });

  it("computeDrivingRoute uses Google Routes API when key is set", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [
          {
            duration: "900s",
            staticDuration: "840s",
            distanceMeters: 16093,
            polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
          },
        ],
      }),
    } as Response);

    const route = await computeDrivingRoute(
      { latitude: 32.7767, longitude: -96.797 },
      { latitude: 32.8998, longitude: -97.0403 },
    );
    expect(route.source).toBe("google_routes");
    expect(route.distanceMiles).toBe(10);
    expect(route.durationSeconds).toBe(900);
    expect(route.polyline.length).toBeGreaterThan(1);
  });

  it("computeDrivingDistances uses Distance Matrix when key is set", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rows: [
          {
            elements: [
              { status: "OK", distance: { value: 8046 }, duration: { value: 600 } },
            ],
          },
        ],
      }),
    } as Response);

    const results = await computeDrivingDistances(
      { latitude: 32.7767, longitude: -96.797 },
      [{ latitude: 32.8998, longitude: -97.0403 }],
    );
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("google_distance_matrix");
    expect(results[0].distanceMiles).toBe(5);
  });

  it("formatEtaLabel shows minutes for near-term ETA", () => {
    const iso = new Date(Date.now() + 25 * 60_000).toISOString();
    expect(formatEtaLabel(iso)).toBe("25 min");
  });
});
