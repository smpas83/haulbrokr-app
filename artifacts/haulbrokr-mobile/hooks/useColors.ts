import { useColorScheme } from "react-native";
import colors from "@/constants/colors";

/**
 * Returns design tokens for the current color scheme.
 * Falls back to light if no dark scheme is detected.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius, spacing: colors.spacing };
}
