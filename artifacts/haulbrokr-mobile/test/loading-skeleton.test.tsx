import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { LoadingSkeleton } from "@/components/LoadingSkeleton";

describe("LoadingSkeleton", () => {
  it("exposes an accessible loading state", () => {
    render(<LoadingSkeleton rows={2} />);
    expect(screen.getByLabelText("Loading")).toBeTruthy();
  });
});
