import React from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  const colors = useColors();

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.lineWide, { backgroundColor: colors.primary + "16" }]} />
          <View style={[styles.line, { backgroundColor: colors.mutedForeground + "18" }]} />
          <View style={[styles.lineShort, { backgroundColor: colors.mutedForeground + "14" }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  lineWide: { height: 18, borderRadius: 6, width: "68%" },
  line: { height: 12, borderRadius: 6, width: "92%" },
  lineShort: { height: 12, borderRadius: 6, width: "44%" },
});
