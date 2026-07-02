import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/theme";
import { PrimaryButton, StatusPill } from "@/components/design-system";

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("mobile design-system", () => {
  it("renders PrimaryButton", () => {
    wrap(<PrimaryButton>Continue</PrimaryButton>);
    expect(screen.getByText("Continue")).toBeTruthy();
  });

  it("renders StatusPill", () => {
    wrap(<StatusPill status="open" />);
    expect(screen.getByText("open")).toBeTruthy();
  });
});
