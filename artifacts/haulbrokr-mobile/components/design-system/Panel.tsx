import React, { type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/useColors";
import { borderRadius, spacing } from "@workspace/design-tokens";

export type PanelProps = ViewProps & {
  children: ReactNode;
};

export function Panel({ children, style, ...props }: PanelProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: borderRadius.none,
    padding: spacing[4],
  },
});
