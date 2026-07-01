import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// vi.mock calls below are hoisted above this import, so DashboardPage loads with
// its data hooks and charts already mocked.
import DashboardPage from "@/pages/dashboard";

/**
 * The dashboard activity feed must render a bin-status notification as a link
 * whose href is exactly `/bins?order=<relatedBinOrderId>` — the deep-link
 * contract the bins page reads to scroll to and highlight the right order. A
 * break in the `bin_*` type check or the href string silently makes the
 * notification non-tappable, so this asserts the rendered anchor directly.
 *
 * The dashboard's data hooks and charts are mocked: this test is only about the
 * activity-row → link mapping, not stats or chart rendering.
 */

const BIN_ORDER_ID = "11111111-2222-3333-4444-555555555555";

vi.mock("@workspace/api-client-react", () => ({
  useGetMyProfile: () => ({ data: { role: "customer", contactName: "Jamie" } }),
  useGetDashboardStats: () => ({
    data: { openRequests: 1, activeJobs: 2, completedJobs: 3, totalSpent: 4200 },
    isLoading: false,
  }),
  useGetDashboardActivity: () => ({
    data: [
      {
        id: 1,
        type: "bin_delivered",
        description: "Your 20-yard roll-off was delivered.",
        relatedBinOrderId: BIN_ORDER_ID,
        relatedId: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        type: "bid_accepted",
        description: "A provider accepted your bid.",
        relatedBinOrderId: null,
        relatedId: 7,
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useGetAccountStatus: () => ({ data: { profileComplete: true } }),
  useListNotifications: () => ({ data: { notifications: [] }, isLoading: false }),
}));

// recharts needs ResizeObserver/layout jsdom can't provide and is irrelevant
// here, so stub the pieces the dashboard imports.
vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", null, children);
  return {
    ResponsiveContainer: Stub,
    BarChart: Stub,
    Bar: Stub,
    XAxis: Stub,
    YAxis: Stub,
    Tooltip: Stub,
    PieChart: Stub,
    Pie: Stub,
    Cell: Stub,
    Legend: Stub,
  };
});

describe("Dashboard activity feed — bin notification deep-link", () => {
  it("renders a bin activity entry as a link to /bins?order=<id>", () => {
    render(<DashboardPage />);

    const row = screen.getByText("Your 20-yard roll-off was delivered.");
    const link = row.closest("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe(`/bins?order=${BIN_ORDER_ID}`);
  });

  it("does not turn a non-bin activity entry into a bins link", () => {
    render(<DashboardPage />);

    const row = screen.getByText("A provider accepted your bid.");
    const link = row.closest("a");
    // A bid_accepted row carries no bin order, so it must not link to /bins.
    if (link) {
      expect(link.getAttribute("href")).not.toContain("/bins?order=");
    }
  });
});
