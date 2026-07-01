import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/error-boundary";

function ThrowingChild() {
  throw new Error("render explosion");
}

describe("web ErrorBoundary", () => {
  it("renders a recovery fallback instead of a blank page", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("render explosion")).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });
});
