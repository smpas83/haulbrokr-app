import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  useFactoringRequests,
  useRequestFactoring,
  useWallet,
  type WalletTransaction,
} from "@/hooks/useLiveApi";

function fmtMoney(n: number): string {
  return `$${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TX_META: Record<
  WalletTransaction["type"],
  { icon: string; color: string }
> = {
  earning: { icon: "arrow-down-left", color: "#16a34a" },
  payout: { icon: "arrow-up-right", color: "#0891b2" },
  factoring: { icon: "zap", color: "#f59e0b" },
};

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const isProvider = profile.role === "provider" || profile.role === "driver";

  const walletQuery = useWallet({ enabled: isProvider });
  const factoringQuery = useFactoringRequests();
  const requestFactoring = useRequestFactoring();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        isProvider ? walletQuery.refetch() : Promise.resolve(),
        factoringQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [isProvider, walletQuery, factoringQuery]);

  const wallet = walletQuery.data;
  const payout = wallet?.payoutAccount;
  const transactions = wallet?.transactions ?? [];

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 8, paddingBottom: 100 + insets.bottom },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text
          style={[
            styles.pageTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {isProvider ? "Wallet" : "Billing"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {!isProvider ? (
        <CustomerBilling colors={colors} />
      ) : walletQuery.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : walletQuery.isError ? (
        <View
          style={[
            styles.errorCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="alert-circle" size={20} color="#ef4444" />
          <Text
            style={[
              styles.errorText,
              { color: colors.foreground, fontFamily: "Inter_500Medium" },
            ]}
          >
            Couldn't load your wallet. Pull to refresh.
          </Text>
        </View>
      ) : (
        <>
          {/* Balance card */}
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <View
              style={[styles.balanceCard, { backgroundColor: colors.primary }]}
            >
              <View
                style={[
                  styles.balanceIconWrap,
                  { backgroundColor: colors.primaryForeground + "20" },
                ]}
              >
                <Feather
                  name="dollar-sign"
                  size={24}
                  color={colors.primaryForeground}
                />
              </View>
              <Text
                style={[
                  styles.balanceLabel,
                  {
                    color: colors.primaryForeground + "cc",
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                Available Balance
              </Text>
              <Text
                style={[
                  styles.balanceAmount,
                  {
                    color: colors.primaryForeground,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {fmtMoney(wallet?.availableBalance ?? 0)}
              </Text>
              <View style={styles.balanceStats}>
                <View style={styles.balanceStat}>
                  <Text
                    style={[
                      styles.balanceStatVal,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {fmtMoney(wallet?.pendingBalance ?? 0)}
                  </Text>
                  <Text
                    style={[
                      styles.balanceStatLabel,
                      {
                        color: colors.primaryForeground + "99",
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    Pending Release
                  </Text>
                </View>
                <View
                  style={[
                    styles.balanceStatDivider,
                    { backgroundColor: colors.primaryForeground + "30" },
                  ]}
                />
                <View style={styles.balanceStat}>
                  <Text
                    style={[
                      styles.balanceStatVal,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {fmtMoney(wallet?.lifetimeEarnings ?? 0)}
                  </Text>
                  <Text
                    style={[
                      styles.balanceStatLabel,
                      {
                        color: colors.primaryForeground + "99",
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    Lifetime Earned
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Payout account */}
          <Animated.View entering={FadeInDown.delay(40).springify()}>
            {payout?.payoutsEnabled ? (
              <View
                style={[
                  styles.payoutCard,
                  { backgroundColor: colors.card, borderColor: "#16a34a40" },
                ]}
              >
                <View
                  style={[styles.payoutIcon, { backgroundColor: "#16a34a18" }]}
                >
                  <Feather name="check-circle" size={18} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.payoutTitle,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Payouts Active
                  </Text>
                  <Text
                    style={[
                      styles.payoutSub,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {payout.bankLast4 ? `Bank •••• ${payout.bankLast4} · ` : ""}
                    Completed jobs pay out automatically.
                  </Text>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(tabs)/account");
                }}
                style={[
                  styles.payoutCard,
                  {
                    backgroundColor: colors.primary + "10",
                    borderColor: colors.primary + "40",
                  },
                ]}
              >
                <View
                  style={[
                    styles.payoutIcon,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Feather
                    name="alert-circle"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.payoutTitle,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Set up your payout account
                  </Text>
                  <Text
                    style={[
                      styles.payoutSub,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    Connect a payout account with Stripe to receive money from
                    completed jobs.
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={colors.primary}
                />
              </Pressable>
            )}
          </Animated.View>

          {/* Invoice Factoring */}
          <Animated.View
            entering={FadeInDown.delay(60).springify()}
            style={{ marginBottom: 16 }}
          >
            <View
              style={[
                styles.factorBanner,
                { borderColor: "#f59e0b50", backgroundColor: "#f59e0b0d" },
              ]}
            >
              <View
                style={[styles.factorIcon, { backgroundColor: "#f59e0b20" }]}
              >
                <Feather name="zap" size={20} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.factorTitle, { color: "#92400e" }]}>
                  Invoice Factoring
                </Text>
                <Text style={[styles.factorSub, { color: "#b45309" }]}>
                  97% advance same-day · 3% fee · No net-30 waiting
                </Text>
              </View>
            </View>
            {factoringQuery.isLoading ? (
              <ActivityIndicator
                color="#f59e0b"
                size="small"
                style={{ marginVertical: 8 }}
              />
            ) : (factoringQuery.data ?? []).length === 0 ? (
              <Text style={[styles.factorEmpty, { color: "#b45309" }]}>
                No factoring requests yet. Submit one from a completed job.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {(factoringQuery.data ?? []).map((req: any) => {
                  const statusColor =
                    req.status === "approved"
                      ? "#16a34a"
                      : req.status === "rejected"
                        ? "#ef4444"
                        : "#f59e0b";
                  return (
                    <View
                      key={req.id}
                      style={[
                        styles.factorRow,
                        {
                          borderColor: "#f59e0b30",
                          backgroundColor: "#f59e0b08",
                        },
                      ]}
                    >
                      <Feather name="file-text" size={16} color="#f59e0b" />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.factorRowTitle, { color: "#92400e" }]}
                        >
                          Job #{req.jobId}
                        </Text>
                        {req.invoiceAmount ? (
                          <Text
                            style={[styles.factorRowSub, { color: "#b45309" }]}
                          >
                            ${req.invoiceAmount?.toLocaleString()} · Advance: $
                            {req.advanceAmount?.toLocaleString()}
                          </Text>
                        ) : null}
                      </View>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: statusColor + "20",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Inter_700Bold",
                            color: statusColor,
                          }}
                        >
                          {req.status?.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Animated.View>

          {/* Transaction history */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              TRANSACTION HISTORY
            </Text>
            {transactions.length === 0 ? (
              <View
                style={[
                  styles.txEmpty,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="inbox" size={28} color={colors.border} />
                <Text
                  style={[
                    styles.txEmptyText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  No transactions yet. Earnings appear here as jobs complete.
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.txCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {transactions.map((tx, idx) => (
                  <View key={tx.id}>
                    <TransactionRow tx={tx} colors={colors} />
                    {idx < transactions.length - 1 && (
                      <View
                        style={[
                          styles.txDivider,
                          { backgroundColor: colors.border },
                        ]}
                      />
                    )}
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </>
      )}
    </ScrollView>
  );
}

function CustomerBilling({ colors }: { colors: any }) {
  return (
    <Animated.View entering={FadeInDown.delay(0).springify()}>
      <View
        style={[
          styles.billingCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.billingIcon,
            { backgroundColor: colors.primary + "18" },
          ]}
        >
          <Feather name="credit-card" size={22} color={colors.primary} />
        </View>
        <Text
          style={[
            styles.billingTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Pay-as-you-go billing
        </Text>
        <Text
          style={[
            styles.billingSub,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          You're charged per job when work is completed and approved. Manage
          your payment method and view invoices from each job's detail screen.
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)/jobs");
          }}
          style={[styles.billingBtn, { backgroundColor: colors.primary }]}
        >
          <Feather
            name="briefcase"
            size={18}
            color={colors.primaryForeground}
          />
          <Text
            style={[
              styles.billingBtnText,
              { color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
            ]}
          >
            View My Jobs
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function TransactionRow({
  tx,
  colors,
}: {
  tx: WalletTransaction;
  colors: any;
}) {
  const meta = TX_META[tx.type] ?? TX_META.earning;
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: meta.color + "20" }]}>
        <Feather name={meta.icon as any} size={14} color={meta.color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            styles.txDesc,
            { color: colors.foreground, fontFamily: "Inter_500Medium" },
          ]}
          numberOfLines={1}
        >
          {tx.description}
        </Text>
        <View style={styles.txMeta}>
          <Text
            style={[
              styles.txDate,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {fmtDate(tx.createdAt)}
          </Text>
          {tx.status &&
            tx.status !== "paid" &&
            tx.status !== "released" &&
            tx.status !== "approved" && (
              <Text
                style={[
                  styles.txPending,
                  { color: "#f59e0b", fontFamily: "Inter_500Medium" },
                ]}
              >
                {" "}
                • {tx.status}
              </Text>
            )}
        </View>
      </View>
      <Text
        style={[
          styles.txAmount,
          { color: meta.color, fontFamily: "Inter_700Bold" },
        ]}
      >
        {tx.type === "payout" ? "-" : "+"}
        {fmtMoney(tx.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
  pageTitle: { fontSize: 18 },
  loadingWrap: { paddingTop: 60, alignItems: "center" },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  errorText: { fontSize: 14, flex: 1 },

  balanceCard: { borderRadius: 20, padding: 22, marginBottom: 14 },
  balanceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  balanceLabel: { fontSize: 13 },
  balanceAmount: { fontSize: 38, marginTop: 4, letterSpacing: -1 },
  balanceStats: { flexDirection: "row", alignItems: "center", marginTop: 18 },
  balanceStat: { flex: 1, alignItems: "flex-start" },
  balanceStatVal: { fontSize: 16 },
  balanceStatLabel: { fontSize: 11, marginTop: 2 },
  balanceStatDivider: { width: 1, height: 32, marginHorizontal: 16 },

  payoutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  payoutIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  payoutTitle: { fontSize: 14 },
  payoutSub: { fontSize: 12, lineHeight: 16, marginTop: 2 },

  factorBanner: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },
  factorIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  factorTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  factorSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  factorEmpty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginVertical: 4,
  },
  factorRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  factorRowTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  factorRowSub: { fontSize: 12, fontFamily: "Inter_400Regular" },

  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  txCard: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  txEmpty: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  txEmptyText: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  txDesc: { fontSize: 14 },
  txMeta: { flexDirection: "row", alignItems: "center" },
  txDate: { fontSize: 12 },
  txPending: { fontSize: 12, textTransform: "capitalize" },
  txAmount: { fontSize: 15 },
  txDivider: { height: 1, marginLeft: 62 },

  billingCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  billingIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  billingTitle: { fontSize: 18, textAlign: "center" },
  billingSub: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  billingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 20,
    alignSelf: "stretch",
  },
  billingBtnText: { fontSize: 15 },
});
