import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "@/components/shared/ActivityFeed";

/**
 * The activity feed must render a bin-status notification as a link
 * whose href is exactly `/bins?order=<relatedBinOrderId>` — the deep-link
 * contract the bins page reads to scroll to and highlight the right order.
 */

const BIN_ORDER_ID = "11111111-2222-3333-4444-555555555555";

describe("ActivityFeed — bin notification deep-link", () => {
  it("renders a bin activity entry as a link to /bins?order=<id>", () => {
    render(
      <ActivityFeed
        activities={[
          {
            id: 1,
            type: "bin_delivered",
            description: "Your 20-yard roll-off was delivered.",
            relatedBinOrderId: BIN_ORDER_ID,
            relatedId: null,
            createdAt: new Date().toISOString(),
          },
        ]}
      />
    );

    const row = screen.getByText("Your 20-yard roll-off was delivered.");
    const link = row.closest("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe(`/bins?order=${BIN_ORDER_ID}`);
  });

  it("does not turn a non-bin activity entry into a bins link", () => {
    render(
      <ActivityFeed
        activities={[
          {
            id: 2,
            type: "bid_accepted",
            description: "A provider accepted your bid.",
            relatedBinOrderId: null,
            relatedId: 7,
            createdAt: new Date().toISOString(),
          },
        ]}
      />
    );

    const row = screen.getByText("A provider accepted your bid.");
    const link = row.closest("a");
    if (link) {
      expect(link.getAttribute("href")).not.toContain("/bins?order=");
    }
  });
});
