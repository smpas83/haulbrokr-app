import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { createRequire } from "node:module";

import { ErrorFallback } from "@/components/ErrorFallback";

/**
 * Keeps the web runtime guard and the actual error screen in lockstep.
 *
 * The guard in `scripts/check-web-runtime.js` decides a screen crashed by
 * matching the literal copy "Something went wrong" (its
 * `ERROR_FALLBACK_SIGNATURE` regex) against the rendered page. That exact copy
 * lives independently in `components/ErrorFallback.tsx`. If someone rewords the
 * ErrorFallback message — or edits the regex — without updating the other, the
 * guard silently stops recognizing ErrorBoundary crashes and the webbuild
 * check passes while a broken screen renders the fallback.
 *
 * This test renders the *real* ErrorFallback and asserts its visible text still
 * matches the *real* exported regex, so the two can never drift apart.
 */

const require = createRequire(import.meta.url);
const { ERROR_FALLBACK_SIGNATURE } = require("../scripts/check-web-runtime.js") as {
  ERROR_FALLBACK_SIGNATURE: RegExp;
};

describe("ErrorFallback copy ↔ web runtime guard signature", () => {
  it("renders text the guard's ERROR_FALLBACK_SIGNATURE recognizes", () => {
    const { container } = render(
      <ErrorFallback error={new Error("boom")} resetError={() => {}} />,
    );

    const rendered = container.textContent || "";

    // Sanity: the screen actually rendered some copy.
    expect(rendered.trim().length).toBeGreaterThan(0);

    // The whole point: the guard would still detect this fallback on web.
    expect(ERROR_FALLBACK_SIGNATURE.test(rendered)).toBe(true);
  });

  it("exports a usable RegExp signature from the guard", () => {
    expect(ERROR_FALLBACK_SIGNATURE).toBeInstanceOf(RegExp);
  });
});
