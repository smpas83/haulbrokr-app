import colors from "@/constants/colors";

/**
 * Returns Industrial Luxury design tokens.
 * Always dark — matches the haulbrokr.com website (no light theme).
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
