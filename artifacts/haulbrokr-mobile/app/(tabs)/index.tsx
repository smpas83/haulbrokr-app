import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useMemo, useCallback } from "react";
import {
  Alert, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useApp } from "@/context/AppContext";
import type { Job } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { StatCard } from "@/components/StatCard";
import { RefreshingIndicator, isRefreshingPillVisible } from "@/components/RefreshingIndicator";
import { LastUpdated } from "@/components/LastUpdated";
import { ACCENT } from "@/constants/theme";
import {
  useLiveDashboard,
  useLiveActivity,
  useLiveJobs,
  useLiveRequests,
  usePayoutStatus,
  useWallet,
} from "@/hooks/useLiveApi";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import {
  liveActivityToView,
  liveJobToViewJob,
  liveRequestToViewJob,
  type ActivityView,
  type LiveActivity,
  type LiveJob,
  type LiveRequest,
} from "@/lib/liveJob";

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

const ACTIVITY_ICON_COLORS: Record<string, string> = {
  bid: "#3B82F6", job: "#16a34a", payment: "#0891b2", bin: "#7c3aed", alert: "#ef4444",
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, isOnline, setIsOnline } = useApp();
  const isProvider = profile.role === "provider";

  const { data: liveStats, isFetching: fetchingStats, refetch: refetchStats, dataUpdatedAt: statsUpdatedAt } = useLiveDashboard();
  const { data: liveActivityRaw, isFetching: fetchingActivity, refetch: refetchActivity, dataUpdatedAt: activityUpdatedAt } = useLiveActivity();
  const { data: liveJobsRaw, isFetching: fetchingJobs, refetch: refetchJobs, dataUpdatedAt: jobsUpdatedAt } = useLiveJobs();
  const { data: liveRequestsRaw, isFetching: fetchingRequests, refetch: refetchRequests, dataUpdatedAt: requestsUpdatedAt } = useLiveRequests({
    mine: true,
    enabled: !isProvider,
  });
  const { data: payoutStatusData, isFetching: fetchingPayout, refetch: refetchPayout } = usePayoutStatus();
  const payoutsNeedSetup = isProvider && payoutStatusData != null && !payoutStatusData.payoutsEnabled;
  const { data: walletData, refetch: refetchWallet } = useWallet({ enabled: isProvider });
  const availableBalance = walletData?.availableBalance ?? 0;
  const unreadCount = useUnreadCount();

  const stats = {
    activeJobs: liveStats?.activeJobs ?? 0,
    openRequests: liveStats?.openRequests ?? 0,
    pendingBids: liveStats?.pendingBids ?? 0,
    totalBids: liveStats?.totalBids ?? 0,
    money: isProvider ? liveStats?.totalRevenue ?? 0 : liveStats?.totalSpent ?? 0,
  };

  const activity = useMemo<ActivityView[]>(
    () =>
      Array.isArray(liveActivityRaw)
        ? (liveActivityRaw as LiveActivity[]).map(liveActivityToView)
        : [],
    [liveActivityRaw]
  );

  const jobs = useMemo<Job[]>(() => {
    const fromJobs = Array.isArray(liveJobsRaw)
      ? (liveJobsRaw as LiveJob[]).map(liveJobToViewJob)
      : [];
    const fromRequests =
      !isProvider && Array.isArray(liveRequestsRaw)
        ? (liveRequestsRaw as LiveRequest[])
            .filter((r) => r.status === "open" || r.status === "bidding")
            .map(liveRequestToViewJob)
        : [];
    return [...fromRequests, ...fromJobs];
  }, [liveJobsRaw, liveRequestsRaw, isProvider]);

  const [showAllActivity, setShowAllActivity] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchStats(),
        refetchActivity(),
        refetchJobs(),
        refetchRequests(),
        refetchPayout(),
        isProvider ? refetchWallet() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchStats, refetchActivity, refetchJobs, refetchRequests, refetchPayout, refetchWallet, isProvider]);

  const firstName = profile.name.split(" ")[0];
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleOnlineToggle = (val: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOnline(val);
    if (val) Alert.alert("You are Online", "You'll receive new job notifications in your area.");
  };

  // Surface the foreground refetch (e.g. after reopening the app) over the
  // already-rendered dashboard, but stay quiet during a manual pull-to-refresh.
  const isUpdating = isRefreshingPillVisible({
    isFetching:
      fetchingStats || fetchingActivity || fetchingJobs || fetchingRequests || fetchingPayout,
    refreshing,
  });

  // Freshness of the dashboard: the most recent successful refetch across the
  // live queries feeding this screen.
  const lastUpdated =
    Math.max(statsUpdatedAt, activityUpdatedAt, jobsUpdatedAt, requestsUpdatedAt) || undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RefreshingIndicator visible={isUpdating} />
      <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{(() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })()}</Text>
          <Text style={[styles.name, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{firstName} 👋</Text>
          <Text style={[styles.company, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{profile.company}</Text>
          <LastUpdated timestamp={lastUpdated} style={{ marginTop: 2 }} />
        </View>
        <View style={styles.headerRight}>
          {/* Notification bell */}
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/notifications"); }}
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="bell" size={20} color={unreadCount > 0 ? colors.primary : colors.mutedForeground} />
            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: ACCENT.red }]}>
                <Text style={[styles.badgeText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.push("/(tabs)/account")}
            style={[styles.avatar, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.avatarText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
              {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Online/Offline Banner (Provider only) */}
      {isProvider && (
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <View style={[styles.onlineBanner, { backgroundColor: isOnline ? "#16a34a18" : colors.card, borderColor: isOnline ? "#16a34a40" : colors.border }]}>
            <View style={styles.onlineLeft}>
              <View style={[styles.onlinePulse, { backgroundColor: isOnline ? "#16a34a" : "#6b728040" }]} />
              <View>
                <Text style={[styles.onlineTitle, { color: isOnline ? "#16a34a" : colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {isOnline ? "You are Online" : "You are Offline"}
                </Text>
                <Text style={[styles.onlineSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {isOnline ? "Receiving job requests in your area" : "Toggle to start receiving jobs"}
                </Text>
              </View>
            </View>
            <Switch value={isOnline} onValueChange={handleOnlineToggle} trackColor={{ false: colors.border, true: "#16a34a" }} thumbColor="#ffffff" />
          </View>
        </Animated.View>
      )}

      {/* Payouts not enabled banner (Provider) */}
      {payoutsNeedSetup && (
        <Animated.View entering={FadeInDown.delay(40).springify()}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(tabs)/account"); }}
            style={[styles.payoutBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" }]}
          >
            <View style={[styles.payoutIcon, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="alert-circle" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.payoutTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                Set up your payout account
              </Text>
              <Text style={[styles.payoutSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Connect a payout account with Stripe so you can receive money from completed jobs.
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </Pressable>
        </Animated.View>
      )}

      {/* Wallet Balance (Provider) */}
      {isProvider && (
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <Pressable onPress={() => router.push("/wallet")} style={[styles.walletCard, { backgroundColor: colors.primary }]}>
            <View style={styles.walletLeft}>
              <Text style={[styles.walletLabel, { color: colors.primaryForeground + "cc", fontFamily: "Inter_500Medium" }]}>Available Balance</Text>
              <Text style={[styles.walletAmount, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                ${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.walletRight}>
              <View style={[styles.walletBadge, { backgroundColor: colors.primaryForeground + "20" }]}>
                <Text style={[styles.walletBadgeText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>View</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.primaryForeground + "aa"} />
            </View>
          </Pressable>
        </Animated.View>
      )}

      {/* Stats */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>OVERVIEW</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
        <StatCard icon="briefcase" value={stats.activeJobs} label="Active Jobs" accent />
        <StatCard icon="inbox" value={stats.openRequests} label="Open Requests" />
        <StatCard icon="trending-up" value={isProvider ? stats.pendingBids : stats.totalBids} label={isProvider ? "My Bids" : "Bids Received"} />
        <StatCard icon="dollar-sign" value={fmtMoney(stats.money)} label={isProvider ? "Earnings" : "Jobs Paid"} />
      </ScrollView>

      {/* Quick Actions */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>QUICK ACTIONS</Text>
      <View style={styles.actionsGrid}>
        {isProvider ? (
          <>
            <QuickAction icon="briefcase" label="Browse Loads" onPress={() => router.push("/(tabs)/jobs")} colors={colors} />
            <QuickAction icon="truck" label="Fleet" onPress={() => router.push("/fleet")} colors={colors} highlight />
            <QuickAction icon="dollar-sign" label="Wallet" onPress={() => router.push("/wallet")} colors={colors} />
            <QuickAction icon="file-text" label="Compliance" onPress={() => router.push("/(tabs)/account")} colors={colors} />
          </>
        ) : (
          <>
            <QuickAction icon="plus-circle" label="Post a Load" onPress={() => router.push("/(tabs)/jobs")} colors={colors} />
            <QuickAction icon="package" label="Order Bin" onPress={() => router.push("/(tabs)/bins")} colors={colors} />
            <QuickAction icon="navigation" label="Dump Sites" onPress={() => router.push("/dump-sites")} colors={colors} />
            <QuickAction icon="credit-card" label="Billing" onPress={() => router.push("/wallet")} colors={colors} />
          </>
        )}
      </View>

      {/* Recent Activity */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>RECENT ACTIVITY</Text>
        <Pressable onPress={() => setShowAllActivity((v) => !v)}>
          <Text style={[styles.seeAll, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
            {showAllActivity ? "Show less" : `See all (${activity.length})`}
          </Text>
        </Pressable>
      </View>
      <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(showAllActivity ? activity : activity.slice(0, 3)).map((item, idx, arr) => {
          const tappable = !!item.binOrderId;
          const openBinOrder = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/bins?order=${encodeURIComponent(item.binOrderId!)}`);
          };
          return (
            <View key={item.id}>
              <Pressable
                onPress={tappable ? openBinOrder : undefined}
                disabled={!tappable}
                style={({ pressed }) => [styles.activityItem, { opacity: tappable && pressed ? 0.6 : 1 }]}
              >
                <View style={[styles.activityIcon, { backgroundColor: (ACTIVITY_ICON_COLORS[item.type] ?? colors.primary) + "20" }]}>
                  <Feather name={item.icon as any} size={14} color={ACTIVITY_ICON_COLORS[item.type] ?? colors.primary} />
                </View>
                <View style={styles.activityText}>
                  <Text style={[styles.activityTitle, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{item.text}</Text>
                  <Text style={[styles.activityTime, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{item.time}</Text>
                </View>
                {tappable && <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
              </Pressable>
              {idx < arr.length - 1 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            </View>
          );
        })}
      </View>

      {/* Latest Loads */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
          {isProvider ? "LATEST LOADS" : "MY RECENT REQUESTS"}
        </Text>
        <Pressable onPress={() => router.push("/(tabs)/jobs")}>
          <Text style={[styles.seeAll, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>See all</Text>
        </Pressable>
      </View>
      {jobs.slice(0, 3).map((job) => (
        <Pressable
          key={job.id}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/job/${job.id}`); }}
          style={[styles.miniJobCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.miniJobTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.miniJobProject, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{job.projectName}</Text>
              <Text style={[styles.miniJobMaterial, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                {job.material}{job.quantity > 0 ? ` • ${job.quantity.toLocaleString()} ${job.quantityUnit}` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.miniJobRate, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>${job.budgetPerHour}/hr</Text>
              {job.bidsCount > 0 && (
                <Text style={[styles.miniJobBids, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{job.bidsCount} bids</Text>
              )}
            </View>
          </View>
          <View style={styles.miniJobFooter}>
            <View style={[styles.miniJobMeta, { flex: 1 }]}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.miniJobAddress, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                {job.pickupAddress || "—"}
              </Text>
            </View>
            <View style={styles.miniJobMeta}>
              <Feather name="calendar" size={11} color={colors.mutedForeground} />
              <Text style={[styles.miniJobAddress, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{job.scheduledDate}</Text>
            </View>
            <View style={[styles.statusPill, {
              backgroundColor: job.status === "open" ? colors.primary + "20" : job.status === "in_progress" ? "#16a34a20" : job.status === "bidding" ? "#3b82f620" : colors.border,
            }]}>
              <Text style={[styles.statusPillText, {
                color: job.status === "open" ? colors.primary : job.status === "in_progress" ? "#16a34a" : job.status === "bidding" ? "#3b82f6" : colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
              }]}>
                {job.status.replace("_", " ").toUpperCase()}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, onPress, colors, highlight }: { icon: string; label: string; onPress: () => void; colors: any; highlight?: boolean }) {
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={[styles.action, { backgroundColor: highlight ? colors.primary + "10" : colors.card, borderColor: highlight ? colors.primary + "40" : colors.border }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: highlight ? colors.primary + "25" : colors.primary + "18" }]}>
        <Feather name={icon as any} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  greeting: { fontSize: 14 },
  name: { fontSize: 24, fontWeight: "700" as const, marginTop: 2 },
  company: { fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 22 },
  badge: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { fontSize: 10 },
  avatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  avatarText: { fontSize: 15, fontWeight: "700" as const },
  surgeBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 14, borderRadius: 10, marginBottom: 12 },
  surgeEmoji: { fontSize: 24 },
  surgeTitle: { fontSize: 14 },
  surgeSub: { fontSize: 12, marginTop: 2 },
  onlineBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, padding: 14, marginBottom: 12, borderRadius: 10 },
  onlineLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  onlinePulse: { width: 12, height: 12, borderRadius: 6 },
  onlineTitle: { fontSize: 15, fontWeight: "700" as const },
  onlineSub: { fontSize: 12, marginTop: 2 },
  payoutBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 14, marginBottom: 12, borderRadius: 10 },
  payoutIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  payoutTitle: { fontSize: 14 },
  payoutSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  fleetBar: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  fleetIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fleetTitle: { fontSize: 14 },
  fleetSub: { fontSize: 12, marginTop: 1 },
  fleetManage: { fontSize: 13 },
  walletCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 10, marginBottom: 20 },
  walletLeft: { gap: 4 },
  walletLabel: { fontSize: 12 },
  walletAmount: { fontSize: 24, fontWeight: "700" as const },
  walletRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  walletBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  walletBadgeText: { fontSize: 13 },
  sectionLabel: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 1.2, marginBottom: 10, marginTop: 4 },
  statsRow: { gap: 10, paddingBottom: 4, marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  seeAll: { fontSize: 13, fontWeight: "600" as const },
  mapPreview: { height: 160, borderWidth: 1, borderRadius: 10, marginBottom: 24, overflow: "hidden", position: "relative" },
  mapRoadH: { position: "absolute", left: 0, right: 0, height: 1 },
  mapRoadV: { position: "absolute", top: 0, bottom: 0, width: 1 },
  surgeZone: { position: "absolute", width: 44, height: 44, borderRadius: 22, backgroundColor: "#f59e0b20", alignItems: "center", justifyContent: "center" },
  surgeZoneEmoji: { fontSize: 18 },
  mapDot: { position: "absolute", width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "#ffffff30" },
  userDot: { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: "#3b82f620", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#3b82f640" },
  userDotInner: { width: 10, height: 10, borderRadius: 5 },
  mapOverlay: { position: "absolute", bottom: 10, left: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  mapBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  mapBadgeText: { fontSize: 12 },
  mapSurgeBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  mapSurgeText: { fontSize: 11, color: "#fef9c3", fontWeight: "600" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  action: { width: "47.5%", padding: 16, borderWidth: 1, alignItems: "flex-start", gap: 10, borderRadius: 8 },
  actionIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  actionLabel: { fontSize: 14, fontWeight: "500" as const },
  activityCard: { borderWidth: 1, marginBottom: 24, borderRadius: 10 },
  activityItem: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12 },
  activityIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 8 },
  activityText: { flex: 1, gap: 3 },
  activityTitle: { fontSize: 13, lineHeight: 18 },
  activityTime: { fontSize: 11 },
  divider: { height: 1, marginHorizontal: 14 },
  miniJobCard: { borderWidth: 1, padding: 14, marginBottom: 10, gap: 10, borderRadius: 10 },
  miniJobTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  miniJobProject: { fontSize: 14, fontWeight: "600" as const, marginBottom: 2 },
  miniJobMaterial: { fontSize: 12 },
  miniJobRate: { fontSize: 15, fontWeight: "700" as const, textAlign: "right" },
  miniJobBids: { fontSize: 11, textAlign: "right" },
  miniJobFooter: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  miniJobMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  miniJobAddress: { fontSize: 12 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginLeft: "auto" },
  statusPillText: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.5 },
});
