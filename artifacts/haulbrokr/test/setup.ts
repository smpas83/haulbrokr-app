import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom doesn't implement scrollIntoView; the bins page calls it when a
// deep-linked order is highlighted, so provide a no-op spy.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// next-themes requires matchMedia in jsdom
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
