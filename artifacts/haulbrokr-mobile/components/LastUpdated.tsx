import React, { useEffect, useState } from "react";
import { StyleSheet, Text, type TextStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

/** Turn an age in milliseconds into a short, friendly relative label. */
function formatAge(ms: number): string {
  if (ms < 0) ms = 0;
  const sec = Math.floor(ms / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

/**
 * A quiet "Updated <relative time> ago" label so users can tell how fresh the
 * numbers are even when no refetch is in flight — handy right after the app
 * returns from the background. Pass React Query's `dataUpdatedAt`; the label
 * ticks as the data ages and resets to "just now" when a fresh fetch lands.
 */
export function LastUpdated({
  timestamp,
  style,
}: {
  timestamp?: number;
  style?: TextStyle;
}) {
  const colors = useColors();
  // A periodic tick re-renders the label so the relative time stays current
  // while the data sits untouched. We read Date.now() fresh on every render,
  // so the label is also accurate the moment `timestamp` changes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (!timestamp) return null;

  return (
    <Text
      style={[
        styles.text,
        { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        style,
      ]}
    >
      {`Updated ${formatAge(Date.now() - timestamp)}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 12 },
});
