import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import DispatcherPage from "@/pages/dispatcher";

const hookCalls = {
  listTrucks: vi.fn(),
  listJobs: vi.fn(),
  listRequests: vi.fn(),
  listDumpSites: vi.fn(),
  listJobStatusUpdates: vi.fn(),
};

vi.mock("@/components/ui/resizable", () => {
  const Panel = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResizablePanelGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    ResizablePanel: Panel,
    ResizableHandle: () => <div data-testid="resize-handle" />,
  };
});

vi.mock("@workspace/api-client-react", () => ({
  JobRequestInputMaterialType: {
    dirt: "dirt",
    gravel: "gravel",
    sand: "sand",
  },
  JobRequestInputTruckType: {
    standard: "standard",
    dump_truck: "dump_truck",
  },
  ListDumpSitesType: {
    landfill: "landfill",
    transfer_station: "transfer_station",
  },
  ListJobsStatus: {
    active: "active",
    awarded: "awarded",
    accepted: "accepted",
    in_progress: "in_progress",
    completed: "completed",
  },
  ListRequestsStatus: {
    open: "open",
    bid_received: "bid_received",
    bidding: "bidding",
    awarded: "awarded",
    accepted: "accepted",
    in_progress: "in_progress",
    completed: "completed",
  },
  useListTrucks: (params: unknown) => {
    hookCalls.listTrucks(params);
    return {
      data: [
        {
          id: 1,
          ownerId: 1,
          ownerCompany: "Summit Hauling",
          truckType: "dump_truck",
          capacityTons: 12,
          ratePerHour: 115,
          truckNumber: "42",
          isAvailable: true,
          createdAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
    };
  },
  useListJobs: (params: unknown) => {
    hookCalls.listJobs(params);
    return {
      data: [
        {
          id: 7,
          requestId: 1,
          bidId: 1,
          customerId: 1,
          customerCompany: "North Yard",
          providerId: 2,
          providerCompany: "Summit Hauling",
          ratePerHour: 120,
          trucksAssigned: 2,
          status: "active",
          materialType: "gravel",
          truckType: "dump_truck",
          pickupAddress: "10 Quarry Rd",
          deliveryAddress: "90 Plant Ave",
          scheduledDate: new Date().toISOString(),
          startTime: "08:00",
          estimatedHours: 3,
          paymentStatus: "unpaid",
          createdAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
    };
  },
  useListRequests: (params: unknown) => {
    hookCalls.listRequests(params);
    return {
      data: [
        {
          id: 5,
          customerId: 1,
          customerCompany: "North Yard",
          materialType: "gravel",
          truckType: "dump_truck",
          quantityTons: 50,
          pickupAddress: "10 Quarry Rd",
          deliveryAddress: "90 Plant Ave",
          scheduledDate: new Date().toISOString(),
          startTime: "08:00",
          estimatedHours: 3,
          status: "open",
          trucksNeeded: 2,
          createdAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
    };
  },
  useListDumpSites: (params: unknown) => {
    hookCalls.listDumpSites(params);
    return {
      data: [
        {
          id: 3,
          name: "Plant Ave Facility",
          address: "90 Plant Ave",
          city: "Austin",
          state: "TX",
          zip: "78701",
          type: "landfill",
          isActive: true,
          fullAddress: "90 Plant Ave, Austin, TX",
        },
      ],
      isLoading: false,
    };
  },
  useListDumpSiteStates: () => ({ data: ["TX"] }),
  useGetDashboardActivity: () => ({
    data: [
      {
        id: 11,
        type: "job_accepted",
        description: "Driver accepted JOB-0007",
        relatedId: 7,
        relatedBinOrderId: null,
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useGetDashboardStats: () => ({ data: { totalRevenue: 1250, activeJobs: 1 } }),
  useListOrgMembers: () => ({
    data: {
      members: [
        {
          id: 9,
          role: "driver",
          contactName: "Avery Driver",
          companyName: "Summit Hauling",
          email: "avery@example.com",
          createdAt: new Date().toISOString(),
        },
      ],
    },
  }),
  useListJobStatusUpdates: (id: number) => {
    hookCalls.listJobStatusUpdates(id);
    return {
      data: [
        {
          id: 15,
          jobId: 7,
          actorProfileId: 9,
          actorName: "Avery Driver",
          status: "arrived",
          note: "At pickup gate",
          createdAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
    };
  },
}));

describe("Dispatcher command center", () => {
  it("renders the operational shell from generated API hooks", async () => {
    render(<DispatcherPage />);

    expect(screen.getByText("Dispatcher Command Center")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Dispatcher filters" })).toBeTruthy();
    expect(screen.getByText("Current Dispatch")).toBeTruthy();
    expect(screen.getByText("Available Trucks")).toBeTruthy();
    expect(screen.getByText("Drivers Online")).toBeTruthy();
    expect(screen.getByText("Activity Feed")).toBeTruthy();
    expect(screen.getByTestId("dispatcher-timeline-trigger")).toBeTruthy();
    expect(screen.getAllByText("Backend filter pending").length).toBeGreaterThan(0);

    await waitFor(() => expect(screen.getByTestId("dispatcher-live-map")).toBeTruthy());
    expect(screen.getByLabelText("Select pickup for job 7")).toBeTruthy();
    expect(screen.getByText("Driver arrived")).toBeTruthy();
    expect(hookCalls.listTrucks).toHaveBeenCalledWith(undefined);
    expect(hookCalls.listJobs).toHaveBeenCalledWith(undefined);
    expect(hookCalls.listRequests).toHaveBeenCalledWith(undefined);
    expect(hookCalls.listDumpSites).toHaveBeenCalledWith(undefined);
    expect(hookCalls.listJobStatusUpdates).toHaveBeenCalledWith(7);
  });
});
