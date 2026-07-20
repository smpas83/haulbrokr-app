import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, RefreshControl,
  ScrollView, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { ACCENT } from "@/constants/theme";
import {
  useAdminAccess, useAdminCreditApplications, useReviewCreditApplication,
  type AdminCreditApplicationItem,
} from "@/hooks/useLiveApi";
import { ReviewActions, ReviewBadge, styles } from "./admin-compliance";

function money(n: number | null): string {
  return n != null ? `$${n.toLocaleString("en-US")}` : "—";
}

export default function AdminCreditScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const access = useAdminAccess();
  const isAdmin = (access.data?.permissions ?? []).includes("credit");

  const credit = useAdminCreditApplications({ enabled: isAdmin });
  const items = Array.isArray(credit.data) ? credit.data : [];
  const pending = items.filter((i) => i.status === "pending").length;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    credit.refetch().finally(() => setRefreshing(false));
  }, [credit]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: topPad + 12 }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Credit Review</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {isAdmin ? `${pending} awaiting review` : "Admin only"}
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="credit-card" size={18} color={colors.primary} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF5500" colors={["#FF5500"]} />
        }
      >
        {access.isLoading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !isAdmin ? (
          <View style={styles.emptyWrap}>
            <Feather name="shield-off" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Access Restricted</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              This area is for HaulBrokr staff only. You don't have admin access.
            </Text>
          </View>
        ) : credit.isLoading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="check-circle" size={40} color={ACCENT.green} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>Nothing to Review</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              No credit applications have been submitted yet.
            </Text>
          </View>
        ) : (
          items.map((item, idx) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(idx * 60).springify()}>
              <CreditCard item={item} colors={colors} />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function CreditCard({ item, colors }: { item: AdminCreditApplicationItem; colors: any }) {
  const review = useReviewCreditApplication();

  const onDone = (action: "approve" | "reject", note?: string) =>
    review.mutateAsync({ profileId: item.profileId, action, ...(note ? { note } : {}) });

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.cardAvatar, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="home" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>
            {item.profile.companyName}
          </Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
            {item.profile.contactName || "—"}
            {item.profile.email ? ` · ${item.profile.email}` : ""}
          </Text>
        </View>
        <ReviewBadge status={item.status} colors={colors} />
      </View>

      <View style={styles.fieldGrid}>
        <Field label="Wants Invoicing" value={item.wantsInvoicing ? "Yes" : "No"} colors={colors} />
        <Field label="Est. Monthly Spend" value={item.estimatedMonthlySpend != null ? money(item.estimatedMonthlySpend) : null} colors={colors} />
        <Field label="Bank Reference" value={item.bankReference} colors={colors} full />
        <Field label="Trade References" value={item.tradeReferences} colors={colors} full />
      </View>

      <ReviewActions
        approveLabel="Approve Credit"
        approveIcon="check-circle"
        approveDisabled={item.status === "approved"}
        rejectDisabled={item.status === "rejected"}
        reviewNote={item.reviewNote}
        status={item.status}
        isPending={review.isPending}
        colors={colors}
        onSubmit={onDone}
      />
    </View>
  );
}

function Field({ label, value, colors, full }: { label: string; value?: string | number | null; colors: any; full?: boolean }) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <View style={[styles.field, full && { width: "100%", paddingRight: 0 }]}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{display}</Text>
    </View>
  );
}
