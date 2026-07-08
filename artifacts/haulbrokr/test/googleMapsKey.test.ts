import { afterEach, describe, expect, it, vi } from "vitest";
import { resetGoogleMapsKeyCacheForTests, resolveGoogleMapsApiKey } from "@/lib/googleMapsKey";

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

  it("uses VITE_GOOGLE_MAPS_API_KEY when configured", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "vite-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveGoogleMapsApiKey()).resolves.toBe("vite-key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches /api/map/config when the Vite env key is missing", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    const fetchMock = vi.fn(() => mockJsonResponse({ googleMapsApiKey: "runtime-key" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveGoogleMapsApiKey()).resolves.toBe("runtime-key");
    expect(fetchMock).toHaveBeenCalledWith("/api/map/config");
  });

  it("throws when the runtime config endpoint returns an error", async () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(() => mockJsonResponse({ error: "GOOGLE_MAPS_API_KEY not configured" }, { status: 500 })));

    await expect(resolveGoogleMapsApiKey()).rejects.toThrow("GOOGLE_MAPS_API_KEY not configured");
  });
});
