import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminComplianceScreen from "@/app/admin-compliance";
import AdminCreditScreen from "@/app/admin-credit";

/**
 * End-to-end coverage for the mobile admin review screens. We exercise the real
 * screens, the real useLiveApi hooks and the real React Query wiring, mocking
 * only the network boundary (global.fetch) and the native modules that cannot
 * run under jsdom (stubbed via vitest.config aliases). This proves an admin can
 * approve/reject from mobile, that a rejection requires a reason, that the list
 * refetches after a review action, and that non-admins are blocked.
 */

type Handler = (ctx: { path: string; method: string; body: any }) => {
  ok?: boolean;
  status?: number;
  body?: any;
};

interface Call {
  path: string;
  method: string;
  body: any;
}

let calls: Call[];

function mockApi(handler: Handler) {
  calls = [];
  global.fetch = vi.fn(async (url: any, opts: any = {}) => {
    const u = new URL(String(url));
    const path = u.pathname.replace(/^\/api/, "");
    const method = (opts.method ?? "GET").toUpperCase();
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ path, method, body });
    const res = handler({ path, method, body });
    const ok = res.ok ?? true;
    return {
      ok,
      status: res.status ?? (ok ? 200 : 400),
      statusText: ok ? "OK" : "Error",
      json: async () => res.body ?? null,
      text: async () => (res.body != null ? JSON.stringify(res.body) : ""),
    } as any;
  }) as any;
}

function renderScreen(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function complianceItem(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    profileId: 42,
    dotNumber: "DOT-123",
    mcNumber: "MC-456",
    cdlNumber: "CDL-789",
    cdlState: "TX",
    cdlClass: "A",
    cdlExpiry: null,
    fmcsaAuthority: "pending",
    insuranceActive: "pending",
    dotOperatingStatus: "pending",
    notSuspended: "pending",
    safetyRating: null,
    status: "pending",
    reviewNote: null,
    submittedAt: "2026-06-16T00:00:00.000Z",
    profile: {
      id: 42,
      companyName: "Acme Trucking",
      contactName: "Jane Hauler",
      email: "jane@acme.test",
      phone: null,
      city: "Austin",
      state: "TX",
      role: "provider",
    },
    ...overrides,
  };
}

function creditItem(overrides: Record<string, any> = {}) {
  return {
    id: 5,
    profileId: 77,
    wantsInvoicing: true,
    tradeReferences: "Ref A, Ref B",
    bankReference: "First National",
    estimatedMonthlySpend: 25000,
    status: "pending",
    reviewNote: null,
    createdAt: "2026-06-16T00:00:00.000Z",
    profile: {
      id: 77,
      companyName: "BuildCo LLC",
      contactName: "Sam Builder",
      email: "sam@buildco.test",
      phone: null,
      city: "Dallas",
      state: "TX",
      role: "customer",
    },
    ...overrides,
  };
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals?.();
});

describe("AdminComplianceScreen (carrier review)", () => {
  it("blocks a non-admin with the Access Restricted state", async () => {
    mockApi(({ path }) => {
      if (path === "/admin/access") return { body: { isAdmin: false } };
      return { body: [] };
    });

    renderScreen(<AdminComplianceScreen />);

    await waitFor(() => {
      expect(screen.getByText("Access Restricted")).toBeTruthy();
    });
    // The compliance list must never be fetched for a non-admin.
    expect(calls.some((c) => c.path === "/admin/compliance")).toBe(false);
  });

  it("shows pending carrier records to an admin with approve/reject actions", async () => {
    mockApi(({ path }) => {
      if (path === "/admin/access") return { body: { isAdmin: true, permissions: ["compliance"] } };
      if (path === "/admin/compliance") return { body: [complianceItem()] };
      return { body: null };
    });

    renderScreen(<AdminComplianceScreen />);

    await waitFor(() => {
      expect(screen.getByText("Acme Trucking")).toBeTruthy();
    });
    expect(screen.getByText("1 awaiting review")).toBeTruthy();
    expect(screen.getByText("Approve Carrier")).toBeTruthy();
    expect(screen.getByText("Reject")).toBeTruthy();
  });

  it("approves a carrier and refetches the list afterwards", async () => {
    let listCalls = 0;
    mockApi(({ path, method }) => {
      if (path === "/admin/access") return { body: { isAdmin: true, permissions: ["compliance"] } };
      if (path === "/admin/compliance" && method === "GET") {
        listCalls += 1;
        const status = listCalls === 1 ? "pending" : "verified";
        return { body: [complianceItem({ status })] };
      }
      if (path === "/admin/compliance/42" && method === "PATCH") {
        return { body: complianceItem({ status: "verified" }) };
      }
      return { body: null };
    });

    renderScreen(<AdminComplianceScreen />);

    await waitFor(() => expect(screen.getByText("Approve Carrier")).toBeTruthy());

    fireEvent.click(screen.getByText("Approve Carrier"));

    // PATCH approve is sent with the right action.
    await waitFor(() => {
      const patch = calls.find((c) => c.path === "/admin/compliance/42" && c.method === "PATCH");
      expect(patch).toBeTruthy();
      expect(patch!.body).toMatchObject({ action: "approve" });
    });

    // The list query is invalidated → refetched (GET called at least twice).
    await waitFor(() => {
      const gets = calls.filter((c) => c.path === "/admin/compliance" && c.method === "GET");
      expect(gets.length).toBeGreaterThanOrEqual(2);
    });

    // After the refetch the carrier reads back as Verified.
    await waitFor(() => expect(screen.getByText("Verified")).toBeTruthy());
  });

  it("requires a reason before a rejection is submitted", async () => {
    mockApi(({ path, method }) => {
      if (path === "/admin/access") return { body: { isAdmin: true, permissions: ["compliance"] } };
      if (path === "/admin/compliance" && method === "GET") return { body: [complianceItem()] };
      if (path === "/admin/compliance/42" && method === "PATCH") {
        return { body: complianceItem({ status: "rejected", reviewNote: "Insurance lapsed" }) };
      }
      return { body: null };
    });

    renderScreen(<AdminComplianceScreen />);

    await waitFor(() => expect(screen.getByText("Reject")).toBeTruthy());

    // Enter reject mode → a reason input appears.
    fireEvent.click(screen.getByText("Reject"));
    const input = await screen.findByPlaceholderText(/Reason for rejection/i);

    // Confirm while empty: the button is disabled, so no PATCH goes out.
    fireEvent.click(screen.getByText("Confirm"));
    await new Promise((r) => setTimeout(r, 30));
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);

    // Provide a reason, then confirm: PATCH carries the rejection note.
    fireEvent.change(input, { target: { value: "Insurance lapsed" } });
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => {
      const patch = calls.find((c) => c.path === "/admin/compliance/42" && c.method === "PATCH");
      expect(patch).toBeTruthy();
      expect(patch!.body).toMatchObject({ action: "reject", note: "Insurance lapsed" });
    });
  });
});

describe("AdminCreditScreen (credit review)", () => {
  it("blocks a non-admin with the Access Restricted state", async () => {
    mockApi(({ path }) => {
      if (path === "/admin/access") return { body: { isAdmin: false } };
      return { body: [] };
    });

    renderScreen(<AdminCreditScreen />);

    await waitFor(() => {
      expect(screen.getByText("Access Restricted")).toBeTruthy();
    });
    expect(calls.some((c) => c.path === "/admin/credit-applications")).toBe(false);
  });

  it("shows pending credit applications to an admin", async () => {
    mockApi(({ path }) => {
      if (path === "/admin/access") return { body: { isAdmin: true, permissions: ["credit"] } };
      if (path === "/admin/credit-applications") return { body: [creditItem()] };
      return { body: null };
    });

    renderScreen(<AdminCreditScreen />);

    await waitFor(() => expect(screen.getByText("BuildCo LLC")).toBeTruthy());
    expect(screen.getByText("1 awaiting review")).toBeTruthy();
    expect(screen.getByText("Approve Credit")).toBeTruthy();
  });

  it("rejects a credit application with a required reason", async () => {
    mockApi(({ path, method }) => {
      if (path === "/admin/access") return { body: { isAdmin: true, permissions: ["credit"] } };
      if (path === "/admin/credit-applications" && method === "GET") return { body: [creditItem()] };
      if (path === "/admin/credit-applications/77" && method === "PATCH") {
        return { body: creditItem({ status: "rejected", reviewNote: "Thin references" }) };
      }
      return { body: null };
    });

    renderScreen(<AdminCreditScreen />);

    await waitFor(() => expect(screen.getByText("Reject")).toBeTruthy());

    fireEvent.click(screen.getByText("Reject"));
    const input = await screen.findByPlaceholderText(/Reason for rejection/i);

    // Empty confirm is a no-op (disabled button).
    fireEvent.click(screen.getByText("Confirm"));
    await new Promise((r) => setTimeout(r, 30));
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);

    fireEvent.change(input, { target: { value: "Thin references" } });
    fireEvent.click(screen.getByText("Confirm"));

    await waitFor(() => {
      const patch = calls.find((c) => c.path === "/admin/credit-applications/77" && c.method === "PATCH");
      expect(patch).toBeTruthy();
      expect(patch!.body).toMatchObject({ action: "reject", note: "Thin references" });
    });
  });
});
