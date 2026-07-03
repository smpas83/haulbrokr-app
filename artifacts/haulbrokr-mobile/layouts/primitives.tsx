import React, { type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/useColors";

export function Shell({ children, style, ...props }: ViewProps & { children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.shell, { backgroundColor: colors.background }, style]} {...props}>
      {children}
    </View>
  );
}

export function ShellHeader({ children, style, ...props }: ViewProps & { children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }, style]} {...props}>
      {children}
    </View>
  );
}

export function ShellMain({ children, style, ...props }: ViewProps & { children: ReactNode }) {
  return <View style={[styles.main, style]} {...props}>{children}</View>;
}

export function ShellContent({ children, style, ...props }: ViewProps & { children: ReactNode }) {
  return <View style={[styles.content, style]} {...props}>{children}</View>;
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  main: { flex: 1 },
  content: { flex: 1, padding: 16 },
});
