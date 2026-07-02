import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  Alert, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useClerk } from "@clerk/expo";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { RefreshingIndicator, isRefreshingPillVisible } from "@/components/RefreshingIndicator";
import { LastUpdated } from "@/components/LastUpdated";
import { ACCENT } from "@/constants/theme";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useCompliance, useSubmitCompliance, useVerifyCompliance, useCreditApplication, useSubmitCreditApplication, useQBStatus, useQBConnect, useQBSync, useQBDisconnect, usePayoutStatus, useConnectStripe, useMyProfile, useAdminAccess, useAdminCompliance, useAdminCreditApplications, useStuckPayouts, useWallet, useAccountStatus, useLiveActivity } from "@/hooks/useLiveApi";
import { useUnreadCount } from "@/hooks/useUnreadCount";

const COMPLIANCE_ITEMS = [
  { id: "w9", label: "W-9 Tax Form", icon: "file-text", done: false },
  { id: "ins", label: "Insurance Certificate", icon: "shield", done: false },
  { id: "pay", label: "Payment Method", icon: "credit-card", done: false },
  { id: "payout", label: "Payout Account", icon: "dollar-sign", done: false },
];

const PROVIDER_COMPLIANCE = [
  { id: "w9", label: "W-9 Tax Form", icon: "file-text", done: false },
  { id: "ins", label: "Insurance Certificate", icon: "shield", done: false },
  { id: "fmcsa", label: "FMCSA Registration", icon: "truck", done: false },
  { id: "cdl", label: "CDL on File", icon: "user-check", done: false },
  { id: "payout", label: "Payout Account", icon: "dollar-sign", done: false },
];

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, isOnline, setIsOnline } = useApp();

  const [notifPush, setNotifPush] = useState(true);
  const [notifSMS, setNotifSMS] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifBids, setNotifBids] = useState(true);
  const [notifJobs, setNotifJobs] = useState(true);
  const [notifPayments, setNotifPayments] = useState(true);
  const { signOut } = useClerk();
  const complianceQuery = useCompliance();
  const submitCompliance = useSubmitCompliance();
  const verifyCompliance = useVerifyCompliance();
  const creditQuery = useCreditApplication();
  const submitCredit = useSubmitCreditApplication();
  const qbStatus = useQBStatus();
  const qbConnect = useQBConnect();
  const qbSync = useQBSync();
  const qbDisconnect = useQBDisconnect();
  const payoutStatus = usePayoutStatus();
  const connectStripe = useConnectStripe();
  const myProfile = useMyProfile();
  const adminAccess = useAdminAccess();
  const isAdmin = !!adminAccess.data?.isAdmin;
  const adminPerms = adminAccess.data?.permissions ?? [];
  const canCompliance = adminPerms.includes("compliance");
  const canCredit = adminPerms.includes("credit");
  const canPayouts = adminPerms.includes("payouts");

  // Admin review badges with focus-gated auto-refresh. Poll every 30s while the
  // Account tab is focused; pause polling when it isn't visible.
  const [accountFocused, setAccountFocused] = useState(false);
  const adminCompliance = useAdminCompliance({ enabled: canCompliance });
  const adminCredit = useAdminCreditApplications({ enabled: canCredit });
  const stuckPayouts = useStuckPayouts({
    enabled: canPayouts,
    refetchInterval: accountFocused && canPayouts ? 30000 : false,
  });
  const activityQuery = useLiveActivity();
  const failedPaymentCount = Array.isArray(activityQuery.data)
    ? activityQuery.data.filter((a: { type?: string }) => a.type === "payment_failed").length
    : 0;

  const compliancePending = Array.isArray(adminCompliance.data)
    ? adminCompliance.data.filter((i) => i.status === "pending" || i.status === "not_submitted").length
    : 0;
  const creditPending = Array.isArray(adminCredit.data)
    ? adminCredit.data.filter((i) => i.status === "pending").length
    : 0;
  const stuckPayoutsCount = Array.isArray(stuckPayouts.data) ? stuckPayouts.data.length : 0;

  const adminBadgeCounts: Record<string, number> = {
    "admin-compliance": compliancePending,
    "admin-credit": creditPending,
    "admin-payouts": stuckPayoutsCount,
  };

  useFocusEffect(
    useCallback(() => {
      setAccountFocused(true);
      if (canCompliance) adminCompliance.refetch();
      if (canCredit) adminCredit.refetch();
      if (canPayouts) stuckPayouts.refetch();
      return () => setAccountFocused(false);
    }, [canCompliance, canCredit, canPayouts]),
  );

  const openStripeOnboarding = useCallback(async () => {
    try {
      // Deep link Stripe should bounce back to when onboarding finishes/exits.
      // openAuthSessionAsync auto-closes the in-app browser once it sees this URL.
      const returnTo = Linking.createURL("payouts-return");
      const { url } = await connectStripe.mutateAsync({ returnTo });
      await WebBrowser.openAuthSessionAsync(url, returnTo);
      // Browser closed (returned, dismissed, or cancelled) — refresh status.
      payoutStatus.refetch();
    } catch (err: any) {
      Alert.alert("Couldn't open Stripe", err?.message ?? "Please try again.");
    }
  }, [connectStripe, payoutStatus]);

  const [dotNumber, setDotNumber] = useState("");
  const [mcNumber, setMcNumber] = useState("");
  const [cdlNumber, setCdlNumber] = useState("");
  const [cdlState, setCdlState] = useState("");
  const [cdlClass, setCdlClass] = useState("");
  const [wantsInvoicing, setWantsInvoicing] = useState(false);
  const [tradeReferences, setTradeReferences] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [estimatedMonthlySpend, setEstimatedMonthlySpend] = useState("");
  const [submittingCredit, setSubmittingCredit] = useState(false);
  const [qbCompany, setQbCompany] = useState("");
  const [showQbConnect, setShowQbConnect] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const liveCompliance = complianceQuery.data;
  const dotVerified = liveCompliance?.dotVerified ?? false;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([complianceQuery.refetch(), qbStatus.refetch(), payoutStatus.refetch()]).finally(() => setRefreshing(false));
  }, [complianceQuery, qbStatus, payoutStatus]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      router.replace("/sign-in" as any);
    } catch (err: any) {
      Alert.alert("Sign out failed", err?.message ?? "Please try again.");
    }
  }, [signOut]);

  const confirmSignOut = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: handleSignOut },
    ]);
  }, [handleSignOut]);

  // Subtle "Updating…" pill for a background refetch over cached account data
  // (e.g. the foreground refetch after reopening the app), excluding the manual
  // pull-to-refresh which already shows its own spinner.
  const isUpdating = isRefreshingPillVisible({
    isFetching:
      complianceQuery.isFetching ||
      creditQuery.isFetching ||
      payoutStatus.isFetching ||
      qbStatus.isFetching ||
      myProfile.isFetching ||
      adminCompliance.isFetching ||
      adminCredit.isFetching ||
      stuckPayouts.isFetching,
    refreshing,
  });

  // Freshness of the account data: the most recent successful refetch across
  // the live queries feeding this screen.
  const lastUpdated =
    Math.max(
      complianceQuery.dataUpdatedAt,
      creditQuery.dataUpdatedAt,
      payoutStatus.dataUpdatedAt,
      qbStatus.dataUpdatedAt,
      myProfile.dataUpdatedAt,
    ) || undefined;

  const isProvider = profile.role === "provider";
  const baseCompliance = isProvider ? PROVIDER_COMPLIANCE : COMPLIANCE_ITEMS;
  const accountStatus = useAccountStatus();
  const acct = accountStatus.data as any;
  const liveDone: Record<string, boolean> = {
    w9: acct?.w9Status === "verified",
    ins: acct?.insuranceStatus === "verified",
    pay: acct?.paymentStatus === "set",
    payout: !!payoutStatus.data?.payoutsEnabled,
    fmcsa: dotVerified,
  };
  const compliance = baseCompliance.map((c) => ({
    ...c,
    done: c.id in liveDone ? liveDone[c.id] : c.done,
  }));
  const completedCount = compliance.filter((c) => c.done).length;
  const pct = Math.round((completedCount / compliance.length) * 100);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const unreadCount = useUnreadCount();
  const walletQuery = useWallet({ enabled: isProvider });
  const availableBalance = walletQuery.data?.availableBalance ?? 0;

  const handleFMCSAVerify = async () => {
    const dot = dotNumber.trim() || liveCompliance?.dotNumber;
    if (!dot) {
      Alert.alert("Enter DOT Number", "Please enter your USDOT number to verify.");
      return;
    }
    setVerifying(true);
    try {
      await submitCompliance.mutateAsync({
        dotNumber: dot,
        mcNumber: mcNumber.trim() || undefined,
        cdlNumber: cdlNumber.trim() || undefined,
        cdlState: cdlState.trim() || undefined,
        cdlClass: cdlClass.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Submitted ✅", `DOT #${dot} submitted for verification. Status will update shortly.`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not submit compliance info.");
    } finally {
      setVerifying(false);
    }
  };

  const handleRunVerify = async () => {
    setVerifying(true);
    try {
      await verifyCompliance.mutateAsync();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Verified ✅", "Authority & insurance checks passed (demo).");
    } catch (err: any) {
      Alert.alert("Verification failed", err?.message ?? "Could not run verification.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmitCredit = async () => {
    setSubmittingCredit(true);
    try {
      await submitCredit.mutateAsync({
        wantsInvoicing,
        tradeReferences: tradeReferences.trim() || undefined,
        bankReference: bankReference.trim() || undefined,
        estimatedMonthlySpend: estimatedMonthlySpend.trim() ? Number(estimatedMonthlySpend) : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Submitted ✅", "Your credit application is under review.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not submit credit application.");
    } finally {
      setSubmittingCredit(false);
    }
  };

  const handleQBConnect = async () => {
    if (!qbCompany.trim()) {
      Alert.alert("Company name required", "Enter your QuickBooks company name.");
      return;
    }
    try {
      await qbConnect.mutateAsync({ companyName: qbCompany.trim() });
      setShowQbConnect(false);
      setQbCompany("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Connected!", "QuickBooks Online connected successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not connect QuickBooks.");
    }
  };

  const handleQBSync = async () => {
    try {
      const result = await qbSync.mutateAsync();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Sync complete", `${result.invoicesSynced} invoice(s) synced. Total: ${result.totalSynced}.`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Sync failed.");
    }
  };

  const handleQBDisconnect = () => {
    Alert.alert("Disconnect QuickBooks?", "This will remove the QuickBooks connection.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => {
        await qbDisconnect.mutateAsync();
        Alert.alert("Disconnected", "QuickBooks has been disconnected.");
      }},
    ]);
  };

  const NAV_ROUTES: Record<string, string> = {
    help: "/help", terms: "/terms", privacy: "/privacy", language: "/language",
    notifications: "/notifications", fleet: "/fleet", team: "/team",
    "driver-docs": "/driver-docs", "driver-jobs": "/driver-jobs", foreman: "/foreman",
    "admin-payouts": "/admin-payouts",
    "admin-compliance": "/admin-compliance",
    "admin-credit": "/admin-credit",
  };

  // Live (backend) role drives the driver/foreman workflow screens — the demo
  // profile.role only toggles customer/provider.
  const liveRole = (myProfile.data as any)?.role as string | undefined;
  const isDriver = liveRole === "driver";
  const isForeman = liveRole === "supervisor";

  const isOwner = profile.role === "customer" || profile.role === "provider";
  const needsDriverDocs = profile.role === "driver" || profile.role === "provider" || profile.role === "customer";
  const docsLabel =
    profile.role === "provider" ? "Company Documents" :
    profile.role === "customer" ? "Billing Documents" :
    "Driver Documents";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RefreshingIndicator visible={isUpdating} />
      <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: 100 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e9a600" colors={["#e9a600"]} />
      }
    >
      {/* Profile Card */}
      <Animated.View entering={FadeInDown.delay(0).springify()}>
        <View style={[styles.profileCard, { backgroundColor: colors.secondary }]}>
          <View style={styles.profileTop}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: "#f0f6ff", fontFamily: "Inter_700Bold" }]}>{profile.name}</Text>
              <Text style={[styles.profileCompany, { color: "#8ba0b8", fontFamily: "Inter_400Regular" }]}>{profile.company}</Text>
              <Text style={[styles.profilePhone, { color: "#8ba0b8", fontFamily: "Inter_400Regular" }]}>{profile.phone}</Text>
            </View>
            <View style={styles.ratingWrap}>
              <Text style={[styles.ratingValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{profile.rating}★</Text>
              <Text style={[styles.ratingLabel, { color: "#8ba0b8", fontFamily: "Inter_400Regular" }]}>Rating</Text>
            </View>
            <Pressable
              onPress={confirmSignOut}
              accessibilityRole="button"
              accessibilityLabel="Header sign out"
              hitSlop={10}
              style={styles.headerSignOut}
            >
              <Feather name="log-out" size={18} color="#f87171" />
            </Pressable>
          </View>
          <View style={styles.profileMeta}>
            <View style={[styles.roleBadge, { backgroundColor: colors.primary + "25" }]}>
              <Feather name={isProvider ? "truck" : "briefcase"} size={12} color={colors.primary} />
              <Text style={[styles.roleText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                {isProvider ? "PROVIDER" : "CUSTOMER"}
              </Text>
            </View>
            <View style={styles.locationBadge}>
              <Feather name="map-pin" size={12} color="#8ba0b8" />
              <Text style={[styles.locationText, { color: "#8ba0b8", fontFamily: "Inter_400Regular" }]}>{profile.city}, {profile.state}</Text>
            </View>
            <View style={styles.locationBadge}>
              <Feather name="calendar" size={12} color="#8ba0b8" />
              <Text style={[styles.locationText, { color: "#8ba0b8", fontFamily: "Inter_400Regular" }]}>Since {profile.memberSince}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <LastUpdated timestamp={lastUpdated} style={{ alignSelf: "center", marginBottom: 12 }} />

      {failedPaymentCount > 0 && (
        <Animated.View entering={FadeInDown.delay(20).springify()}>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={[styles.alertBanner, { backgroundColor: "#dc262620", borderColor: "#dc262640" }]}
          >
            <Feather name="alert-circle" size={18} color="#dc2626" />
            <Text style={{ flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
              {failedPaymentCount} payment issue{failedPaymentCount !== 1 ? "s" : ""} need attention — tap to review
            </Text>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        </Animated.View>
      )}

      {/* Online/Offline Toggle (Provider) */}
      {isProvider && (
        <Animated.View entering={FadeInDown.delay(40).springify()}>
          <View style={[styles.onlineBanner, { backgroundColor: isOnline ? "#16a34a18" : colors.card, borderColor: isOnline ? "#16a34a40" : colors.border }]}>
            <View style={styles.onlineLeft}>
              <View style={[styles.onlineDot, { backgroundColor: isOnline ? "#16a34a" : "#6b7280" }]} />
              <View>
                <Text style={[styles.onlineTitle, { color: isOnline ? "#16a34a" : colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  {isOnline ? "Online" : "Offline"}
                </Text>
                <Text style={[styles.onlineSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {isOnline ? "Receiving job requests" : "Not accepting new jobs"}
                </Text>
              </View>
            </View>
            <Switch value={isOnline} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsOnline(v); }}
              trackColor={{ false: colors.border, true: "#16a34a" }} thumbColor="#ffffff" />
          </View>
        </Animated.View>
      )}

      {/* Wallet Card */}
      <Animated.View entering={FadeInDown.delay(isProvider ? 80 : 40).springify()}>
        <Pressable onPress={() => router.push("/wallet")} style={[styles.walletCard, { backgroundColor: colors.primary }]}>
          <View style={styles.walletLeft}>
            <View style={[styles.walletIcon, { backgroundColor: "#ffffff20" }]}>
              <Feather name="credit-card" size={18} color="#ffffff" />
            </View>
            <View>
              <Text style={[styles.walletLabel, { color: "#ffffffcc", fontFamily: "Inter_400Regular" }]}>
                {isProvider ? "Available Balance" : "Billing"}
              </Text>
              <Text style={[styles.walletAmount, { color: "#ffffff", fontFamily: "Inter_700Bold" }]}>
                {isProvider
                  ? `$${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "Payment methods & invoices"}
              </Text>
            </View>
          </View>
          <View style={styles.walletRight}>
            <Text style={[styles.walletManage, { color: "#ffffff99", fontFamily: "Inter_500Medium" }]}>Manage</Text>
            <Feather name="chevron-right" size={16} color="#ffffff99" />
          </View>
        </Pressable>
      </Animated.View>

      {/* FMCSA Verification (Provider) */}
      {isProvider && (
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>FMCSA / DOT VERIFICATION</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: dotVerified ? ACCENT.green + "50" : colors.border }]}>
            <View style={styles.fmcsaRow}>
              <View style={[styles.fmcsaIcon, { backgroundColor: dotVerified ? ACCENT.green + "15" : colors.background }]}>
                <Feather name="shield" size={22} color={dotVerified ? ACCENT.green : colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fmcsaTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>USDOT Number</Text>
                <Text style={[styles.fmcsaSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {dotVerified ? "Verified with FMCSA — Active carrier" : "Enter your DOT number to verify"}
                </Text>
              </View>
              {dotVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: ACCENT.green + "18" }]}>
                  <Feather name="check-circle" size={14} color={ACCENT.green} />
                  <Text style={[styles.verifiedText, { color: ACCENT.green, fontFamily: "Inter_600SemiBold" }]}>Verified</Text>
                </View>
              )}
            </View>
            <View style={[styles.dotInputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.dotPrefix, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>DOT #</Text>
              <TextInput
                style={[styles.dotInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                value={dotNumber || liveCompliance?.dotNumber || ""}
                onChangeText={setDotNumber}
                placeholder={liveCompliance?.dotNumber ?? "e.g. 3847291"}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
              <Pressable
                onPress={handleFMCSAVerify}
                style={[styles.verifyBtn, { backgroundColor: dotVerified ? colors.card : colors.primary }]}
              >
                <Text style={[styles.verifyBtnText, { color: dotVerified ? colors.mutedForeground : colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {verifying ? "Saving..." : "Submit"}
                </Text>
              </Pressable>
            </View>
            {/* MC number */}
            <View style={[styles.dotInputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.dotPrefix, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>MC #</Text>
              <TextInput
                style={[styles.dotInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                value={mcNumber || liveCompliance?.mcNumber || ""}
                onChangeText={setMcNumber}
                placeholder={liveCompliance?.mcNumber ?? "e.g. MC-123456"}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            {/* FMCSA authority checks */}
            <View style={{ gap: 6, paddingVertical: 4 }}>
              {[
                { key: "fmcsaAuthority", label: "Operating authority active" },
                { key: "insuranceActive", label: "Insurance on file (BOC-3)" },
                { key: "dotOperatingStatus", label: "DOT operating status OK" },
                { key: "notSuspended", label: "Not suspended / out-of-service" },
              ].map((chk) => {
                const ok = !!(liveCompliance as any)?.[chk.key];
                return (
                  <View key={chk.key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name={ok ? "check-circle" : "circle"} size={14} color={ok ? ACCENT.green : colors.mutedForeground} />
                    <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 }, { color: ok ? colors.foreground : colors.mutedForeground }]}>{chk.label}</Text>
                  </View>
                );
              })}
              {liveCompliance?.safetyRating ? (
                <Text style={[{ fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 }, { color: colors.mutedForeground }]}>Safety rating: {liveCompliance.safetyRating}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={handleRunVerify}
              disabled={verifying}
              style={[{ marginTop: 6, paddingVertical: 10, borderRadius: 8, alignItems: "center" }, { backgroundColor: ACCENT.green + (verifying ? "80" : "") }]}
            >
              <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#ffffff" }}>
                {verifying ? "Running checks..." : dotVerified ? "Re-run Authority Check" : "Run Authority Check"}
              </Text>
            </Pressable>
            {/* CDL info row */}
            <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8, borderTopWidth: 1 }, { borderColor: colors.border }]}>
              <View style={[{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" }, { backgroundColor: dotVerified ? ACCENT.green + "15" : colors.background }]}>
                <Feather name="user-check" size={16} color={dotVerified ? ACCENT.green : colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold" }, { color: colors.foreground }]}>CDL Verification</Text>
                <Text style={[{ fontSize: 11, marginTop: 1, fontFamily: "Inter_400Regular" }, { color: colors.mutedForeground }]}>
                  {dotVerified ? "CDL on file — Class A verified" : "Submit CDL details in Account → DOT / CDL tab"}
                </Text>
              </View>
              {dotVerified ? (
                <View style={[{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }, { backgroundColor: ACCENT.green + "18" }]}>
                  <Feather name="check-circle" size={12} color={ACCENT.green} />
                  <Text style={[{ fontSize: 11, fontFamily: "Inter_600SemiBold" }, { color: ACCENT.green }]}>Verified</Text>
                </View>
              ) : (
                <View style={[{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[{ fontSize: 11, fontFamily: "Inter_600SemiBold" }, { color: colors.primary }]}>Pending</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Payout Account — Stripe Connect (Provider) */}
      {isProvider && (
        <Animated.View entering={FadeInDown.delay(105).springify()}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>PAYOUT ACCOUNT</Text>
          {(() => {
            const ps = payoutStatus.data;
            const enabled = !!ps?.payoutsEnabled;
            const connected = !!ps?.connected;
            const submitted = !!ps?.detailsSubmitted;
            // Determine display state.
            const accent = enabled ? ACCENT.green : connected ? colors.primary : colors.mutedForeground;
            const title = enabled
              ? "Payouts enabled"
              : connected
                ? "Finish payout setup"
                : "Set up your payout account";
            const subtitle = payoutStatus.isLoading
              ? "Checking your payout status…"
              : enabled
                ? "You're all set — completed jobs pay out to your bank automatically."
                : connected
                  ? submitted
                    ? "Stripe is reviewing your details. Payouts turn on once approved — check back shortly."
                    : "You started onboarding but haven't finished. Complete it to receive job payments."
                  : "Connect a payout account with Stripe so you can receive money from completed jobs.";
            const btnLabel = enabled
              ? "Manage payout account"
              : connected
                ? "Continue onboarding"
                : "Connect payout account";
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: enabled ? ACCENT.green + "50" : colors.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: accent + "20", alignItems: "center", justifyContent: "center" }}>
                    <Feather name={enabled ? "check-circle" : "dollar-sign"} size={18} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 14, fontFamily: "Inter_700Bold" }, { color: colors.foreground }]}>{title}</Text>
                    <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 }, { color: colors.mutedForeground }]}>{subtitle}</Text>
                  </View>
                  {enabled && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: ACCENT.green + "18" }}>
                      <Feather name="check-circle" size={12} color={ACCENT.green} />
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: ACCENT.green }}>Active</Text>
                    </View>
                  )}
                </View>

                {connected && !enabled && (() => {
                  const currentlyDue = ps?.requirements?.currentlyDue ?? [];
                  const pendingVerification = ps?.requirements?.pendingVerification ?? [];
                  const deadline = ps?.requirements?.currentDeadline ?? null;
                  return (
                    <View style={{ gap: 10, paddingVertical: 10 }}>
                      {currentlyDue.length > 0 && (
                        <View style={{ gap: 6 }}>
                          <Text style={[{ fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 }, { color: colors.foreground }]}>
                            WHAT STRIPE STILL NEEDS
                          </Text>
                          {currentlyDue.map((req) => (
                            <View key={req.code} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                              <Feather name="alert-circle" size={14} color={colors.primary} style={{ marginTop: 1 }} />
                              <Text style={[{ fontSize: 12, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 17 }, { color: colors.foreground }]}>{req.label}</Text>
                            </View>
                          ))}
                          {deadline && (
                            <Text style={[{ fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 }, { color: ACCENT.red ?? colors.primary }]}>
                              Complete by {new Date(deadline * 1000).toLocaleDateString()} to avoid a payout hold.
                            </Text>
                          )}
                        </View>
                      )}

                      {pendingVerification.length > 0 && (
                        <View style={{ gap: 6 }}>
                          <Text style={[{ fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 }, { color: colors.mutedForeground }]}>
                            STRIPE IS REVIEWING
                          </Text>
                          {pendingVerification.map((req) => (
                            <View key={req.code} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                              <Feather name="clock" size={14} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                              <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 17 }, { color: colors.mutedForeground }]}>{req.label}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {currentlyDue.length === 0 && pendingVerification.length === 0 && (
                        <View style={{ gap: 6 }}>
                          {[
                            { ok: submitted, label: "Onboarding details submitted" },
                            { ok: !!ps?.chargesEnabled, label: "Charges enabled" },
                            { ok: enabled, label: "Payouts enabled" },
                          ].map((chk) => (
                            <View key={chk.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Feather name={chk.ok ? "check-circle" : "circle"} size={14} color={chk.ok ? ACCENT.green : colors.mutedForeground} />
                              <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 }, { color: chk.ok ? colors.foreground : colors.mutedForeground }]}>{chk.label}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })()}

                {!enabled && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
                    <Feather name="alert-circle" size={14} color={colors.primary} />
                    <Text style={[{ fontSize: 11, fontFamily: "Inter_500Medium", flex: 1 }, { color: colors.mutedForeground }]}>
                      Payments from completed jobs can't be released until payouts are enabled.
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={openStripeOnboarding}
                  disabled={connectStripe.isPending || payoutStatus.isLoading}
                  style={[{ marginTop: 12, paddingVertical: 11, borderRadius: 8, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }, { backgroundColor: enabled ? colors.background : colors.primary, borderWidth: enabled ? 1 : 0, borderColor: colors.border, opacity: connectStripe.isPending ? 0.7 : 1 }]}
                >
                  <Feather name="external-link" size={14} color={enabled ? colors.mutedForeground : colors.primaryForeground} />
                  <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold" }, { color: enabled ? colors.mutedForeground : colors.primaryForeground }]}>
                    {connectStripe.isPending ? "Opening Stripe…" : btnLabel}
                  </Text>
                </Pressable>
              </View>
            );
          })()}
        </Animated.View>
      )}

      {/* QuickBooks Sync (Provider) */}
      {isProvider && (
        <Animated.View entering={FadeInDown.delay(110).springify()}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>QUICKBOOKS SYNC</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {qbStatus.data?.connected ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#2CA01C20", alignItems: "center", justifyContent: "center" }}>
                    <Feather name="link" size={18} color="#2CA01C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 14, fontFamily: "Inter_600SemiBold" }, { color: colors.foreground }]}>{qbStatus.data.companyName}</Text>
                    <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular" }, { color: colors.mutedForeground }]}>
                      {qbStatus.data.invoicesSynced} invoices synced
                      {qbStatus.data.lastSyncedAt ? ` · Last: ${new Date(qbStatus.data.lastSyncedAt).toLocaleDateString()}` : ""}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: "#2CA01C20" }}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#2CA01C" }}>LIVE</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <Pressable
                    onPress={handleQBSync}
                    disabled={qbSync.isPending}
                    style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" }, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold" }, { color: colors.primaryForeground }]}>
                      {qbSync.isPending ? "Syncing..." : "Sync Now"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleQBDisconnect}
                    style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center", borderWidth: 1 }, { borderColor: colors.border }]}
                  >
                    <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold" }, { color: colors.mutedForeground }]}>Disconnect</Text>
                  </Pressable>
                </View>
              </>
            ) : showQbConnect ? (
              <>
                <Text style={[{ fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 }, { color: colors.mutedForeground }]}>
                  Enter your QuickBooks company name to connect:
                </Text>
                <View style={[{ flexDirection: "row", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <TextInput
                    style={[{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" }, { color: colors.foreground }]}
                    placeholder="Company name in QuickBooks"
                    placeholderTextColor={colors.mutedForeground}
                    value={qbCompany}
                    onChangeText={setQbCompany}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <Pressable
                    onPress={handleQBConnect}
                    disabled={qbConnect.isPending}
                    style={[{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" }, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold" }, { color: colors.primaryForeground }]}>
                      {qbConnect.isPending ? "Connecting..." : "Connect"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { setShowQbConnect(false); setQbCompany(""); }}
                    style={[{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 }, { borderColor: colors.border }]}
                  >
                    <Text style={[{ fontSize: 13, fontFamily: "Inter_400Regular" }, { color: colors.mutedForeground }]}>Cancel</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => setShowQbConnect(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
                  <Feather name="link" size={18} color={colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 14, fontFamily: "Inter_600SemiBold" }, { color: colors.foreground }]}>Connect QuickBooks</Text>
                  <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular" }, { color: colors.mutedForeground }]}>
                    Auto-sync completed job invoices
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* Compliance */}
      <Animated.View entering={FadeInDown.delay(120).springify()}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>COMPLIANCE STATUS</Text>
        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Profile Completion</Text>
            <Text style={[styles.progressPct, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{pct}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: pct >= 80 ? ACCENT.green : colors.primary, width: `${pct}%` as any }]} />
          </View>
        </View>
        {compliance.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Document items route to the upload screen.
              const docRoutes = ["w9", "ins", "fmcsa", "cdl"];
              if (docRoutes.includes(item.id)) {
                router.push("/driver-docs" as any);
                return;
              }
              // Payout Account → Stripe Connect Express onboarding.
              if (item.id === "payout") {
                openStripeOnboarding();
                return;
              }
              // Customer payment method: still pending.
              if (item.id === "pay") {
                router.push("/payment-method" as any);
                return;
              }
              if (!item.done) Alert.alert(item.label, `Tap to upload or complete your ${item.label}.`);
            }}
            style={[styles.complianceItem, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.compIcon, { backgroundColor: item.done ? "#16a34a20" : colors.primary + "18" }]}>
              <Feather name={item.icon as any} size={16} color={item.done ? "#16a34a" : colors.primary} />
            </View>
            <Text style={[styles.compLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{item.label}</Text>
            {item.done ? (
              <Feather name="check-circle" size={18} color="#16a34a" />
            ) : (
              <View style={[styles.compPendingBadge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.compPendingText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>Pending</Text>
              </View>
            )}
          </Pressable>
        ))}
      </Animated.View>

      {/* Credit Application (Customer) */}
      {!isProvider && (
        <Animated.View entering={FadeInDown.delay(140).springify()}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>CREDIT APPLICATION (NET TERMS)</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {creditQuery.data?.status ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center",
                  backgroundColor: (creditQuery.data.status === "approved" ? ACCENT.green : creditQuery.data.status === "rejected" ? "#dc2626" : colors.primary) + "20",
                }}>
                  <Feather
                    name={creditQuery.data.status === "approved" ? "check-circle" : creditQuery.data.status === "rejected" ? "x-circle" : "clock"}
                    size={18}
                    color={creditQuery.data.status === "approved" ? ACCENT.green : creditQuery.data.status === "rejected" ? "#dc2626" : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 14, fontFamily: "Inter_700Bold" }, { color: colors.foreground }]}>
                    {creditQuery.data.status === "approved" ? "Credit Approved" : creditQuery.data.status === "rejected" ? "Application Rejected" : "Under Review"}
                  </Text>
                  <Text style={[{ fontSize: 12, fontFamily: "Inter_400Regular" }, { color: colors.mutedForeground }]}>
                    {creditQuery.data.status === "approved"
                      ? "You can pay completed jobs on Net terms."
                      : creditQuery.data.status === "rejected"
                        ? "Pay by card up front. You can reapply."
                        : "Typically reviewed in 1–3 business days."}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={[{ fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 12 }, { color: colors.mutedForeground }]}>
                Apply for Net invoicing so you can hire trucks now and pay after the job.
              </Text>
            )}

            <Pressable
              onPress={() => setWantsInvoicing((v) => !v)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}
            >
              <Feather name={wantsInvoicing ? "check-square" : "square"} size={20} color={wantsInvoicing ? colors.primary : colors.mutedForeground} />
              <Text style={[{ fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }, { color: colors.foreground }]}>
                I want to pay by invoice (Net terms) instead of card up front
              </Text>
            </Pressable>

            <Text style={[styles.creditLabel, { color: colors.mutedForeground }]}>Estimated monthly spend ($)</Text>
            <View style={[styles.creditInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" }, { color: colors.foreground }]}
                placeholder="25000" placeholderTextColor={colors.mutedForeground}
                value={estimatedMonthlySpend} onChangeText={setEstimatedMonthlySpend} keyboardType="numeric"
              />
            </View>

            <Text style={[styles.creditLabel, { color: colors.mutedForeground }]}>Trade references</Text>
            <View style={[styles.creditInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" }, { color: colors.foreground }]}
                placeholder="Supplier names, contacts, account #s" placeholderTextColor={colors.mutedForeground}
                value={tradeReferences} onChangeText={setTradeReferences}
              />
            </View>

            <Text style={[styles.creditLabel, { color: colors.mutedForeground }]}>Bank reference</Text>
            <View style={[styles.creditInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[{ flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" }, { color: colors.foreground }]}
                placeholder="Bank name & account officer" placeholderTextColor={colors.mutedForeground}
                value={bankReference} onChangeText={setBankReference}
              />
            </View>

            <Pressable
              onPress={handleSubmitCredit}
              disabled={submittingCredit}
              style={[{ marginTop: 12, paddingVertical: 12, borderRadius: 8, alignItems: "center" }, { backgroundColor: colors.primary, opacity: submittingCredit ? 0.6 : 1 }]}
            >
              <Text style={[{ fontSize: 14, fontFamily: "Inter_700Bold" }, { color: colors.primaryForeground }]}>
                {submittingCredit ? "Submitting..." : creditQuery.data?.status ? "Update & Resubmit" : "Submit Credit Application"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Platform Stats */}
      <Animated.View entering={FadeInDown.delay(200).springify()}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>PLATFORM STATS</Text>
        <View style={styles.statsRow}>
          {isProvider ? (
            <>
              <StatItem label="Total Hauls" value={profile.totalHauls.toString()} colors={colors} />
              <StatItem label="Tons Hauled" value="14.2k" colors={colors} />
              <StatItem label="Rating" value={`${profile.rating}★`} colors={colors} />
            </>
          ) : (
            <>
              <StatItem label="Jobs Posted" value="12" colors={colors} />
              <StatItem label="Completed" value="10" colors={colors} />
              <StatItem label="Avg Bids" value="5.4" colors={colors} />
            </>
          )}
        </View>
      </Animated.View>

      {/* Notification Preferences */}
      <Animated.View entering={FadeInDown.delay(260).springify()}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NOTIFICATION PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Channels */}
          <Text style={[styles.prefGroupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>CHANNELS</Text>
          <NotifToggle label="Push Notifications" icon="bell" value={notifPush} onChange={setNotifPush} colors={colors} />
          <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />
          <NotifToggle label="SMS Alerts" icon="message-square" value={notifSMS} onChange={setNotifSMS} colors={colors} />
          <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />
          <NotifToggle label="Email Digest" icon="mail" value={notifEmail} onChange={setNotifEmail} colors={colors} />

          <View style={[styles.prefGroupDivider, { backgroundColor: colors.border }]} />

          {/* Topics */}
          <Text style={[styles.prefGroupLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>NOTIFY ME ABOUT</Text>
          <NotifToggle label="Bid Activity" icon="trending-up" value={notifBids} onChange={setNotifBids} colors={colors} accent="#e9a600" />
          <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />
          <NotifToggle label="Job Updates" icon="briefcase" value={notifJobs} onChange={setNotifJobs} colors={colors} accent={ACCENT.green} />
          <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />
          <NotifToggle label="Payments & Earnings" icon="dollar-sign" value={notifPayments} onChange={setNotifPayments} colors={colors} accent={ACCENT.blue} />

          {unreadCount > 0 && (
            <>
              <View style={[styles.prefGroupDivider, { backgroundColor: colors.border }]} />
              <Pressable
                onPress={() => router.push("/notifications")}
                style={[styles.viewNotifBtn, { backgroundColor: colors.primary + "10" }]}
              >
                <Feather name="bell" size={15} color={colors.primary} />
                <Text style={[styles.viewNotifText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                  View {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
                </Text>
                <Feather name="chevron-right" size={14} color={colors.primary} />
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>

      {/* Settings */}
      <Animated.View entering={FadeInDown.delay(320).springify()}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>SETTINGS</Text>
        {[
          { id: "notifications", label: "All Notifications", icon: "bell", type: "nav" as const },
          ...(isDriver ? [{ id: "driver-jobs", label: "My Loads", icon: "truck", type: "nav" as const }] : []),
          ...(isForeman ? [{ id: "foreman", label: "Site Jobs", icon: "clipboard", type: "nav" as const }] : []),
          ...(isOwner ? [{ id: "team", label: isProvider ? "Drivers & Team" : "Supervisors & Team", icon: "users", type: "nav" as const }] : []),
          ...(isProvider ? [{ id: "fleet", label: "Fleet Manager", icon: "truck", type: "nav" as const }] : []),
          ...(needsDriverDocs ? [{ id: "driver-docs", label: docsLabel, icon: "file-text", type: "nav" as const }] : []),
          ...(canCompliance ? [{ id: "admin-compliance", label: "Carrier Review", icon: "truck", type: "nav" as const }] : []),
          ...(canCredit ? [{ id: "admin-credit", label: "Credit Review", icon: "credit-card", type: "nav" as const }] : []),
          ...(canPayouts ? [{ id: "admin-payouts", label: "Stuck Payouts", icon: "dollar-sign", type: "nav" as const }] : []),
          { id: "language", label: "Language", icon: "globe", type: "nav" as const },
          { id: "help", label: "Help & Support", icon: "help-circle", type: "nav" as const },
          { id: "terms", label: "Terms of Service", icon: "book", type: "nav" as const },
          { id: "privacy", label: "Privacy Policy", icon: "lock", type: "nav" as const },
        ].map((item) => (
          <Pressable
            key={item.id}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(NAV_ROUTES[item.id] as any); }}
            style={[styles.settingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.settingLeft}>
              <Feather name={item.icon as any} size={18} color={colors.mutedForeground} />
              <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{item.label}</Text>
            </View>
            <View style={styles.settingRight}>
              {isAdmin && adminBadgeCounts[item.id] > 0 && (
                <View style={[styles.adminCountBadge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.adminCountText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                    {adminBadgeCounts[item.id]}
                  </Text>
                </View>
              )}
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
          </Pressable>
        ))}
      </Animated.View>

      {/* Sign Out */}
      <Animated.View entering={FadeInDown.delay(400).springify()}>
        <Pressable
          onPress={confirmSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign Out"
          style={[styles.signOutBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="log-out" size={18} color={colors.destructive} />
          <Text style={[styles.signOutText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>Sign Out</Text>
        </Pressable>
        <Text style={[styles.version, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          HaulBrokr v2.0.0 • Built for construction professionals
        </Text>
      </Animated.View>
      </ScrollView>
    </View>
  );
}

function NotifToggle({ label, icon, value, onChange, colors, accent }: { label: string; icon: string; value: boolean; onChange: (v: boolean) => void; colors: any; accent?: string }) {
  return (
    <View style={styles.notifRow}>
      <Feather name={icon as any} size={16} color={accent ?? colors.mutedForeground} />
      <Text style={[styles.notifLabel, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(v); }}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function StatItem({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[styles.statItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  profileCard: { padding: 20, marginBottom: 16, gap: 14, borderRadius: 12 },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 16 },
  profileTop: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  avatar: { width: 56, height: 56, alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: 28 },
  avatarText: { fontSize: 20, fontWeight: "700" as const },
  profileInfo: { flex: 1, gap: 3 },
  profileName: { fontSize: 18, fontWeight: "700" as const },
  profileCompany: { fontSize: 14 },
  profilePhone: { fontSize: 13 },
  ratingWrap: { alignItems: "center", gap: 3 },
  headerSignOut: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#f8717115", borderWidth: 1, borderColor: "#f8717140",
    alignItems: "center", justifyContent: "center", marginLeft: 4,
  },
  ratingValue: { fontSize: 18, fontWeight: "700" as const },
  ratingLabel: { fontSize: 11 },
  profileMeta: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  roleText: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.8 },
  locationBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: { fontSize: 12 },
  switchRoleBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, alignSelf: "flex-start", borderRadius: 8 },
  switchRoleText: { fontSize: 13, fontWeight: "500" as const },
  onlineBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, padding: 14, marginBottom: 14, borderRadius: 10 },
  onlineLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  onlineDot: { width: 12, height: 12, borderRadius: 6 },
  onlineTitle: { fontSize: 15, fontWeight: "700" as const },
  onlineSub: { fontSize: 12, marginTop: 2 },
  walletCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 12, marginBottom: 24 },
  walletLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  walletIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  walletLabel: { fontSize: 12 },
  walletAmount: { fontSize: 20, fontWeight: "700" as const },
  walletRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  walletManage: { fontSize: 13 },
  sectionLabel: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 1.2, marginBottom: 12, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 24 },
  fmcsaRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  fmcsaIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  fmcsaTitle: { fontSize: 15 },
  fmcsaSub: { fontSize: 12, marginTop: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  verifiedText: { fontSize: 12 },
  dotInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  dotPrefix: { paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 },
  dotInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  creditLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4, marginBottom: 6, marginTop: 4 },
  creditInput: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  verifyBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  verifyBtnText: { fontSize: 13 },
  progressCard: { borderWidth: 1, padding: 16, marginBottom: 10, gap: 12, borderRadius: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle: { fontSize: 14, fontWeight: "600" as const },
  progressPct: { fontSize: 18, fontWeight: "700" as const },
  progressTrack: { height: 6, width: "100%", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  complianceItem: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderTopWidth: 0, padding: 14 },
  compIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 8 },
  compLabel: { flex: 1, fontSize: 14, fontWeight: "500" as const },
  compPendingBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  compPendingText: { fontSize: 11, fontWeight: "600" as const },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  statItem: { flex: 1, borderWidth: 1, padding: 14, alignItems: "center", gap: 4, borderRadius: 10 },
  statValue: { fontSize: 22, fontWeight: "700" as const },
  statLabel: { fontSize: 11, textAlign: "center" },
  prefGroupLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  prefDivider: { height: 1, marginVertical: 2 },
  prefGroupDivider: { height: 1, marginVertical: 12 },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  notifLabel: { flex: 1, fontSize: 14 },
  viewNotifBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  viewNotifText: { flex: 1, fontSize: 13 },
  settingItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderTopWidth: 0, paddingHorizontal: 14, paddingVertical: 14 },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  settingRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  adminCountBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, alignItems: "center", justifyContent: "center" },
  adminCountText: { fontSize: 12 },
  settingLabel: { fontSize: 15 },
  signOutBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, padding: 16, marginTop: 24, marginBottom: 16, justifyContent: "center", borderRadius: 10 },
  signOutText: { fontSize: 15, fontWeight: "600" as const },
  version: { fontSize: 12, textAlign: "center", marginBottom: 8 },
});
