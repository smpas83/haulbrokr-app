import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { geocodeAddressCached, reverseGeocodeAddressCached, resetGeocodeCacheForTests } from "./geocodeCache";

describe("geocodeCache", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetGeocodeCacheForTests();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("does not call Nominatim in production when Google key is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.GOOGLE_MAPS_API_KEY;

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await geocodeAddressCached("123 Main St, Dallas, TX");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses Google Geocoding API when GOOGLE_MAPS_API_KEY is set", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "AIzaTestKey";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ geometry: { location: { lat: 32.7767, lng: -96.797 } } }],
      }),
    } as Response);

    const result = await geocodeAddressCached("123 Main St, Dallas, TX");
    expect(result).toEqual({ latitude: 32.7767, longitude: -96.797 });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("maps.googleapis.com/maps/api/geocode/json"),
    );
  });

  it("reverse geocodes via Google Geocoding API", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "AIzaTestKey";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ formatted_address: "123 Main St, Dallas, TX 75201, USA" }],
      }),
    } as Response);

    const address = await reverseGeocodeAddressCached(32.7767, -96.797);
    expect(address).toBe("123 Main St, Dallas, TX 75201, USA");
  });

  it("returns null for reverse geocode when Google key is missing", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const address = await reverseGeocodeAddressCached(32.7767, -96.797);
    expect(address).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
