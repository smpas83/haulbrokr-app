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
  open: { label: "Open", bg: "#FF550020", text: "#FF5500" },
  bidding: { label: "Bidding", bg: "#F59E0B20", text: "#F59E0B" },
  accepted: { label: "Accepted", bg: "#10B98120", text: "#10B981" },
  in_progress: { label: "In Progress", bg: "#8B5CF620", text: "#8B5CF6" },
  completed: { label: "Completed", bg: "#71717A20", text: "#71717A" },
  cancelled: { label: "Cancelled", bg: "#EF444420", text: "#EF4444" },
  pending: { label: "Pending", bg: "#F59E0B20", text: "#F59E0B" },
  confirmed: { label: "Confirmed", bg: "#10B98120", text: "#10B981" },
  active: { label: "Active", bg: "#FF550020", text: "#FF5500" },
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
