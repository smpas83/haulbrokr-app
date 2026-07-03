import { describe, it, expect } from "vitest";
import {
  createTheme,
  lightTheme,
  darkTheme,
  colors,
  spacing,
  borderRadius,
  animation,
  zIndex,
  breakpoints,
  statusColor,
  mapColor,
} from "@workspace/design-tokens";

describe("design-tokens", () => {
  it("creates light and dark themes", () => {
    expect(createTheme("light").scheme).toBe("light");
    expect(createTheme("dark").scheme).toBe("dark");
    expect(lightTheme.colors.primary).toBe(colors.light.primary);
    expect(darkTheme.colors.primary).toBe(colors.dark.primary);
  });

  it("exposes spacing and radius scales", () => {
    expect(spacing[4]).toBe(16);
    expect(borderRadius.none).toBe(0);
  });

  it("exposes animation presets without hardcoded style decisions in components", () => {
    expect(animation.durations.normal).toBeGreaterThan(0);
    expect(animation.presets.fadeIn.duration).toBe(animation.durations.normal);
  });

  it("exposes z-index and breakpoint scales", () => {
    expect(zIndex.modal).toBeGreaterThan(zIndex.base);
    expect(breakpoints.md).toBe(768);
  });

  it("exposes semantic colors for status and map layers", () => {
    expect(statusColor.open).toBeDefined();
    expect(mapColor.truck).toBeDefined();
  });
});
