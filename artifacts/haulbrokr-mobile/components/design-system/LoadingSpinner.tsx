import React from "react";
import { ActivityIndicator, type ActivityIndicatorProps } from "react-native";
import { useColors } from "@/hooks/useColors";

export function LoadingSpinner(props: ActivityIndicatorProps) {
  const colors = useColors();
  return <ActivityIndicator color={colors.primary} {...props} />;
}
