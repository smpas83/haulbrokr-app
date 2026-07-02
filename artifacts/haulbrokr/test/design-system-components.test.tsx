import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PrimaryButton, MetricCard, StatusPill } from "@/components/design-system";
import { ThemeProvider } from "@/theme";

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("web design-system", () => {
  it("renders PrimaryButton", () => {
    wrap(<PrimaryButton>Submit</PrimaryButton>);
    expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
  });

  it("renders MetricCard", () => {
    wrap(<MetricCard label="Active Jobs" value={12} description="Last 24h" />);
    expect(screen.getByText("Active Jobs")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("renders StatusPill with status label", () => {
    wrap(<StatusPill status="in_progress" />);
    expect(screen.getByText("in progress")).toBeTruthy();
  });
});
