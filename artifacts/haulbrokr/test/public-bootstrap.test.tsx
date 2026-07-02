import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

async function renderAppWithoutClerk(path: string) {
  vi.resetModules();
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
  vi.doMock("@clerk/react", () => {
    throw new Error("@clerk/react should not load during public bootstrap");
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  window.history.replaceState({}, "", path);
  const { default: App } = await import("@/App");
  render(<App />);
}

afterEach(() => {
  vi.doUnmock("@clerk/react");
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", "/");
});

describe("public bootstrap without Clerk", () => {
  it.each([
    ["/", "Premium hauling marketplace"],
    ["/landing", "Premium hauling marketplace"],
    ["/about", "Our focus"],
    ["/contact", "Email support"],
    ["/privacy", "Information we collect"],
    ["/terms", "Marketplace use"],
    ["/support", "Common help topics"],
  ])("renders %s without importing Clerk", async (path, expectedText) => {
    await renderAppWithoutClerk(path);

    expect(await screen.findByText(expectedText)).toBeTruthy();
    expect(document.body.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("shows authentication as unavailable on auth routes without Clerk", async () => {
    await renderAppWithoutClerk("/sign-in");

    expect(
      await screen.findByRole("heading", {
        name: "Sign-in is temporarily unavailable.",
      }),
    ).toBeTruthy();
    expect(screen.getByText(/VITE_CLERK_PUBLISHABLE_KEY/)).toBeTruthy();
  });

  it("redirects authenticated routes to unavailable sign-in without Clerk", async () => {
    await renderAppWithoutClerk("/dashboard");

    await waitFor(() => {
      expect(window.location.pathname).toBe("/sign-in");
    });
    expect(window.location.search).toBe(
      `?redirect_url=${encodeURIComponent("/dashboard")}`,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Sign-in is temporarily unavailable.",
      }),
    ).toBeTruthy();
  });

  it("surfaces missing Clerk status in the integrations panel", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ connected: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const { default: IntegrationsPage } = await import("@/pages/integrations");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <IntegrationsPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Runtime configuration")).toBeTruthy();
    expect(screen.getByText("Clerk authentication")).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.getByText(/VITE_CLERK_PUBLISHABLE_KEY/)).toBeTruthy();
  });
});
