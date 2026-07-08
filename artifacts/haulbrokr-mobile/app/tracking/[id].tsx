import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "@/lib/maps";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { ACCENT } from "@/constants/theme";
import {
  useLiveJobs,
  useLiveRequests,
  useUpdateJob,
  useJobTracking,
} from "@/hooks/useLiveApi";
import {
  liveJobToViewJob,
  liveRequestToViewJob,
  type LiveJob,
  type LiveRequest,
} from "@/lib/liveJob";

export default function TrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { jobs, profile, checkOut, updateJobStatus } = useApp();
  const updateJob = useUpdateJob();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Resolve live data the same way the job detail screen does: `req-N` ids are
  // customer-posted requests, numeric ids are live jobs; fall back to demo data.
  const isRequestId = typeof id === "string" && id.startsWith("req-");
  const requestNumericId = isRequestId ? parseInt(id.slice(4), 10) : null;
  const numericId = !isRequestId && id ? parseInt(id, 10) : null;
  const { data: liveJobsRaw } = useLiveJobs();
  const { data: liveRequestsRaw } = useLiveRequests({
    mine: true,
    enabled: isRequestId,
  });

  const liveJob =
    numericId != null && Array.isArray(liveJobsRaw)
      ? (liveJobsRaw as LiveJob[]).find((j) => j.id === numericId)
      : undefined;
  const liveRequest =
    requestNumericId != null && Array.isArray(liveRequestsRaw)
      ? (liveRequestsRaw as LiveRequest[]).find(
          (r) => r.id === requestNumericId,
        )
      : undefined;
  const isLiveJob = !!liveJob;
  const job = liveJob
    ? liveJobToViewJob(liveJob)
    : liveRequest
      ? liveRequestToViewJob(liveRequest)
      : jobs.find((j) => j.id === id);
  const isProvider = profile.role === "provider";
  const { data: tracking, isLoading: trackingLoading } = useJobTracking(
    numericId,
    isLiveJob,
  );

  const latestPosition = tracking?.latest ?? null;
  const lastUpdatedLabel = useMemo(() => {
    if (!latestPosition?.at) return null;
    try {
      return new Date(latestPosition.at).toLocaleString();
    } catch {
      return null;
    }
  }, [latestPosition?.at]);

  if (!job) {
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
                styles.headerTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              Live Tracking
            </Text>
          </View>
        </View>
        <View style={styles.center}>
          <Feather
            name="alert-circle"
            size={40}
            color={colors.mutedForeground}
            style={{ marginBottom: 12 }}
          />
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Inter_600SemiBold",
              fontSize: 17,
              marginBottom: 6,
            }}
          >
            Tracking Not Found
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              textAlign: "center",
              paddingHorizontal: 32,
              marginBottom: 24,
            }}
          >
            This tracking session may have ended or the link is no longer valid.
          </Text>
          <Pressable
            onPress={() => router.replace("/(tabs)/jobs")}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 10,
            }}
          >
            <Text
              style={{
                color: colors.primaryForeground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 15,
              }}
            >
              Browse All Loads
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const handleCall = () => {
    if (!job.providerPhone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${job.providerPhone.replace(/\D/g, "")}`);
  };

  const handleText = () => {
    if (!job.providerPhone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`sms:${job.providerPhone.replace(/\D/g, "")}`);
  };

  const handleJobComplete = () => {
    Alert.alert(
      "Mark Job Complete?",
      "This will finalize the job and trigger payment release to your wallet.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete Job",
          style: "default",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Live job → persist completion through the API so payment can be
            // charged/released. Demo jobs keep the local AppContext behaviour.
            if (isLiveJob && numericId != null) {
              updateJob.mutate(
                { jobId: numericId, status: "completed" },
                {
                  onSuccess: () => {
                    router.back();
                    Alert.alert(
                      "Job Complete!",
                      "Payment will be released to your wallet within 1–2 business days.",
                    );
                  },
                  onError: (e) =>
                    Alert.alert(
                      "Couldn't complete job",
                      e instanceof Error ? e.message : "Please try again.",
                    ),
                },
              );
              return;
            }
            checkOut(job.id);
            updateJobStatus(job.id, "completed");
            router.back();
            Alert.alert(
              "Job Complete!",
              "Payment will be released to your wallet within 1–2 business days.",
            );
          },
        },
      ],
    );
  };

  // Interpolate truck X position across the route line — removed simulated movement

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
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
              styles.headerTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
            numberOfLines={1}
          >
            Live Tracking
          </Text>
          <Text
            style={[
              styles.headerSub,
              { color: ACCENT.green, fontFamily: "Inter_500Medium" },
            ]}
          >
            ●{" "}
            {job.status === "in_progress"
              ? "In Progress"
              : job.status.replace(/_/g, " ")}
          </Text>
        </View>
        {lastUpdatedLabel && (
          <View
            style={[
              styles.etaBadge,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text
              style={[
                styles.etaText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                },
              ]}
            >
              {lastUpdatedLabel}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Live vehicle map */}
        <View
          style={[
            styles.mapBox,
            { backgroundColor: "#0a1628", overflow: "hidden" },
          ]}
        >
          {isLiveJob && trackingLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
              <Text
                style={{
                  color: colors.mutedForeground,
                  marginTop: 12,
                  fontFamily: "Inter_500Medium",
                }}
              >
                Loading live vehicle location…
              </Text>
            </View>
          ) : isLiveJob && latestPosition ? (
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: latestPosition.lat,
                longitude: latestPosition.lng,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              showsUserLocation
            >
              <Marker
                coordinate={{
                  latitude: latestPosition.lat,
                  longitude: latestPosition.lng,
                }}
                title="Vehicle"
                description={
                  lastUpdatedLabel
                    ? `Updated ${lastUpdatedLabel}`
                    : "Latest GPS ping"
                }
                pinColor={colors.primary}
              />
            </MapView>
          ) : (
            <View style={[styles.center, { paddingHorizontal: 24 }]}>
              <Feather
                name="map-pin"
                size={36}
                color={colors.mutedForeground}
                style={{ marginBottom: 12 }}
              />
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 16,
                  textAlign: "center",
                  marginBottom: 8,
                }}
              >
                Live vehicle location is currently unavailable.
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                {isLiveJob
                  ? "The driver has not shared a GPS update for this job yet. Check back when the haul is en route."
                  : "Tracking is available only for active jobs on the platform."}
              </Text>
            </View>
          )}
        </View>

        {/* Job route summary */}
        <View
          style={[
            styles.progressCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.progressHeader}>
            <Text
              style={[
                styles.progressLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              ROUTE
            </Text>
          </View>
          <View style={styles.progressAddresses}>
            <Text
              style={[
                styles.progressAddr,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              numberOfLines={1}
            >
              {job.pickupAddress.split(",")[0]}
            </Text>
            <Feather
              name="arrow-right"
              size={14}
              color={colors.mutedForeground}
            />
            <Text
              style={[
                styles.progressAddr,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              numberOfLines={1}
            >
              {job.deliveryAddress.split(",")[0]}
            </Text>
          </View>
        </View>

        {/* Driver info + contact */}
        {job.providerPhone && (
          <View
            style={[
              styles.driverCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              DRIVER / PROVIDER
            </Text>
            <View style={styles.driverRow}>
              <View
                style={[
                  styles.driverAvatar,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.driverAvatarText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {job.providerCompany
                    ?.split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={[
                    styles.driverName,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {job.providerCompany}
                </Text>
                <Text
                  style={[
                    styles.driverPhone,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {job.providerPhone}
                </Text>
                <View style={styles.driverMeta}>
                  <Feather
                    name="truck"
                    size={12}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.driverMetaText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {job.trucksNeeded} truck{job.trucksNeeded !== 1 ? "s" : ""}{" "}
                    on this job
                  </Text>
                </View>
              </View>
              <View style={styles.contactBtns}>
                <Pressable
                  onPress={handleCall}
                  style={[styles.contactBtn, { backgroundColor: ACCENT.green }]}
                >
                  <Feather name="phone" size={16} color="#ffffff" />
                  <Text
                    style={[
                      styles.contactBtnText,
                      { color: "#ffffff", fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Call
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleText}
                  style={[styles.contactBtn, { backgroundColor: ACCENT.blue }]}
                >
                  <Feather name="message-square" size={16} color="#ffffff" />
                  <Text
                    style={[
                      styles.contactBtnText,
                      { color: "#ffffff", fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Text
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Time stamps */}
        <View
          style={[
            styles.timestampCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.sectionLabel,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
          >
            TIME LOG
          </Text>
          <View style={styles.timestampRow}>
            <View style={styles.timestampItem}>
              <Feather name="log-in" size={16} color={ACCENT.green} />
              <View>
                <Text
                  style={[
                    styles.timestampLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Check-In
                </Text>
                <Text
                  style={[
                    styles.timestampValue,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {job.checkInTime ?? "—"}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.timestampDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <View style={styles.timestampItem}>
              <Feather
                name="log-out"
                size={16}
                color={job.checkOutTime ? ACCENT.green : colors.mutedForeground}
              />
              <View>
                <Text
                  style={[
                    styles.timestampLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Check-Out
                </Text>
                <Text
                  style={[
                    styles.timestampValue,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {job.checkOutTime ?? "Ongoing"}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.timestampDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <View style={styles.timestampItem}>
              <Feather name="truck" size={16} color={colors.primary} />
              <View>
                <Text
                  style={[
                    styles.timestampLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Trucks
                </Text>
                <Text
                  style={[
                    styles.timestampValue,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {job.trucksNeeded}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Job summary */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.sectionLabel,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_600SemiBold",
              },
            ]}
          >
            JOB SUMMARY
          </Text>
          <View style={styles.summaryRow}>
            <SummaryItem
              label="Material"
              value={job.material}
              colors={colors}
            />
            {job.quantity > 0 ? (
              <SummaryItem
                label="Quantity"
                value={`${job.quantity.toLocaleString()} ${job.quantityUnit}`}
                colors={colors}
              />
            ) : (
              <SummaryItem
                label="Trucks"
                value={`${job.trucksNeeded} truck${job.trucksNeeded !== 1 ? "s" : ""}`}
                colors={colors}
              />
            )}
            <SummaryItem
              label="Rate"
              value={`$${job.budgetPerHour}/hr`}
              colors={colors}
              highlight
            />
          </View>
        </View>
      </ScrollView>

      {/* Bottom action — providers can mark the job complete on both demo and
          live jobs (live completion is wired through the API). Customer
          call/text actions rely on demo provider phone numbers, so they stay
          demo-only and are hidden for live jobs. */}
      {(isProvider || !isLiveJob) && (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {isProvider ? (
            <Pressable
              onPress={handleJobComplete}
              disabled={updateJob.isPending}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: ACCENT.green,
                  opacity: updateJob.isPending ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="check-circle" size={18} color="#ffffff" />
              <Text
                style={[
                  styles.actionBtnText,
                  { color: "#ffffff", fontFamily: "Inter_700Bold" },
                ]}
              >
                {updateJob.isPending ? "Completing…" : "Mark Job Complete"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.customerActions}>
              <Pressable
                onPress={handleCall}
                style={[
                  styles.actionBtn,
                  { backgroundColor: ACCENT.green, flex: 1 },
                ]}
              >
                <Feather name="phone" size={18} color="#ffffff" />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: "#ffffff", fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Call Driver
                </Text>
              </Pressable>
              <Pressable
                onPress={handleText}
                style={[
                  styles.actionBtn,
                  { backgroundColor: ACCENT.blue, flex: 1 },
                ]}
              >
                <Feather name="message-square" size={18} color="#ffffff" />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: "#ffffff", fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Text Driver
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function SummaryItem({
  label,
  value,
  colors,
  highlight,
}: {
  label: string;
  value: string;
  colors: any;
  highlight?: boolean;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
      <Text
        style={{
          fontSize: 10,
          color: colors.mutedForeground,
          fontFamily: "Inter_400Regular",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: highlight ? colors.primary : colors.foreground,
          fontFamily: "Inter_700Bold",
          textAlign: "center",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  headerTitle: { fontSize: 16 },
  headerSub: { fontSize: 12, marginTop: 2 },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  etaText: { fontSize: 13 },
  content: { paddingHorizontal: 16, gap: 14, paddingTop: 16 },
  mapBox: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  roadH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#1e3a5420",
  },
  roadV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#1e3a5420",
  },
  routeLine: {
    position: "absolute",
    top: "50%",
    left: "5%",
    right: "5%",
    height: 3,
    justifyContent: "center",
  },
  routeDash: { height: 2, borderRadius: 1 },
  mapMarker: { position: "absolute", top: "40%", alignItems: "center", gap: 4 },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  markerLabel: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  markerText: { fontSize: 10 },
  truck: { position: "absolute", top: "38%", alignItems: "center" },
  truckEmoji: { fontSize: 24 },
  areaLabel: {
    position: "absolute",
    bottom: 10,
    left: 10,
    color: "#1e3a5480",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  etaOverlay: {
    position: "absolute",
    bottom: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  etaOverlayPct: { fontSize: 13 },
  etaOverlayEta: { fontSize: 11 },
  progressCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  progressPct: { fontSize: 16 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  progressAddresses: { flexDirection: "row", justifyContent: "space-between" },
  progressAddr: { fontSize: 11, flex: 1 },
  driverCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  driverAvatarText: { fontSize: 14 },
  driverName: { fontSize: 15 },
  driverPhone: { fontSize: 13 },
  driverMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  driverMetaText: { fontSize: 12 },
  contactBtns: { gap: 8 },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  contactBtnText: { fontSize: 12 },
  timestampCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  timestampRow: { flexDirection: "row", alignItems: "center" },
  timestampItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timestampLabel: { fontSize: 11 },
  timestampValue: { fontSize: 15 },
  timestampDivider: { width: 1, height: 40, marginHorizontal: 8 },
  summaryCard: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  summaryRow: { flexDirection: "row", gap: 8 },
  actionBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  customerActions: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionBtnText: { fontSize: 16 },
});
