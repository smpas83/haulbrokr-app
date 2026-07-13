/**
 * Premium Industrial Luxury design tokens — aligned with haulbrokr.com.
 * The product is dark-first; light is kept as an alias of dark so any
 * leftover scheme lookups never surface a white UI.
 */
const industrialDark = {
  text: "#F4F4F5",
  tint: "#3B82F6",
  background: "#0A0A0C",
  foreground: "#F4F4F5",
  card: "#141416",
  cardForeground: "#F4F4F5",
  primary: "#3B82F6",
  primaryForeground: "#FFFFFF",
  secondary: "#1E1E22",
  secondaryForeground: "#F4F4F5",
  muted: "#1A1A1E",
  mutedForeground: "#8B8B96",
  accent: "#FF6A00",
  accentForeground: "#FFFFFF",
  destructive: "#EF4444",
  destructiveForeground: "#F4F4F5",
  border: "#27272A",
  input: "#27272A",
  success: "#10B981",
  warning: "#F59E0B",
  info: "#22D3EE",
} as const;

const colors = {
  light: industrialDark,
  dark: industrialDark,
  radius: 16,
};

export default colors;
