import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/useColors";
import { borderRadius } from "@workspace/design-tokens";

export function Skeleton({ style, ...props }: ViewProps) {
  const colors = useColors();
  return (
    <View
      style={[styles.skeleton, { backgroundColor: colors.muted }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: borderRadius.sm,
    minHeight: 16,
  },
});
