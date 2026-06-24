import { describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/apiFetch";

function mockJsonResponse(body: unknown, init?: ResponseInit) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      ...init,
    }),
  );
}

describe("apiFetch", () => {
  it("prefixes app API paths and includes same-origin credentials", async () => {
    const fetchMock = vi.fn(() => mockJsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Downtown Office" }),
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/projects");
    expect(options).toMatchObject({ credentials: "include", method: "POST" });
    expect((options?.headers as Headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("does not double-prefix paths that already include /api", async () => {
    const fetchMock = vi.fn(() => mockJsonResponse({ connected: false }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/quickbooks/status");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/quickbooks/status",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
