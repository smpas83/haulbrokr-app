import React, { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { spacing } from "@workspace/design-tokens";

export interface NotificationProps {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: ReactNode;
}

export function Notification({ title, description, variant = "default", action }: NotificationProps) {
  const colors = useColors();
  const isDestructive = variant === "destructive";
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDestructive ? colors.destructive + "15" : colors.card,
          borderColor: isDestructive ? colors.destructive : colors.border,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={{ color: isDestructive ? colors.destructive : colors.foreground, fontWeight: "600" }}>
          {title}
        </Text>
        {description ? (
          <Text style={{ color: colors.mutedForeground, marginTop: spacing[1] }}>{description}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    padding: spacing[4],
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing[3],
  },
  content: {
    flex: 1,
  },
});
