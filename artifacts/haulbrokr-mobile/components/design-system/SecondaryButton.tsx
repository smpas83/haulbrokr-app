import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { useColors } from "@/hooks/useColors";
import { borderRadius, spacing } from "@workspace/design-tokens";

export type SecondaryButtonProps = PressableProps & {
  children: ReactNode;
};

export function SecondaryButton({ children, style, ...props }: SecondaryButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.secondary,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
        style as object,
      ]}
      {...props}
    >
      <Text style={[styles.label, { color: colors.secondaryForeground }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.none,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
});
