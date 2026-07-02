import { borderRadius } from "./borderRadius";
import { colors, type ColorScheme } from "./colors";
import { typography } from "./typography";
import { spacing } from "./spacing";
import { shadows } from "./shadows";
import { elevation } from "./elevation";
import { animation } from "./animation";
import { zIndex } from "./zIndex";
import { breakpoints } from "./breakpoints";
import { statusColor, typeColor, accentColor, mapColor } from "./semantic";

export interface Theme {
  scheme: ColorScheme;
  colors: (typeof colors)[ColorScheme];
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  elevation: typeof elevation;
  animation: typeof animation;
  zIndex: typeof zIndex;
  breakpoints: typeof breakpoints;
  semantic: {
    status: typeof statusColor;
    type: typeof typeColor;
    accent: typeof accentColor;
    map: typeof mapColor;
  };
}

export function createTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: colors[scheme],
    typography,
    spacing,
    borderRadius,
    shadows,
    elevation,
    animation,
    zIndex,
    breakpoints,
    semantic: {
      status: statusColor,
      type: typeColor,
      accent: accentColor,
      map: mapColor,
    },
  };
}

export const lightTheme = createTheme("light");
export const darkTheme = createTheme("dark");
