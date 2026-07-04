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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { ACCENT } from "@/constants/theme";
import {
  useAdminAccess,
  useAdminCompliance,
  useReviewCompliance,
  type AdminComplianceItem,
} from "@/hooks/useLiveApi";

export default function AdminComplianceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const access = useAdminAccess();
  const isAdmin = (access.data?.permissions ?? []).includes("compliance");

  const compliance = useAdminCompliance({ enabled: isAdmin });
  const items = Array.isArray(compliance.data) ? compliance.data : [];
  const pending = items.filter(
    (i) => i.status === "pending" || i.status === "not_submitted",
  ).length;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    compliance.refetch().finally(() => setRefreshing(false));
  }, [compliance]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: topPad + 12,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Carrier Review
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {isAdmin ? `${pending} awaiting review` : "Admin only"}
          </Text>
        </View>
        <View
          style={[
            styles.headerIcon,
            { backgroundColor: colors.primary + "18" },
          ]}
        >
          <Feather name="truck" size={18} color={colors.primary} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e9a600"
            colors={["#e9a600"]}
          />
        }
      >
        {access.isLoading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !isAdmin ? (
          <View style={styles.emptyWrap}>
            <Feather
              name="shield-off"
              size={40}
              color={colors.mutedForeground}
              style={{ marginBottom: 12 }}
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Access Restricted
            </Text>
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              This area is for HaulBrokr staff only. You don't have admin
              access.
            </Text>
          </View>
        ) : compliance.isLoading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather
              name="check-circle"
              size={40}
              color={ACCENT.green}
              style={{ marginBottom: 12 }}
            />
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Nothing to Review
            </Text>
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              No carrier compliance records have been submitted yet.
            </Text>
          </View>
        ) : (
          items.map((item, idx) => (
            <Animated.View
              key={item.id}
              entering={FadeInDown.delay(idx * 60).springify()}
            >
              <ComplianceCard item={item} colors={colors} />
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function ComplianceCard({
  item,
  colors,
}: {
  item: AdminComplianceItem;
  colors: any;
}) {
  const review = useReviewCompliance();

  const onDone = (action: "approve" | "reject", note?: string) =>
    review.mutateAsync({
      profileId: item.profileId,
      action,
      ...(note ? { note } : {}),
    });

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardTop}>
        <View
          style={[
            styles.cardAvatar,
            { backgroundColor: colors.primary + "18" },
          ]}
        >
          <Feather name="truck" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={[
              styles.cardTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
            numberOfLines={1}
          >
            {item.profile.companyName}
          </Text>
          <Text
            style={[
              styles.cardSub,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
            numberOfLines={1}
          >
            {item.profile.contactName || "—"}
            {item.profile.city
              ? ` · ${item.profile.city}, ${item.profile.state ?? ""}`
              : ""}
          </Text>
        </View>
        <ReviewBadge status={item.status} colors={colors} />
      </View>

      <View style={styles.fieldGrid}>
        <Field label="DOT #" value={item.dotNumber} colors={colors} />
        <Field label="MC #" value={item.mcNumber} colors={colors} />
        <Field label="CDL #" value={item.cdlNumber} colors={colors} />
        <Field
          label="CDL State / Class"
          value={
            [item.cdlState, item.cdlClass].filter(Boolean).join(" · ") || null
          }
          colors={colors}
        />
        <Field
          label="FMCSA Authority"
          value={item.fmcsaAuthority}
          colors={colors}
        />
        <Field label="Insurance" value={item.insuranceActive} colors={colors} />
        <Field
          label="Operating Status"
          value={item.dotOperatingStatus}
          colors={colors}
        />
        <Field
          label="Not Suspended"
          value={item.notSuspended}
          colors={colors}
        />
      </View>

      <ReviewActions
        approveLabel="Approve Carrier"
        approveIcon="shield"
        approveDisabled={item.status === "verified"}
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

function Field({
  label,
  value,
  colors,
}: {
  label: string;
  value?: string | number | null;
  colors: any;
}) {
  const display =
    value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <View style={styles.field}>
      <Text
        style={[
          styles.fieldLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.fieldValue,
          { color: colors.foreground, fontFamily: "Inter_500Medium" },
        ]}
      >
        {display}
      </Text>
    </View>
  );
}

export function ReviewBadge({
  status,
  colors,
}: {
  status: string;
  colors: any;
}) {
  let bg = colors.muted,
    fg = colors.mutedForeground,
    icon: any = "info",
    label = status.replace(/_/g, " ");
  if (status === "verified" || status === "approved") {
    bg = ACCENT.green + "18";
    fg = ACCENT.green;
    icon = "check-circle";
    label = status === "verified" ? "Verified" : "Approved";
  } else if (status === "pending") {
    bg = "#f59e0b18";
    fg = "#f59e0b";
    icon = "clock";
    label = "Pending";
  } else if (status === "rejected") {
    bg = colors.destructive + "18";
    fg = colors.destructive;
    icon = "x-circle";
    label = "Rejected";
  }
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Feather name={icon} size={11} color={fg} />
      <Text
        style={[
          styles.badgeText,
          { color: fg, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function ReviewActions({
  approveLabel,
  approveIcon,
  approveDisabled,
  rejectDisabled,
  reviewNote,
  status,
  isPending,
  colors,
  onSubmit,
}: {
  approveLabel: string;
  approveIcon: any;
  approveDisabled: boolean;
  rejectDisabled: boolean;
  reviewNote?: string | null;
  status: string;
  isPending: boolean;
  colors: any;
  onSubmit: (action: "approve" | "reject", note?: string) => Promise<unknown>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (action: "approve" | "reject", n?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError(null);
    try {
      await onSubmit(action, n);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRejecting(false);
      setNote("");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(err?.message ?? "Action failed. Try again.");
    }
  };

  return (
    <View style={[styles.actions, { borderTopColor: colors.border }]}>
      {reviewNote && status === "rejected" && (
        <View
          style={[
            styles.noteBox,
            {
              backgroundColor: colors.destructive + "12",
              borderColor: colors.destructive + "33",
            },
          ]}
        >
          <Text
            style={[
              styles.noteText,
              { color: colors.destructive, fontFamily: "Inter_400Regular" },
            ]}
          >
            <Text style={{ fontFamily: "Inter_700Bold" }}>
              Rejection reason:{" "}
            </Text>
            {reviewNote}
          </Text>
        </View>
      )}
      {error && (
        <View
          style={[
            styles.noteBox,
            {
              backgroundColor: colors.destructive + "12",
              borderColor: colors.destructive + "33",
            },
          ]}
        >
          <Text
            style={[
              styles.noteText,
              { color: colors.destructive, fontFamily: "Inter_500Medium" },
            ]}
          >
            {error}
          </Text>
        </View>
      )}
      {rejecting ? (
        <View style={{ gap: 10 }}>
          <TextInput
            autoFocus
            multiline
            placeholder="Reason for rejection (shared with the applicant)…"
            placeholderTextColor={colors.mutedForeground}
            value={note}
            onChangeText={setNote}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
                fontFamily: "Inter_400Regular",
              },
            ]}
          />
          <View style={styles.btnRow}>
            <Pressable
              onPress={() => run("reject", note.trim())}
              disabled={isPending || !note.trim()}
              style={[
                styles.btn,
                styles.rejectBtn,
                {
                  borderColor: colors.destructive,
                  opacity: isPending || !note.trim() ? 0.5 : 1,
                },
              ]}
            >
              {isPending ? (
                <ActivityIndicator color={colors.destructive} size="small" />
              ) : (
                <>
                  <Feather
                    name="alert-circle"
                    size={15}
                    color={colors.destructive}
                  />
                  <Text
                    style={[
                      styles.btnText,
                      {
                        color: colors.destructive,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    Confirm
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setRejecting(false);
                setNote("");
                setError(null);
              }}
              disabled={isPending}
              style={[
                styles.btn,
                styles.ghostBtn,
                { borderColor: colors.border },
              ]}
            >
              <Feather name="x" size={15} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.btnText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.btnRow}>
          <Pressable
            onPress={() => run("approve")}
            disabled={isPending || approveDisabled}
            style={[
              styles.btn,
              styles.approveBtn,
              {
                backgroundColor: colors.primary,
                opacity: isPending || approveDisabled ? 0.5 : 1,
              },
            ]}
          >
            {isPending ? (
              <ActivityIndicator
                color={colors.primaryForeground}
                size="small"
              />
            ) : (
              <>
                <Feather
                  name={approveIcon}
                  size={15}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.btnText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {approveLabel}
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={() => setRejecting(true)}
            disabled={isPending || rejectDisabled}
            style={[
              styles.btn,
              styles.rejectBtn,
              {
                borderColor: colors.destructive,
                opacity: isPending || rejectDisabled ? 0.5 : 1,
              },
            ]}
          >
            <Feather name="alert-circle" size={15} color={colors.destructive} />
            <Text
              style={[
                styles.btnText,
                { color: colors.destructive, fontFamily: "Inter_700Bold" },
              ]}
            >
              Reject
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
  title: { fontSize: 20 },
  subtitle: { fontSize: 13, marginTop: 1 },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  content: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: { fontSize: 15 },
  cardSub: { fontSize: 12 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { fontSize: 11 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  field: { width: "50%", paddingRight: 8, gap: 2 },
  fieldLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { fontSize: 13 },
  actions: { borderTopWidth: 1, paddingTop: 12, gap: 10 },
  noteBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noteText: { fontSize: 12, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 72,
    textAlignVertical: "top",
  },
  btnRow: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    borderRadius: 8,
  },
  approveBtn: {},
  rejectBtn: { borderWidth: 1.5 },
  ghostBtn: { borderWidth: 1 },
  btnText: { fontSize: 13 },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 4,
  },
  emptyTitle: { fontSize: 17, marginBottom: 4 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
