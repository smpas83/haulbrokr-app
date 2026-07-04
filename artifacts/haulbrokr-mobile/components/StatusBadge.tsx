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
  open: { label: "Open", bg: "#e9a60020", text: "#e9a600" },
  bidding: { label: "Bidding", bg: "#7c3aed20", text: "#7c3aed" },
  accepted: { label: "Accepted", bg: "#0891b220", text: "#0891b2" },
  in_progress: { label: "In Progress", bg: "#2563eb20", text: "#2563eb" },
  completed: { label: "Completed", bg: "#16a34a20", text: "#16a34a" },
  cancelled: { label: "Cancelled", bg: "#dc262620", text: "#dc2626" },
  pending: { label: "Pending", bg: "#e9a60020", text: "#e9a600" },
  confirmed: { label: "Confirmed", bg: "#0891b220", text: "#0891b2" },
  active: { label: "Active", bg: "#2563eb20", text: "#2563eb" },
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
        style={[styles.text, { color: config.text }, isSmall && styles.textSm]}
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
