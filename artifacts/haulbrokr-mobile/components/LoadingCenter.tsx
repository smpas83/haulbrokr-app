import React from "react";
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

type LoadingCenterProps = {
  style?: ViewStyle | ViewStyle[];
};

export function LoadingCenter({ style }: LoadingCenterProps) {
  const colors = useColors();
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
});
