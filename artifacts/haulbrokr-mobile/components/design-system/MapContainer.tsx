import React, { type ReactNode } from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/useColors";
import { borderRadius } from "@workspace/design-tokens";

export type MapContainerProps = ViewProps & {
  children?: ReactNode;
};

export function MapContainer({ children, style, ...props }: MapContainerProps) {
  const colors = useColors();
  return (
    <View
      style={[styles.container, { backgroundColor: colors.muted, borderColor: colors.border }, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 320,
    borderWidth: 1,
    borderRadius: borderRadius.none,
    overflow: "hidden",
  },
});
