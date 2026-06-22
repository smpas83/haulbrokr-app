import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// React Native / Expo define `__DEV__` as a global at runtime. Some modules
// (e.g. expo's async-require setup, pulled in transitively when a component
// imports from "expo") reference it at evaluation time and throw a
// ReferenceError under jsdom without it. Default to production-like `false`.
const globalWithDev = globalThis as typeof globalThis & { __DEV__?: boolean };
if (typeof globalWithDev.__DEV__ === "undefined") {
  globalWithDev.__DEV__ = false;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
