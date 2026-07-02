import React, { type ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { Card } from "./Card";
import { useColors } from "@/hooks/useColors";
import { spacing, typography } from "@workspace/design-tokens";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  description?: string;
}

export function MetricCard({ label, value, description }: MetricCardProps) {
  const colors = useColors();
  return (
    <Card>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      {description ? (
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing[2],
  },
  value: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: "700",
  },
  description: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing[1],
  },
});
