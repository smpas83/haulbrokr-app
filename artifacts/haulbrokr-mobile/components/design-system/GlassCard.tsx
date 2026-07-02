import React, { type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/useColors";
import { borderRadius, spacing } from "@workspace/design-tokens";

export type GlassCardProps = ViewProps & {
  children: ReactNode;
};

export function GlassCard({ children, style, ...props }: GlassCardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card + "CC", borderColor: colors.border },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.none,
    padding: spacing[4],
  },
});
