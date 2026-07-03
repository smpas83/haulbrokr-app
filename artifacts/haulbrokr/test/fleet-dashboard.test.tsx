import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@workspace/api-client-react", () => ({
  useGetMyProfile: () => ({
    data: { role: "provider", companyName: "Acme Hauling", organizationId: 1 },
  }),
  useGetAccountStatus: () => ({
    data: { w9Status: "verified", insuranceStatus: "verified", dotCdlStatus: "verified" },
  }),
  useGetDashboardStats: () => ({
    data: { activeJobs: 2, completedJobs: 5, totalRevenue: 12000, pendingBids: 1 },
    isLoading: false,
  }),
  useGetDashboardActivity: () => ({
    data: [
      {
        id: 1,
        type: "job_completed",
        description: "Job #42 completed.",
        relatedId: 42,
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useListTrucks: () => ({
    data: [
      {
        id: 1,
        truckNumber: "101",
        truckType: "dump_truck",
        capacityTons: 20,
        ratePerHour: 150,
        isAvailable: false,
        assignedDriverId: 10,
        coiStatus: "active",
        ownerId: 1,
        ownerCompany: "Acme",
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useListJobs: () => ({
    data: [
      {
        id: 42,
        status: "in_progress",
        materialType: "gravel",
        pickupAddress: "123 Quarry Rd",
        deliveryAddress: "456 Site Ave",
        scheduledDate: new Date().toISOString(),
        startTime: "08:00",
        trucksAssigned: 1,
        providerCompany: "Acme Hauling",
        customerCompany: "BuildCo",
        ratePerHour: 150,
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useListOrgMembers: () => ({
    data: {
      members: [{ id: 10, role: "driver", contactName: "Sam Driver" }],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useGetWallet: () => ({
    data: {
      availableBalance: 5000,
      pendingBalance: 1200,
      lifetimeEarnings: 50000,
      payoutAccount: { connected: true, payoutsEnabled: true, bankLast4: "1234" },
      transactions: [
        { id: "1", type: "earning", description: "Job payout", amount: 800, status: "completed", createdAt: new Date().toISOString() },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useGetOrganizationComplianceStatus: () => ({
    data: {
      w9Status: "verified",
      insuranceStatus: "verified",
      dotCdlStatus: "verified",
      payoutStatus: "verified",
      canBid: true,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useGetCompliance: () => ({
    data: { status: "verified" },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useListDumpSites: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: { fullName: "Fleet Owner" } }),
}));

import FleetDashboard from "@/pages/fleet/FleetDashboard";

describe("Fleet Owner Dashboard", () => {
  it("renders fleet KPI ribbon with fleet size", () => {
    render(<FleetDashboard />);
    expect(screen.getByText("Fleet Size")).toBeTruthy();
    expect(screen.getByText("Acme Hauling")).toBeTruthy();
  });

  it("renders fleet grid with truck number", () => {
    render(<FleetDashboard />);
    expect(screen.getByText("#101")).toBeTruthy();
    expect(screen.getAllByText("Sam Driver").length).toBeGreaterThan(0);
  });

  it("renders live fleet map section", () => {
    render(<FleetDashboard />);
    expect(screen.getByText("Live Fleet Map")).toBeTruthy();
  });

  it("renders revenue and compliance panels", () => {
    render(<FleetDashboard />);
    expect(screen.getByText("Revenue")).toBeTruthy();
    expect(screen.getByText("Compliance")).toBeTruthy();
  });
});

describe("Dashboard routing — provider fleet command center", () => {
  it("routes providers to fleet dashboard from dashboard page", async () => {
    const DashboardPage = (await import("@/pages/dashboard")).default;
    render(<DashboardPage />);
    expect(screen.getByText("Live Fleet Map")).toBeTruthy();
    expect(screen.queryByText("Post Job Request")).toBeNull();
  });
});
