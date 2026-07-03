import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/pages/customer/CustomerDashboard", () => ({
  default: () => <div data-testid="customer-dashboard">Customer Command Center</div>,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetMyProfile: () => ({ data: { role: "customer", contactName: "Jamie", companyName: "Acme" } }),
  useGetDashboardStats: () => ({ data: null, isLoading: false }),
  useGetDashboardActivity: () => ({ data: [], isLoading: false }),
  useGetAccountStatus: () => ({ data: { profileComplete: true } }),
}));

import DashboardPage from "@/pages/dashboard";

describe("Dashboard routing", () => {
  it("renders CustomerDashboard for customer role", () => {
    render(<DashboardPage />);
    expect(screen.getByTestId("customer-dashboard")).toBeTruthy();
    expect(screen.getByText("Customer Command Center")).toBeTruthy();
  });
});
