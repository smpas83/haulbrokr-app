import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Status =
  | "open"
  | "bidding"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "pending"
  | "confirmed"
  | "active";

const STATUS_CONFIG: Record<
  Status,
  { label: string; bg: string; text: string }
> = {
  open: { label: "Open", bg: "#3b82f620", text: "#60a5fa" },
  bidding: { label: "Bidding", bg: "#f59e0b20", text: "#fbbf24" },
  accepted: { label: "Accepted", bg: "#10b98120", text: "#34d399" },
  in_progress: { label: "In Progress", bg: "#8b5cf620", text: "#a78bfa" },
  completed: { label: "Completed", bg: "#6b728020", text: "#9ca3af" },
  cancelled: { label: "Cancelled", bg: "#ef444420", text: "#f87171" },
  pending: { label: "Pending", bg: "#f59e0b20", text: "#fbbf24" },
  confirmed: { label: "Confirmed", bg: "#10b98120", text: "#34d399" },
  active: { label: "Active", bg: "#3b82f620", text: "#60a5fa" },
};

interface Props {
  status: Status;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg },
        isSmall && styles.badgeSm,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: config.text },
          isSmall && styles.textSm,
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  textSm: {
    fontSize: 10,
  },
});
