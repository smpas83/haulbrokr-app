import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { useColors } from "@/hooks/useColors";
import { borderRadius, spacing } from "@workspace/design-tokens";

export type IconButtonProps = PressableProps & {
  children: ReactNode;
};

export function IconButton({ children, style, ...props }: IconButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? colors.muted : "transparent" },
        style as object,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.none,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[2],
  },
});
