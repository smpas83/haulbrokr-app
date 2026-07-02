import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { spacing } from "@workspace/design-tokens";

export interface BadgeProps {
  label: string;
  color?: string;
}

export function Badge({ label, color }: BadgeProps) {
  const colors = useColors();
  const bg = color ?? colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: bg + "20" }]}>
      <Text style={[styles.label, { color: bg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[0.5],
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
