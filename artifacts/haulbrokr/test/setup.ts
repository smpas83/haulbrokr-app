import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom doesn't implement scrollIntoView; the bins page calls it when a
// deep-linked order is highlighted, so provide a no-op spy.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
