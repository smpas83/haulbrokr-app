import React from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

/**
 * Single source of truth for when the "Updating…" pill should show. Every
 * live-data screen funnels its query state through this helper instead of
 * re-spelling the predicate inline, so the gating rule can't silently drift
 * between screens.
 *
 * Show only an *invisible* background refetch — the one the user didn't trigger
 * (e.g. the foreground refetch after reopening the app):
 * - Exclude `isLoading` (initial fetch): the screen already shows its own
 *   skeleton/empty state, so the pill would be redundant.
 * - Exclude `refreshing` (manual pull-to-refresh): RefreshControl already shows
 *   its own spinner.
 *
 * `isLoading`/`refreshing` default to false for screens that don't track them.
 */
export function isRefreshingPillVisible({
  isFetching,
  isLoading = false,
  refreshing = false,
}: {
  isFetching: boolean;
  isLoading?: boolean;
  refreshing?: boolean;
}): boolean {
  return isFetching && !isLoading && !refreshing;
}

/**
 * A subtle "Updating…" pill that surfaces a background refetch in flight — for
 * example the foreground refetch that fires when the app returns from the
 * background. It floats at the top of the screen and fades out once fresh data
 * lands. Keep it out of the way: pointerEvents="none" so it never blocks taps.
 */
export function RefreshingIndicator({
  visible,
  label = "Updating…",
  topOffset,
}: {
  visible: boolean;
  label?: string;
  topOffset?: number;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  const top = topOffset ?? (Platform.OS === "web" ? 67 : insets.top) + 8;

  return (
    <Animated.View
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="none"
      style={[styles.wrap, { top }]}
    >
      <View style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.text, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  text: { fontSize: 12 },
});
