import { borderRadius } from "./borderRadius";
import { animation } from "./animation";
import { zIndex } from "./zIndex";
import { breakpoints } from "./breakpoints";
import { spacing } from "./spacing";
import { typography } from "./typography";

/**
 * Generates CSS custom property declarations for web consumption.
 * Colors are defined in index.css; this extends with non-color tokens.
 */
export function generateTokenCssVariables(): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(spacing)) {
    lines.push(`  --spacing-${key}: ${value}px;`);
  }

  for (const [key, value] of Object.entries(borderRadius)) {
    lines.push(`  --radius-token-${key}: ${value}px;`);
  }

  for (const [key, value] of Object.entries(animation.durations)) {
    lines.push(`  --duration-${key}: ${value}ms;`);
  }

  for (const [key, value] of Object.entries(animation.easings)) {
    lines.push(`  --easing-${key}: ${value};`);
  }

  for (const [key, value] of Object.entries(zIndex)) {
    lines.push(`  --z-${key}: ${value};`);
  }

  for (const [key, value] of Object.entries(breakpoints)) {
    lines.push(`  --breakpoint-${key}: ${value}px;`);
  }

  for (const [key, value] of Object.entries(typography.fontSize)) {
    lines.push(`  --font-size-${key}: ${value}px;`);
  }

  for (const [key, value] of Object.entries(typography.fontWeight)) {
    lines.push(`  --font-weight-${key}: ${value};`);
  }

  return `:root {\n${lines.join("\n")}\n}`;
}
