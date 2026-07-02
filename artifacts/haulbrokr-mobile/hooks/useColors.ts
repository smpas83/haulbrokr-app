import { useColorScheme } from "react-native";
import { useAppTheme } from "@/theme";
import colors from "@/constants/colors";

/**
 * Returns design tokens for the current color scheme.
 * Falls back to light if no dark scheme is detected.
 */
export function useColors() {
  try {
    const { theme } = useAppTheme();
    return {
      ...theme.colors,
      text: theme.colors.foreground,
      tint: theme.colors.primary,
      cardForeground: theme.colors.cardForeground,
      primaryForeground: theme.colors.primaryForeground,
      secondaryForeground: theme.colors.secondaryForeground,
      mutedForeground: theme.colors.mutedForeground,
      accentForeground: theme.colors.accentForeground,
      destructiveForeground: theme.colors.destructiveForeground,
      radius: theme.borderRadius.none,
    };
  } catch {
    const scheme = useColorScheme();
    const palette = scheme === "dark" ? colors.dark : colors.light;
    return { ...palette, radius: colors.radius };
  }
}
