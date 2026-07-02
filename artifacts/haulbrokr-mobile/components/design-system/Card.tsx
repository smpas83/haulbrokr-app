import React, { type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/useColors";
import { borderRadius, spacing } from "@workspace/design-tokens";

export type CardProps = ViewProps & {
  children: ReactNode;
};

export function Card({ children, style, ...props }: CardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
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
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.none,
    padding: spacing[4],
  },
});
