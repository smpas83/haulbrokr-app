import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { LoadingCenter } from "@/components/LoadingCenter";
import { RefreshingIndicator, isRefreshingPillVisible } from "@/components/RefreshingIndicator";
import { LastUpdated } from "@/components/LastUpdated";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ACCENT } from "@/constants/theme";
import {
  useAdminAccess, useStuckPayouts, useRetryStuckPayout, useResetPayoutFailures,
  type StuckPayoutItem,
} from "@/hooks/useLiveApi";

function money(n: number | null): string {
  return n != null ? `$${n.toLocaleString("en-US")}` : "—";
}

export default function AdminPayoutsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const access = useAdminAccess();
  const isAdmin = (access.data?.permissions ?? []).includes("payouts");

  // Poll every 15s while this screen is focused so payouts that appear or get
  // resolved by the background sweep show up without a manual pull-to-refresh.
  const [isFocused, setIsFocused] = useState(false);
  const payouts = useStuckPayouts({
    enabled: isAdmin,
    refetchInterval: isFocused && isAdmin ? 15000 : false,
  });
  const items = Array.isArray(payouts.data) ? payouts.data : [];

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      if (isAdmin) payouts.refetch();
      return () => setIsFocused(false);
    }, [isAdmin]),
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    payouts.refetch().finally(() => setRefreshing(false));
  }, [payouts]);

  // Surface a foreground refetch (e.g. after reopening the app) while the cached
  // list is already on screen — but not during the initial load or a manual pull.
  const isUpdating = isRefreshingPillVisible({
    isFetching: isAdmin && payouts.isFetching,
    isLoading: payouts.isLoading,
    refreshing,
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RefreshingIndicator visible={isUpdating} />
      <ScreenHeader
        title="Stuck Payouts"
        icon="dollar-sign"
        subtitle={
          <View>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {isAdmin ? `${items.length} awaiting release` : "Admin only"}
            </Text>
            {isAdmin && <LastUpdated timestamp={payouts.dataUpdatedAt || undefined} style={{ marginTop: 2 }} />}
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {access.isLoading ? (
          <LoadingCenter style={styles.emptyWrap} />
        ) : !isAdmin ? (
          <View style={styles.emptyWrap}>
            <Feather name="shield-off" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Access Restricted</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              This area is for HaulBrokr staff only. You don't have admin access.
            </Text>
          </View>
        ) : payouts.isLoading ? (
          <LoadingCenter style={styles.emptyWrap} />
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="check-circle" size={40} color={ACCENT.green} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>All Settled</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No stuck payouts — every provider transfer has cleared.
            </Text>
          </View>
        ) : (
          items.map((item, idx) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(idx * 60).springify()}>
              <StuckPayoutCard item={item} colors={colors} />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StuckPayoutCard({ item, colors }: { item: StuckPayoutItem; colors: any }) {
  const retry = useRetryStuckPayout();
  const resetFailures = useResetPayoutFailures();
  const [result, setResult] = useState<
    { kind: "released" | "skipped" | "failed" | "reset"; message: string } | null
  >(null);
  // Optimistically reflect a successful reset locally so the "Alerted" badge and
  // "Retry Fails" count clear immediately, even before the list refetches.
  const [cleared, setCleared] = useState(false);

  const release = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResult(null);
    try {
      const res = await retry.mutateAsync(item.id);
      if (res.outcome === "released") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResult({ kind: "released", message: `${item.providerCompany} has been paid.` });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setResult({ kind: "skipped", message: res.message || "Payout not eligible for release yet." });
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({ kind: "failed", message: err?.message ?? "The transfer couldn't be completed. Try again shortly." });
    }
  };

  const reset = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setResult(null);
    try {
      await resetFailures.mutateAsync(item.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCleared(true);
      setResult({ kind: "reset", message: "Failure count and alert cleared — auto-retry re-armed." });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setResult({ kind: "failed", message: err?.message ?? "Couldn't clear the failure count. Try again shortly." });
    }
  };

  const released = result?.kind === "released";
  // Once reset, treat the local copy as having zero failures and no alert.
  const retryFailures = cleared ? 0 : item.payoutRetryFailures;
  const alerted = !cleared && item.payoutAlertSentAt != null;
  const banner = result
    ? result.kind === "released"
      ? { bg: ACCENT.green + "18", border: ACCENT.green + "40", color: ACCENT.green, icon: "check-circle" as const }
      : result.kind === "reset"
        ? { bg: colors.primary + "18", border: colors.primary + "40", color: colors.primary, icon: "rotate-ccw" as const }
        : result.kind === "skipped"
          ? { bg: "#f59e0b18", border: "#f59e0b40", color: "#f59e0b", icon: "alert-circle" as const }
          : { bg: colors.destructive + "18", border: colors.destructive + "40", color: colors.destructive, icon: "x-circle" as const }
    : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.cardAvatar, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="dollar-sign" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Job #{item.id} · {item.materialType}
          </Text>
          <View style={styles.flowRow}>
            <Text style={[styles.flowText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
              {item.customerCompany || "Customer"}
            </Text>
            <Feather name="arrow-right" size={12} color={colors.mutedForeground} />
            <Text style={[styles.flowText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
              {item.providerCompany || "Provider"}
            </Text>
          </View>
        </View>
        {!released && (
          <View style={styles.badgeStack}>
            <View style={[styles.stuckBadge, { backgroundColor: "#f59e0b18", borderColor: "#f59e0b40" }]}>
              <Feather name="clock" size={12} color="#f59e0b" />
              <Text style={[styles.stuckText, { color: "#f59e0b", fontFamily: "Inter_600SemiBold" }]}>Stuck</Text>
            </View>
            {alerted && (
              <View style={[styles.stuckBadge, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "40" }]}>
                <Feather name="alert-triangle" size={12} color={colors.destructive} />
                <Text style={[styles.stuckText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>Alerted</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Stat label="Provider Net" value={money(item.providerNetAmount)} colors={colors} />
        <Stat label="Customer Paid" value={money(item.customerTotalAmount)} colors={colors} />
        <Stat label="Attempts" value={String(item.paymentAttempts)} colors={colors} />
        <Stat
          label="Retry Fails"
          value={String(retryFailures)}
          colors={colors}
          valueColor={retryFailures > 0 ? colors.destructive : undefined}
        />
      </View>

      {/* Outcome banner */}
      {banner && (
        <View style={[styles.banner, { backgroundColor: banner.bg, borderColor: banner.border }]}>
          <Feather name={banner.icon} size={14} color={banner.color} />
          <Text style={[styles.bannerText, { color: banner.color, fontFamily: "Inter_500Medium" }]}>
            {result!.kind === "released"
              ? "Payout released — "
              : result!.kind === "reset"
                ? "Failures reset — "
                : result!.kind === "skipped"
                  ? "Not released — "
                  : "Action failed — "}
            {result!.message}
          </Text>
        </View>
      )}

      {/* Explainer + action */}
      {!released && (
        <>
          <Text style={[styles.explainer, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            The customer's payment already went through — only the provider transfer is pending. Releasing retries the
            transfer; the customer is never re-charged. Reset Failures clears a false alert and re-arms auto-retry once
            you've fixed the underlying problem.
          </Text>
          <View style={styles.actionRow}>
            <Pressable
              onPress={release}
              disabled={retry.isPending || resetFailures.isPending}
              style={[styles.releaseBtn, { backgroundColor: colors.primary, opacity: retry.isPending || resetFailures.isPending ? 0.6 : 1 }]}
            >
              {retry.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <>
                  <Feather name="send" size={15} color={colors.primaryForeground} />
                  <Text style={[styles.releaseText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                    Release Payout
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={reset}
              disabled={retry.isPending || resetFailures.isPending}
              style={[styles.resetBtn, { borderColor: colors.border, backgroundColor: colors.background, opacity: retry.isPending || resetFailures.isPending ? 0.6 : 1 }]}
            >
              {resetFailures.isPending ? (
                <ActivityIndicator color={colors.foreground} size="small" />
              ) : (
                <>
                  <Feather name="rotate-ccw" size={15} color={colors.foreground} />
                  <Text style={[styles.resetText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                    Reset Failures
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function Stat({ label, value, colors, valueColor }: { label: string; value: string; colors: any; valueColor?: string }) {
  return (
    <View style={[styles.stat, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: valueColor ?? colors.foreground, fontFamily: "Inter_700Bold" }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10 },
  title: { fontSize: 20 },
  subtitle: { fontSize: 13, marginTop: 1 },
  headerIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  content: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardAvatar: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle: { fontSize: 15 },
  flowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  flowText: { fontSize: 12, flexShrink: 1 },
  badgeStack: { alignItems: "flex-end", gap: 6 },
  stuckBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  stuckText: { fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", gap: 3 },
  statValue: { fontSize: 16 },
  statLabel: { fontSize: 10, textAlign: "center" },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 17 },
  explainer: { fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: 8 },
  releaseBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 8 },
  releaseText: { fontSize: 14 },
  resetBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 8, borderWidth: 1 },
  resetText: { fontSize: 14 },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 56, paddingHorizontal: 24, gap: 4 },
  emptyTitle: { fontSize: 17, marginBottom: 4 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
