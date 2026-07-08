import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ACCENT } from "@/constants/theme";
import { useColors } from "@/hooks/useColors";
import {
  useLiveJobs,
  useJobStatusUpdates,
  useTickets,
  useApproveCompletion,
  useFlagCompletion,
} from "@/hooks/useLiveApi";

const STATUS_LABEL: Record<string, string> = {
  en_route: "En route",
  arrived: "Arrived",
  loading: "Loading",
  loaded: "Loaded",
  dumping: "Dumping",
  completed: "Completed",
};

export default function ForemanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const jobsQuery = useLiveJobs();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 4;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  const siteJobs: any[] = useMemo(() => {
    const all = (jobsQuery.data as any[]) ?? [];
    return all.filter((j) => j.status !== "cancelled");
  }, [jobsQuery.data]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Site Jobs",
          headerStyle: { backgroundColor: "#1e2235" },
          headerTintColor: "#f0f6ff",
        }}
      />
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Site Jobs
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Track drivers on site, verify tickets, and approve or flag completed
          work.
        </Text>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/ticket/scan" as any);
          }}
          style={[styles.scanBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="maximize" size={16} color={colors.primaryForeground} />
          <Text
            style={[styles.scanBtnText, { color: colors.primaryForeground }]}
          >
            Scan Driver Ticket
          </Text>
        </Pressable>

        {jobsQuery.isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : siteJobs.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather
              name="clipboard"
              size={32}
              color={colors.mutedForeground}
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No active site jobs
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Jobs hauling to your sites will appear here so you can supervise
              drivers and sign off on the work.
            </Text>
          </View>
        ) : (
          siteJobs.map((job) => (
            <ForemanJobCard
              key={job.id}
              job={job}
              colors={colors}
              expanded={selectedId === job.id}
              onToggle={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedId(selectedId === job.id ? null : job.id);
              }}
            />
          ))
        )}
      </ScrollView>
    </>
  );
}

function ForemanJobCard({
  job,
  colors,
  expanded,
  onToggle,
}: {
  job: any;
  colors: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  const updatesQuery = useJobStatusUpdates(expanded ? job.id : null);
  const ticketsQuery = useTickets(expanded ? job.id : null);
  const approve = useApproveCompletion();
  const flag = useFlagCompletion();
  const [flagOpen, setFlagOpen] = useState(false);
  const [reason, setReason] = useState("");

  const updates: any[] = (updatesQuery.data as any[]) ?? [];
  const tickets: any[] = (ticketsQuery.data as any[]) ?? [];
  const latest = updates[updates.length - 1];
  const approval: string = job.completionApproval ?? "pending";

  const handleApprove = () => {
    Alert.alert(
      "Approve completion",
      "Confirm this job was completed satisfactorily?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () =>
            approve.mutate(job.id, {
              onSuccess: () =>
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                ),
              onError: (e: any) =>
                Alert.alert("Couldn't approve", e?.message ?? "Try again."),
            }),
        },
      ],
    );
  };

  const handleFlag = () => {
    if (!reason.trim()) {
      Alert.alert(
        "Reason required",
        "Describe the issue before flagging this job.",
      );
      return;
    }
    flag.mutate(
      { jobId: job.id, reason: reason.trim() },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setFlagOpen(false);
          setReason("");
        },
        onError: (e: any) =>
          Alert.alert("Couldn't flag", e?.message ?? "Try again."),
      },
    );
  };

  const approvalColor =
    approval === "approved"
      ? ACCENT.green
      : approval === "flagged"
        ? ACCENT.red
        : colors.mutedForeground;
  const approvalLabel =
    approval === "approved"
      ? "Approved"
      : approval === "flagged"
        ? "Flagged"
        : "Pending";

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[styles.cardIcon, { backgroundColor: colors.primary + "18" }]}
        >
          <Feather name="map-pin" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.cardTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {job.materialType ?? "Job"} · #{job.id}
          </Text>
          <Text
            style={[styles.cardMeta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {job.providerCompany ?? job.deliveryAddress ?? "Hauler on site"}
          </Text>
        </View>
        <View
          style={[
            styles.approvalBadge,
            { backgroundColor: approvalColor + "20" },
          ]}
        >
          <Text style={[styles.approvalBadgeText, { color: approvalColor }]}>
            {approvalLabel}
          </Text>
        </View>
      </View>

      {expanded && (
        <View style={[styles.body, { borderTopColor: colors.border }]}>
          {/* Current status */}
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground }]}
          >
            DRIVER STATUS
          </Text>
          {latest ? (
            <View
              style={[
                styles.statusRow,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[styles.statusDot, { backgroundColor: ACCENT.green }]}
              />
              <Text style={[styles.statusText, { color: colors.foreground }]}>
                {STATUS_LABEL[latest.status] ?? latest.status}
              </Text>
              <Text
                style={[styles.statusBy, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {latest.actorName ?? "Driver"}
              </Text>
            </View>
          ) : (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              No status reported yet.
            </Text>
          )}

          {/* Drivers / tickets */}
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.mutedForeground, marginTop: 16 },
            ]}
          >
            DRIVERS ON SITE ({tickets.length})
          </Text>
          {tickets.length === 0 ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              No driver check-ins yet.
            </Text>
          ) : (
            tickets.map((t) => {
              const checkedOut = !!t.clockOutAt;
              const checkedIn = !!t.clockInAt;
              const state = checkedOut
                ? "Departed"
                : checkedIn
                  ? "On site"
                  : "Pending";
              const dot = checkedOut
                ? colors.mutedForeground
                : checkedIn
                  ? ACCENT.green
                  : colors.primary;
              return (
                <View
                  key={t.id}
                  style={[
                    styles.ticketRow,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <View style={[styles.statusDot, { backgroundColor: dot }]} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.ticketTitle, { color: colors.foreground }]}
                    >
                      Load #{t.loadNumber ?? t.id}
                    </Text>
                    <Text
                      style={[
                        styles.ticketMeta,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {state}
                      {t.weightTons ? ` · ${t.weightTons} tons` : ""}
                    </Text>
                  </View>
                  {t.verifiedAt ? (
                    <Feather
                      name="check-circle"
                      size={18}
                      color={ACCENT.green}
                    />
                  ) : null}
                </View>
              );
            })
          )}

          {/* Flag reason if already flagged */}
          {approval === "flagged" && job.flagReason ? (
            <View
              style={[
                styles.flagBanner,
                {
                  backgroundColor: ACCENT.red + "12",
                  borderColor: ACCENT.red + "40",
                },
              ]}
            >
              <Feather name="alert-triangle" size={14} color={ACCENT.red} />
              <Text style={[styles.flagBannerText, { color: ACCENT.red }]}>
                {job.flagReason}
              </Text>
            </View>
          ) : null}

          {/* Approve / flag actions */}
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.mutedForeground, marginTop: 16 },
            ]}
          >
            SIGN OFF
          </Text>
          {flagOpen ? (
            <View>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="What's the issue with this job?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[
                  styles.reasonInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
              <View style={styles.btnRow}>
                <Pressable
                  onPress={() => {
                    setFlagOpen(false);
                    setReason("");
                  }}
                  style={[
                    styles.outlineBtn,
                    { borderColor: colors.border, flex: 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.outlineBtnText,
                      { color: colors.foreground },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleFlag}
                  disabled={flag.isPending}
                  style={[
                    styles.dangerBtn,
                    {
                      backgroundColor: ACCENT.red,
                      flex: 1,
                      opacity: flag.isPending ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text style={styles.dangerBtnText}>
                    {flag.isPending ? "Flagging…" : "Submit Flag"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <Pressable
                onPress={handleApprove}
                disabled={approve.isPending}
                style={[
                  styles.approveBtn,
                  {
                    backgroundColor: ACCENT.green,
                    flex: 1,
                    opacity: approve.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Feather name="check" size={15} color="#fff" />
                <Text style={styles.approveBtnText}>
                  {approve.isPending ? "Approving…" : "Approve"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFlagOpen(true)}
                style={[
                  styles.outlineBtn,
                  { borderColor: ACCENT.red + "60", flex: 1 },
                ]}
              >
                <Feather name="flag" size={15} color={ACCENT.red} />
                <Text style={[styles.outlineBtnText, { color: ACCENT.red }]}>
                  Flag Issue
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
    lineHeight: 19,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    marginBottom: 18,
  },
  scanBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  centerBox: { paddingVertical: 48, alignItems: "center" },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  approvalBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  approvalBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  body: { borderTopWidth: 1, marginTop: 14, paddingTop: 14 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusBy: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    textAlign: "right",
  },
  hint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  ticketTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ticketMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  flagBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  flagBannerText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  reasonInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  btnRow: { flexDirection: "row", gap: 10 },
  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
  },
  approveBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  dangerBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 10,
  },
  dangerBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  outlineBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
