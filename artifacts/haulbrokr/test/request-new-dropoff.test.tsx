import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NewRequestPage from "@/pages/request-new";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const createRequest = { mutate: vi.fn(), isPending: false };

vi.mock("@workspace/api-client-react", () => ({
  useCreateRequest: () => createRequest,
  useListDumpSiteStates: () => ({ data: ["NV"] }),
  useListDumpSites: () => ({
    data: [{
      id: 77,
      name: "Apex Landfill",
      address: "4250 Losee Rd",
      city: "North Las Vegas",
      state: "NV",
      zip: "89030",
      type: "landfill",
      phone: "702-555-0100",
      hours: "Mon-Fri 6a-4p",
      acceptedMaterials: ["dirt", "concrete"],
      tippingFeeDetails: "$55/ton",
      isActive: true,
      fullAddress: "Apex Landfill, 4250 Losee Rd, North Las Vegas, NV 89030",
    }],
    isLoading: false,
  }),
  JobRequestInputMaterialType: {
    dirt: "dirt",
    gravel: "gravel",
    sand: "sand",
    concrete: "concrete",
    asphalt: "asphalt",
    demolition: "demolition",
    topsoil: "topsoil",
    fill: "fill",
    other: "other",
  },
  JobRequestInputTruckType: {
    standard: "standard",
    dump_truck: "dump_truck",
    end_dump: "end_dump",
  },
}));

describe("New request dropoff facility fields", () => {
  it("renders dropoff facility controls and driver-facing instructions", () => {
    render(<NewRequestPage />);

    expect(screen.getByRole("heading", { name: /post job request/i })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /browse dump sites/i })).toHaveLength(2);
    expect(screen.getByLabelText(/dropoff instructions/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/facility gate, scale house/i)).toBeTruthy();
  });
});
