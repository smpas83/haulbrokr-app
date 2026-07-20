import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const landingPath = join(dirname(fileURLToPath(import.meta.url)), "../src/pages/landing.tsx");
const source = readFileSync(landingPath, "utf8");

describe("public landing #pricing marketing copy", () => {
  it("does not publish fixed marketplace fee percentages", () => {
    expect(source).not.toMatch(/3%\s*per\s*completed\s*load/i);
    expect(source).not.toMatch(/15%\s*per\s*completed\s*load/i);
    // No bare public fee percentage in the pricing section / PRICING constant.
    const pricingBlock = source.slice(source.indexOf("const PRICING"), source.indexOf("const TESTIMONIALS"));
    expect(pricingBlock).not.toMatch(/\b\d+%\b/);
    expect(source).not.toMatch(/Join as vendor/i);
  });

  it("presents Pro Fleet with carrier CTA and transparent booking note", () => {
    expect(source).toContain('name: "Pro Fleet"');
    expect(source).toContain('price: "Pay only"');
    expect(source).toContain('period: "when loads move"');
    expect(source).toContain("Transparent pricing is shown before every booking.");
    expect(source).toContain("Join as a carrier");
    expect(source).toContain('id="pricing"');
  });

  it("discloses customer-side transparent pricing without claiming no hidden fees", () => {
    expect(source).toMatch(/Customers receive transparent, upfront pricing before confirming a haul/);
    expect(source).not.toMatch(/no hidden fees/i);
  });
});
