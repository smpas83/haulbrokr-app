import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ACCENT } from "@/constants/theme";
import { useColors } from "@/hooks/useColors";
import {
  useLiveJobs,
  useJobStatusUpdates,
  useCreateJobStatusUpdate,
  useTickets,
  useCreateTicket,
  useTicketClockIn,
  useTicketClockOut,
  useUploadFile,
  useSubmitEvidence,
  useJobEvidence,
  type JobStatusUpdateStatus,
} from "@/hooks/useLiveApi";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const STATUS_FLOW: {
  key: JobStatusUpdateStatus;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { key: "en_route", label: "En route", icon: "navigation" },
  { key: "arrived", label: "Arrived", icon: "map-pin" },
  { key: "loading", label: "Loading", icon: "download" },
  { key: "loaded", label: "Loaded", icon: "package" },
  { key: "dumping", label: "Dumping", icon: "upload" },
  { key: "completed", label: "Completed", icon: "check-circle" },
];

export default function DriverJobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const jobsQuery = useLiveJobs();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 4;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  const activeJobs: any[] = useMemo(() => {
    const all = (jobsQuery.data as any[]) ?? [];
    return all.filter(
      (j) => j.status === "active" || j.status === "in_progress",
    );
  }, [jobsQuery.data]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "My Loads",
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
          My Loads
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Check in, report status, and upload proof for jobs you're hauling.
        </Text>

        {jobsQuery.isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : activeJobs.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="truck" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No assigned loads
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              When your dispatcher assigns you to a job, it will appear here
              ready to start.
            </Text>
          </View>
        ) : (
          activeJobs.map((job) => (
            <DriverJobCard
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

function DriverJobCard({
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
  const evidenceQuery = useJobEvidence(expanded ? job.id : null);
  const createUpdate = useCreateJobStatusUpdate();
  const createTicket = useCreateTicket();
  const clockIn = useTicketClockIn();
  const clockOut = useTicketClockOut();
  const upload = useUploadFile();
  const submitEvidence = useSubmitEvidence();
  const [busyProof, setBusyProof] = useState(false);
  const [busyLoad, setBusyLoad] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [loadWeight, setLoadWeight] = useState("");

  const updates: any[] = (updatesQuery.data as any[]) ?? [];
  const tickets: any[] = (ticketsQuery.data as any[]) ?? [];
  const evidence: any[] = (evidenceQuery.data as any[]) ?? [];

  const reached = new Set(updates.map((u) => u.status));
  const currentIdx = STATUS_FLOW.reduce(
    (acc, s, i) => (reached.has(s.key) ? i : acc),
    -1,
  );
  const nextStep = STATUS_FLOW[currentIdx + 1];

  const advance = () => {
    if (!nextStep) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createUpdate.mutate(
      { jobId: job.id, status: nextStep.key },
      {
        onSuccess: () =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        onError: (err: any) =>
          Alert.alert("Couldn't update status", err?.message ?? "Try again."),
      },
    );
  };

  const handleNewLoad = () => {
    setLoadWeight("");
    setLoadModalOpen(true);
  };

  const submitNewLoad = async () => {
    const weight = parseFloat(loadWeight);
    if (!Number.isFinite(weight) || weight <= 0) {
      Alert.alert("Invalid weight", "Enter a positive number of tons.");
      return;
    }
    setBusyLoad(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const picker = perm.granted
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
          })
        : await (async () => {
            const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!lib.granted) {
              Alert.alert(
                "Photos blocked",
                "Enable camera or photo access to attach the scale ticket.",
              );
              return null;
            }
            return ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.85,
            });
          })();
      if (!picker || picker.canceled || !picker.assets?.[0]) return;
      const asset = picker.assets[0];
      const filename = asset.fileName ?? `scale-ticket-${job.id}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";
      const { objectPath } = await upload.mutateAsync({
        uri: asset.uri,
        name: filename,
        mimeType,
      });
      await createTicket.mutateAsync({
        jobId: job.id,
        weightTons: weight,
        photoUrl: `${API_BASE}/storage${objectPath}`,
        notes: "Scale ticket",
      });
      setLoadModalOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Couldn't log load", err?.message ?? "Try again.");
    } finally {
      setBusyLoad(false);
    }
  };

  const handleProof = async () => {
    setBusyProof(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const result = perm.granted
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          })
        : await (async () => {
            const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!lib.granted) {
              Alert.alert(
                "Photos blocked",
                "Enable camera or photo access to upload proof.",
              );
              return null;
            }
            return ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
          })();
      if (!result || result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const filename = asset.fileName ?? `proof-${job.id}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";
      const { objectPath } = await upload.mutateAsync({
        uri: asset.uri,
        name: filename,
        mimeType,
      });
      await submitEvidence.mutateAsync({
        jobId: job.id,
        photoUrl: `${API_BASE}/storage${objectPath}`,
        photoCaption: "Delivery proof",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message ?? "Could not attach proof.");
    } finally {
      setBusyProof(false);
    }
  };

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
          <Feather name="truck" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.cardTitle, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {job.materialType ?? "Load"} · Job #{job.id}
          </Text>
          <Text
            style={[styles.cardMeta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {job.deliveryAddress ??
              job.pickupAddress ??
              job.customerCompany ??
              "Assigned haul"}
          </Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.mutedForeground}
        />
      </View>

      {expanded && (
        <View style={[styles.body, { borderTopColor: colors.border }]}>
          {/* Status timeline */}
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground }]}
          >
            STATUS
          </Text>
          <View style={styles.timeline}>
            {STATUS_FLOW.map((step, i) => {
              const done = i <= currentIdx;
              return (
                <View key={step.key} style={styles.timelineRow}>
                  <View
                    style={[
                      styles.timelineDot,
                      {
                        backgroundColor: done
                          ? ACCENT.green
                          : colors.background,
                        borderColor: done ? ACCENT.green : colors.border,
                      },
                    ]}
                  >
                    <Feather
                      name={step.icon}
                      size={12}
                      color={done ? "#fff" : colors.mutedForeground}
                    />
                  </View>
                  <Text
                    style={[
                      styles.timelineLabel,
                      {
                        color: done
                          ? colors.foreground
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {step.label}
                  </Text>
                  {i === currentIdx && (
                    <View
                      style={[
                        styles.currentBadge,
                        { backgroundColor: ACCENT.green + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.currentBadgeText,
                          { color: ACCENT.green },
                        ]}
                      >
                        Current
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {nextStep ? (
            <Pressable
              onPress={advance}
              disabled={createUpdate.isPending}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: createUpdate.isPending ? 0.6 : 1,
                },
              ]}
            >
              {createUpdate.isPending ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primaryForeground}
                />
              ) : (
                <>
                  <Feather
                    name={nextStep.icon}
                    size={15}
                    color={colors.primaryForeground}
                  />
                  <Text
                    style={[
                      styles.primaryBtnText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Mark {nextStep.label}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <View
              style={[
                styles.doneBanner,
                {
                  backgroundColor: ACCENT.green + "15",
                  borderColor: ACCENT.green + "40",
                },
              ]}
            >
              <Feather name="check-circle" size={15} color={ACCENT.green} />
              <Text style={[styles.doneBannerText, { color: ACCENT.green }]}>
                All status steps reported
              </Text>
            </View>
          )}

          {/* Check-in / tickets */}
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.mutedForeground, marginTop: 18 },
            ]}
          >
            CHECK-IN / LOADS
          </Text>
          {tickets.length === 0 ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              No loads started yet.
            </Text>
          ) : (
            tickets.map((t) => {
              const checkedIn = !!t.clockInAt;
              const checkedOut = !!t.clockOutAt;
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
                      {checkedOut
                        ? "Checked out"
                        : checkedIn
                          ? "On site"
                          : "Not checked in"}
                    </Text>
                  </View>
                  {!checkedIn ? (
                    <Pressable
                      onPress={() =>
                        clockIn.mutate(t.id, {
                          onError: (e: any) =>
                            Alert.alert(
                              "Check-in failed",
                              e?.message ?? "Try again.",
                            ),
                        })
                      }
                      style={[
                        styles.smallBtn,
                        { backgroundColor: ACCENT.green },
                      ]}
                    >
                      <Text style={styles.smallBtnText}>Check In</Text>
                    </Pressable>
                  ) : !checkedOut ? (
                    <Pressable
                      onPress={() =>
                        clockOut.mutate(t.id, {
                          onError: (e: any) =>
                            Alert.alert(
                              "Check-out failed",
                              e?.message ?? "Try again.",
                            ),
                        })
                      }
                      style={[
                        styles.smallBtn,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.smallBtnText,
                          { color: colors.primaryForeground },
                        ]}
                      >
                        Check Out
                      </Text>
                    </Pressable>
                  ) : (
                    <Feather
                      name="check-circle"
                      size={20}
                      color={ACCENT.green}
                    />
                  )}
                </View>
              );
            })
          )}
          <Pressable
            onPress={handleNewLoad}
            disabled={busyLoad || createTicket.isPending}
            style={[styles.outlineBtn, { borderColor: colors.border }]}
          >
            <Feather name="plus" size={15} color={colors.foreground} />
            <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>
              {busyLoad || createTicket.isPending
                ? "Saving…"
                : "Log Scale Ticket"}
            </Text>
          </Pressable>

          <Modal
            visible={loadModalOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setLoadModalOpen(false)}
          >
            <View style={styles.modalBackdrop}>
              <View
                style={[
                  styles.modalCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Log scale ticket
                </Text>
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  Enter weight in tons, then attach a photo of the scale ticket.
                </Text>
                <TextInput
                  value={loadWeight}
                  onChangeText={setLoadWeight}
                  keyboardType="decimal-pad"
                  placeholder="Weight (tons)"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.weightInput,
                    {
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                />
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setLoadModalOpen(false)}
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
                    onPress={submitNewLoad}
                    disabled={busyLoad}
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: colors.primary, flex: 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: colors.primaryForeground },
                      ]}
                    >
                      {busyLoad ? "Saving…" : "Add photo & save"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* Proof upload */}
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.mutedForeground, marginTop: 18 },
            ]}
          >
            PROOF OF DELIVERY
          </Text>
          {evidence.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 10 }}
            >
              {evidence.map((e) =>
                e.photoUrl ? (
                  <Image
                    key={e.id}
                    source={{ uri: e.photoUrl }}
                    style={styles.proofThumb}
                    resizeMode="cover"
                  />
                ) : null,
              )}
            </ScrollView>
          )}
          <Pressable
            onPress={handleProof}
            disabled={busyProof}
            style={[
              styles.outlineBtn,
              { borderColor: colors.border, opacity: busyProof ? 0.6 : 1 },
            ]}
          >
            {busyProof ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <>
                <Feather name="camera" size={15} color={colors.foreground} />
                <Text
                  style={[styles.outlineBtnText, { color: colors.foreground }]}
                >
                  Upload Proof Photo
                </Text>
              </>
            )}
          </Pressable>
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
    marginBottom: 18,
    lineHeight: 19,
  },
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
  body: { borderTopWidth: 1, marginTop: 14, paddingTop: 14 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 10,
  },
  timeline: { gap: 10, marginBottom: 14 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  currentBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
  },
  primaryBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  doneBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  doneBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 },
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
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  smallBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
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
  proofThumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  weightInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
