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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ACCENT } from "@/constants/theme";
import { useColors } from "@/hooks/useColors";
import {
  useLiveJobs,
  useTickets,
  useCreateTicket,
  useUploadFile,
  useDriverWorkflow,
  useJobEvidence,
  type DriverWorkflowAction,
} from "@/hooks/useLiveApi";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const WORKFLOW_FLOW: {
  state: string;
  action: DriverWorkflowAction;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  photoRole?: string;
}[] = [
  { state: "accepted", action: "accept_job", label: "Accept Job", icon: "check" },
  { state: "en_route_pickup", action: "navigate_to_pickup", label: "Navigate to Pickup", icon: "navigation" },
  { state: "checked_in", action: "check_in", label: "Check In", icon: "map-pin" },
  { state: "loading", action: "start_loading", label: "Start Loading", icon: "download" },
  { state: "loading_photos_uploaded", action: "upload_loading_photos", label: "Upload Loading Photos", icon: "camera", photoRole: "loading_photo" },
  { state: "scale_ticket_uploaded", action: "upload_scale_ticket", label: "Upload Scale Ticket", icon: "file-text", photoRole: "scale_ticket" },
  { state: "left_pickup", action: "leave_pickup", label: "Leave Pickup", icon: "arrow-right" },
  { state: "en_route_delivery", action: "navigate_to_delivery", label: "Navigate to Delivery", icon: "navigation" },
  { state: "arrived_delivery", action: "arrive_delivery", label: "Arrive at Delivery", icon: "map-pin" },
  { state: "delivery_photos_uploaded", action: "upload_delivery_photos", label: "Upload Delivery Photos", icon: "camera", photoRole: "delivery_photo" },
  { state: "signed_ticket_uploaded", action: "upload_signed_ticket", label: "Upload Signed Ticket", icon: "edit-3", photoRole: "signed_ticket" },
  { state: "checked_out", action: "check_out", label: "Check Out", icon: "log-out" },
  { state: "completed", action: "complete_job", label: "Complete Job", icon: "check-circle" },
];
type WorkflowStep = (typeof WORKFLOW_FLOW)[number];

export default function DriverJobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const jobsQuery = useLiveJobs();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 4;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 24;

  const activeJobs: any[] = useMemo(() => {
    const all = (jobsQuery.data as any[]) ?? [];
    return all.filter((j) => j.status === "active" || j.status === "accepted" || j.status === "in_progress");
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
        contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>My Loads</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Check in, report status, and upload proof for jobs you're hauling.
        </Text>

        {jobsQuery.isLoading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : activeJobs.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="truck" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No assigned loads</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              When your dispatcher assigns you to a job, it will appear here ready to start.
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
  const ticketsQuery = useTickets(expanded ? job.id : null);
  const evidenceQuery = useJobEvidence(expanded ? job.id : null);
  const createTicket = useCreateTicket();
  const upload = useUploadFile();
  const workflow = useDriverWorkflow();
  const [busyProof, setBusyProof] = useState(false);

  const tickets: any[] = (ticketsQuery.data as any[]) ?? [];
  const evidence: any[] = (evidenceQuery.data as any[]) ?? [];

  const myTicket = tickets[0];
  const currentState = myTicket?.workflowState ?? null;
  const currentIdx = WORKFLOW_FLOW.findIndex((step) => step.state === currentState);
  const nextStep = !myTicket || currentState === "declined" ? null : WORKFLOW_FLOW[currentIdx + 1] ?? WORKFLOW_FLOW[0];

  const uploadWorkflowFile = async (step: WorkflowStep) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const result = perm.granted
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
      : await (async () => {
          const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!lib.granted) {
            Alert.alert("Photos blocked", "Enable camera or photo access to upload this workflow item.");
            return null;
          }
          return ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
        })();
    if (!result || result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const filename = asset.fileName ?? `${step.photoRole}-${job.id}.jpg`;
    const mimeType = asset.mimeType ?? "image/jpeg";
    const { objectPath } = await upload.mutateAsync({ uri: asset.uri, name: filename, mimeType });
    return {
      role: step.photoRole ?? "workflow_photo",
      url: `${API_BASE}/storage${objectPath}`,
      caption: step.label,
    };
  };

  const advance = async () => {
    if (!nextStep) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const file = nextStep.photoRole ? await uploadWorkflowFile(nextStep) : null;
      if (nextStep.photoRole && !file) return;
      await workflow.mutateAsync({
        jobId: job.id,
        ticketId: myTicket?.id,
        action: nextStep.action,
        ...(file ? { files: [file] } : {}),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Couldn't update status", err?.message ?? "Try again.");
    }
  };

  const handleNewLoad = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    createTicket.mutate(
      { jobId: job.id },
      { onError: (err: any) => Alert.alert("Couldn't start load", err?.message ?? "Try again.") },
    );
  };

  const handleProof = async () => {
    setBusyProof(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const result = perm.granted
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
        : await (async () => {
            const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!lib.granted) {
              Alert.alert("Photos blocked", "Enable camera or photo access to upload proof.");
              return null;
            }
            return ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
          })();
      if (!result || result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const filename = asset.fileName ?? `proof-${job.id}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";
      const { objectPath } = await upload.mutateAsync({ uri: asset.uri, name: filename, mimeType });
      await workflow.mutateAsync({
        jobId: job.id,
        ticketId: myTicket?.id,
        action: "upload_delivery_photos",
        files: [{ role: "delivery_photo", url: `${API_BASE}/storage${objectPath}`, caption: "Delivery proof" }],
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
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: colors.primary + "18" }]}>
          <Feather name="truck" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
            {job.materialType ?? "Load"} · Job #{job.id}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {job.deliveryAddress ?? job.pickupAddress ?? job.customerCompany ?? "Assigned haul"}
          </Text>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
      </View>

      {expanded && (
        <View style={[styles.body, { borderTopColor: colors.border }]}>
          {/* Status timeline */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>STATUS</Text>
          <View style={styles.timeline}>
            {WORKFLOW_FLOW.map((step, i) => {
              const done = i <= currentIdx;
              return (
                <View key={step.state} style={styles.timelineRow}>
                  <View
                    style={[
                      styles.timelineDot,
                      { backgroundColor: done ? ACCENT.green : colors.background, borderColor: done ? ACCENT.green : colors.border },
                    ]}
                  >
                    <Feather name={step.icon} size={12} color={done ? "#fff" : colors.mutedForeground} />
                  </View>
                  <Text style={[styles.timelineLabel, { color: done ? colors.foreground : colors.mutedForeground }]}>
                    {step.label}
                  </Text>
                  {i === currentIdx && (
                    <View style={[styles.currentBadge, { backgroundColor: ACCENT.green + "20" }]}>
                      <Text style={[styles.currentBadgeText, { color: ACCENT.green }]}>Current</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {nextStep ? (
            <Pressable
              onPress={advance}
              disabled={workflow.isPending || upload.isPending}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: workflow.isPending || upload.isPending ? 0.6 : 1 }]}
            >
              {workflow.isPending || upload.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name={nextStep.icon} size={15} color={colors.primaryForeground} />
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                    Mark {nextStep.label}
                  </Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={[styles.doneBanner, { backgroundColor: ACCENT.green + "15", borderColor: ACCENT.green + "40" }]}>
              <Feather name="check-circle" size={15} color={ACCENT.green} />
              <Text style={[styles.doneBannerText, { color: ACCENT.green }]}>
                {currentState === "declined" ? "Assignment declined" : myTicket ? "All workflow steps complete" : "No assignment ticket yet"}
              </Text>
            </View>
          )}

          {/* Check-in / tickets */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 18 }]}>CHECK-IN / LOADS</Text>
          {tickets.length === 0 ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>No loads started yet.</Text>
          ) : (
            tickets.map((t) => {
              const checkedIn = !!t.clockInAt;
              const checkedOut = !!t.clockOutAt;
              const workflowLabel = String(t.workflowState ?? t.status ?? "pending").replace(/_/g, " ");
              return (
                <View key={t.id} style={[styles.ticketRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ticketTitle, { color: colors.foreground }]}>
                      Load #{t.loadNumber ?? t.id}
                    </Text>
                    <Text style={[styles.ticketMeta, { color: colors.mutedForeground }]}>
                      {workflowLabel}{checkedOut ? " - checked out" : checkedIn ? " - on site" : ""}
                    </Text>
                  </View>
                  <Feather name={t.workflowState === "completed" ? "check-circle" : "clock"} size={20} color={t.workflowState === "completed" ? ACCENT.green : colors.mutedForeground} />
                </View>
              );
            })
          )}
          <Pressable
            onPress={handleNewLoad}
            disabled={createTicket.isPending}
            style={[styles.outlineBtn, { borderColor: colors.border }]}
          >
            <Feather name="plus" size={15} color={colors.foreground} />
            <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>
              {createTicket.isPending ? "Starting…" : "Start New Load"}
            </Text>
          </Pressable>

          {/* Proof upload */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 18 }]}>PROOF OF DELIVERY</Text>
          {evidence.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {evidence.map((e) =>
                e.photoUrl ? (
                  <Image key={e.id} source={{ uri: e.photoUrl }} style={styles.proofThumb} resizeMode="cover" />
                ) : null,
              )}
            </ScrollView>
          )}
          <Pressable
            onPress={handleProof}
            disabled={busyProof}
            style={[styles.outlineBtn, { borderColor: colors.border, opacity: busyProof ? 0.6 : 1 }]}
          >
            {busyProof ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <>
                <Feather name="camera" size={15} color={colors.foreground} />
                <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>Upload Proof Photo</Text>
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
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 18, lineHeight: 19 },
  centerBox: { paddingVertical: 48, alignItems: "center" },
  emptyCard: { borderWidth: 1, borderRadius: 12, padding: 28, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyBody: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  body: { borderTopWidth: 1, marginTop: 14, paddingTop: 14 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 10 },
  timeline: { gap: 10, marginBottom: 14 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  timelineLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  currentBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10 },
  primaryBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  doneBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  doneBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 10 },
  ticketRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  ticketTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ticketMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  smallBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  smallBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  outlineBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  proofThumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8 },
});
