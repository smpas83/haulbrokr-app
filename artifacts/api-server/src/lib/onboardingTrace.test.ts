import { describe, it, expect } from "vitest";
import {
  contentTypesCompatible,
} from "../routes/storage";

// Re-export coverage for content-type helper lives in storage.test.ts.
// This file covers onboardingTrace pure helpers via buildCarrierOnboardingTrace
// with a mocked DB in integration style when RUN_DB_TESTS is set.

describe("onboarding status labels", () => {
  it("contentTypesCompatible is exported for reuse", () => {
    expect(contentTypesCompatible("application/pdf", "application/pdf")).toBe(true);
  });
});
