import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 40 }: AvatarProps) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.muted,
        },
      ]}
    >
      <Text style={[styles.initials, { color: colors.foreground, fontSize: size * 0.35 }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "600",
  },
});
