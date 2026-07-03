import { colors } from "@workspace/design-tokens";

/** @deprecated Use useAppTheme() from @/theme instead. */
const legacyColors = {
  light: {
    text: colors.light.foreground,
    tint: colors.light.primary,
    background: colors.light.background,
    foreground: colors.light.foreground,
    card: colors.light.card,
    cardForeground: colors.light.cardForeground,
    primary: colors.light.primary,
    primaryForeground: colors.light.primaryForeground,
    secondary: colors.light.secondary,
    secondaryForeground: colors.light.secondaryForeground,
    muted: colors.light.muted,
    mutedForeground: colors.light.mutedForeground,
    accent: colors.light.accent,
    accentForeground: colors.light.accentForeground,
    destructive: colors.light.destructive,
    destructiveForeground: colors.light.destructiveForeground,
    border: colors.light.border,
    input: colors.light.input,
  },
  dark: {
    text: colors.dark.foreground,
    tint: colors.dark.primary,
    background: colors.dark.background,
    foreground: colors.dark.foreground,
    card: colors.dark.card,
    cardForeground: colors.dark.cardForeground,
    primary: colors.dark.primary,
    primaryForeground: colors.dark.primaryForeground,
    secondary: colors.dark.secondary,
    secondaryForeground: colors.dark.secondaryForeground,
    muted: colors.dark.muted,
    mutedForeground: colors.dark.mutedForeground,
    accent: colors.dark.accent,
    accentForeground: colors.dark.accentForeground,
    destructive: colors.dark.destructive,
    destructiveForeground: colors.dark.destructiveForeground,
    border: colors.dark.border,
    input: colors.dark.input,
  },
  radius: 0,
};

export default legacyColors;
