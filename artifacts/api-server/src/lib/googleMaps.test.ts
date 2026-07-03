import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertValidLatLng,
  calculateTrafficAwareRoute,
  directions,
  distanceMeters,
  geocodeAddress,
  placesAutocomplete,
  routes,
} from "./googleMaps";

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "test-google-key";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("googleMaps service", () => {
  it("geocodes an address without exposing the key in responses", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [{
          formatted_address: "100 Main St, Birmingham, AL",
          place_id: "place_1",
          geometry: { location: { lat: 33.5, lng: -86.8 } },
        }],
      }),
    });

    const result = await geocodeAddress("100 Main St");

    expect(result).toEqual({
      formattedAddress: "100 Main St, Birmingham, AL",
      placeId: "place_1",
      location: { lat: 33.5, lng: -86.8 },
    });
    expect(JSON.stringify(result)).not.toContain("test-google-key");
    expect(fetchMock.mock.calls[0][0]).toContain("key=test-google-key");
  });

  it("maps Places autocomplete predictions", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        predictions: [{
          place_id: "p1",
          description: "100 Main St, Birmingham, AL",
          structured_formatting: { main_text: "100 Main St", secondary_text: "Birmingham, AL" },
        }],
      }),
    });

    await expect(placesAutocomplete("100 Ma")).resolves.toEqual([{
      placeId: "p1",
      description: "100 Main St, Birmingham, AL",
      mainText: "100 Main St",
      secondaryText: "Birmingham, AL",
    }]);
  });

  it("uses Routes API traffic-aware durations", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{
          distanceMeters: 12000,
          duration: "900s",
          staticDuration: "700s",
          polyline: { encodedPolyline: "encoded" },
        }],
      }),
    });

    const result = await routes({ lat: 33.5, lng: -86.8 }, { lat: 33.6, lng: -86.7 });

    expect(result.distanceMeters).toBe(12000);
    expect(result.durationSeconds).toBe(700);
    expect(result.trafficDurationSeconds).toBe(900);
    expect(result.encodedPolyline).toBe("encoded");
  });

  it("falls back to Directions API when Routes API fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "OK",
          routes: [{
            overview_polyline: { points: "legacy" },
            legs: [{
              distance: { value: 3000 },
              duration: { value: 360 },
              duration_in_traffic: { value: 420 },
            }],
          }],
        }),
      });

    const result = await calculateTrafficAwareRoute({ lat: 33.5, lng: -86.8 }, { lat: 33.6, lng: -86.7 });

    expect(result.encodedPolyline).toBe("legacy");
    expect(result.trafficDurationSeconds).toBe(420);
  });

  it("calculates local distance and validates coordinates", async () => {
    expect(() => assertValidLatLng({ lat: 91, lng: 0 })).toThrow(/Latitude/);
    expect(distanceMeters({ lat: 33.5, lng: -86.8 }, { lat: 33.5, lng: -86.8 })).toBe(0);
    await expect(directions({ address: "" }, { lat: 1, lng: 1 })).rejects.toThrow(/Address/);
  });
});
