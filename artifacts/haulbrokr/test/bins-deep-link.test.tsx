import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The bins page is the deep-link target of a bin notification: tapping a
 * notification navigates to `/bins?order=<uuid>`. The page must read that param,
 * scroll the matching order into view, and briefly highlight it (violet ring) so
 * the customer sees exactly which order changed — without highlighting any other
 * order. This guards that param→highlight wiring end-to-end.
 */

const BIN_ORDER_ID = "11111111-2222-3333-4444-555555555555";

const ORDERS = [
  {
    id: BIN_ORDER_ID,
    serviceType: "temporary",
    binSize: "20_yard",
    binType: "roll_off",
    quantity: 1,
    deliveryAddress: "4500 Construction Blvd, Houston, TX",
    deliveryDate: new Date().toISOString(),
    wasteType: "construction",
    status: "delivered",
    createdAt: new Date().toISOString(),
  },
  {
    id: "99999999-0000-0000-0000-000000000000",
    serviceType: "temporary",
    binSize: "10_yard",
    binType: "roll_off",
    quantity: 1,
    deliveryAddress: "12 Other Street, Dallas, TX",
    deliveryDate: new Date().toISOString(),
    wasteType: "general",
    status: "confirmed",
    createdAt: new Date().toISOString(),
  },
];

const CATALOG = [
  {
    id: "temporary_20_yard",
    serviceType: "temporary",
    binSize: "20_yard",
    binType: "roll_off",
    size: "20-Yard",
    type: "Roll-Off",
    description: "20 cubic yards",
    priceRange: "$350-480",
    priceUnit: "week",
    bestFor: "Medium renovations",
    estimateCents: 41500,
  },
];

vi.mock("@workspace/api-client-react", () => ({
  getListBinOrdersQueryKey: () => ["/api/bin-orders"],
  useCreateBinOrder: () => ({ mutate: vi.fn(), isPending: false }),
  useListBinCatalog: () => ({ data: CATALOG, isLoading: false }),
  useListBinOrders: () => ({ data: ORDERS, isLoading: false, refetch: vi.fn() }),
}));

// vi.mock is hoisted before this import, so BinsPage loads with generated API
// hooks mocked. The test remains focused on URL-param to highlight behavior.
import BinsPage from "@/pages/bins";

function renderBins() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BinsPage />
    </QueryClientProvider>,
  );
}

describe("Bins page — deep-linked order highlight", () => {
  it("highlights only the order matching ?order=<id>", async () => {
    window.history.replaceState({}, "", `/bins?order=${BIN_ORDER_ID}`);

    renderBins();

    const target = await screen.findByText("4500 Construction Blvd, Houston, TX");
    const targetCard = target.closest(".transition-colors") as HTMLElement;
    await waitFor(() => {
      expect(targetCard.className).toContain("border-violet-500");
    });

    const other = screen.getByText("12 Other Street, Dallas, TX");
    const otherCard = other.closest(".transition-colors") as HTMLElement;
    expect(otherCard.className).not.toContain("border-violet-500");
    expect(otherCard.className).toContain("border-border");
  });

  it("highlights nothing when there is no ?order param", async () => {
    window.history.replaceState({}, "", "/bins");

    const { container } = renderBins();
    await screen.findByText("4500 Construction Blvd, Houston, TX");

    expect(container.querySelector(".border-violet-500")).toBeNull();
  });
});
