import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetGoogleMapsKeyCacheForTests,
  resolveGoogleMapsApiKey,
} from "@/lib/googleMapsKey";

function mockJsonResponse(body: unknown, init?: ResponseInit) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      ...init,
    }),
  );
}

describe("resolveGoogleMapsApiKey", () => {
  afterEach(() => {
    resetGoogleMapsKeyCacheForTests();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses EXPO_PUBLIC_GOOGLE_MAPS_API_KEY when configured", async () => {
    vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY", "expo-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveGoogleMapsApiKey()).resolves.toBe("expo-key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches /api/map/config when no env key is configured", async () => {
    vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    const fetchMock = vi.fn(() =>
      mockJsonResponse({ googleMapsApiKey: "runtime-key" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveGoogleMapsApiKey()).resolves.toBe("runtime-key");
    expect(fetchMock).toHaveBeenCalledWith("https://test.local/api/map/config");
  });

  it("throws when the runtime config endpoint returns an error", async () => {
    vi.stubEnv("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        mockJsonResponse(
          { error: "GOOGLE_MAPS_API_KEY not configured" },
          { status: 500 },
        ),
      ),
    );

    await expect(resolveGoogleMapsApiKey()).rejects.toThrow(
      "GOOGLE_MAPS_API_KEY not configured",
    );
  });
});
