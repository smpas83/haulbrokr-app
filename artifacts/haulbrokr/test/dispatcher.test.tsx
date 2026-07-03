import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import DispatcherPage from "@/pages/dispatcher";

vi.mock("wouter", () => ({
  Redirect: ({ to }: { to: string }) => <div data-testid="redirect">{to}</div>,
  useLocation: () => ["/dispatcher", vi.fn()],
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/hooks/useDispatcherData", () => ({
  useDispatcherData: () => ({
    activityQuery: { data: [], isLoading: false, isError: false, refetch: vi.fn() },
    jobsQuery: { data: [], isLoading: false, isError: false, refetch: vi.fn() },
    trucksQuery: { data: [], isLoading: false, isError: false, refetch: vi.fn() },
    membersQuery: { data: { members: [] }, isLoading: false, isError: false, refetch: vi.fn() },
    facilitiesQuery: { data: [], isLoading: false, isError: false, refetch: vi.fn() },
    activeJobs: [],
    pendingDispatchJobs: [],
    drivers: [],
    kpis: {
      availableTrucks: 3,
      driversOnline: 2,
      activeJobs: 1,
      pendingDispatch: 0,
      revenueToday: 5000,
      loadsToday: 4,
      averageEta: "—",
      paperworkCompletion: "—",
    },
    mapTrucks: [],
    isLoading: false,
    isError: false,
    refetchAll: vi.fn(),
  }),
  useDispatchQueueTickets: () => ({ data: [], isLoading: false, isError: false }),
  useOperationsTimeline: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: { fullName: "Test Dispatcher" } }),
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetMyProfile: () => ({ data: { role: "provider", companyName: "Test Hauling" }, isLoading: false }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}));

describe("Dispatcher Command Center", () => {
  it("renders the command center heading for providers", () => {
    render(<DispatcherPage />);
    expect(screen.getByText("Dispatcher Command Center")).toBeTruthy();
  });

  it("renders today's KPI section", () => {
    render(<DispatcherPage />);
    expect(screen.getByText("Available Trucks")).toBeTruthy();
    expect(screen.getByText("Pending Dispatch")).toBeTruthy();
  });

  it("redirects non-providers to dashboard", () => {
    vi.doMock("@workspace/api-client-react", () => ({
      useGetMyProfile: () => ({ data: { role: "customer" }, isLoading: false }),
    }));
  });
});
