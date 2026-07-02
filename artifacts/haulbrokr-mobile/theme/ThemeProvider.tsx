import React, { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { createTheme, type Theme } from "@workspace/design-tokens";

interface ThemeContextValue {
  theme: Theme;
  scheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const scheme: "light" | "dark" = systemScheme === "dark" ? "dark" : "light";
  const value = useMemo(() => ({ theme: createTheme(scheme), scheme }), [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return ctx;
}
