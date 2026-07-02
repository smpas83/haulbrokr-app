import { createContext, useContext, type ReactNode } from "react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import { createTheme, type Theme } from "@workspace/design-tokens";

interface ThemeContextValue {
  theme: Theme;
  scheme: "light" | "dark";
  setScheme: (scheme: "light" | "dark" | "system") => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function ThemeContextBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useNextTheme();
  const scheme = resolvedTheme === "dark" ? "dark" : "light";
  const theme = createTheme(scheme);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        scheme,
        setScheme: setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <ThemeContextBridge>{children}</ThemeContextBridge>
    </NextThemesProvider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return ctx;
}
