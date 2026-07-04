import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View
        style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}
      >
        <Feather name={icon as any} size={32} color={colors.primary} />
      </View>
      <Text
        style={[
          styles.title,
          { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.description,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        {description}
      </Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text
            style={[
              styles.buttonText,
              { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    borderRadius: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600" as const,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
});
