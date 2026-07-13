import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";

import { RefreshingIndicator, isRefreshingPillVisible } from "@/components/RefreshingIndicator";
import { useColors } from "@/hooks/useColors";
import { useProjects, useCreateProject } from "@/hooks/useLiveApi";
import { useApp } from "@/context/AppContext";

const STATUS_COLOR: Record<string, string> = {
  active: "#16a34a",
  completed: "#6b7280",
  cancelled: "#ef4444",
  paused: "#f59e0b",
};

function pct(spent: number, total: number | null) {
  if (!total || total === 0) return 0;
  return Math.min(100, Math.round((spent / total) * 100));
}

export default function ProjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const isProvider = profile.role === "provider";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: projects, isLoading, isError, refetch, isFetching } = useProjects();
  const createProject = useCreateProject();

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Show a subtle "Updating…" pill when a background refetch (e.g. the
  // foreground refetch after reopening the app) is in flight over cached data —
  // not during the initial load or a manual pull-to-refresh.
  const isUpdating = isRefreshingPillVisible({ isFetching, isLoading, refreshing });

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const resetForm = () => {
    setName(""); setAddress(""); setDescription("");
    setBudget(""); setStartDate(""); setEndDate("");
  };

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert("Name required", "Please enter a project name."); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await createProject.mutateAsync({
        name: name.trim(),
        siteAddress: address.trim() || undefined,
        description: description.trim() || undefined,
        totalBudget: budget ? parseFloat(budget) : undefined,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
      });
      setShowModal(false);
      resetForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not create project.");
    }
  };

  if (isProvider) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="briefcase" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Provider view</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          Projects are managed by customers who hire you.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <RefreshingIndicator visible={isUpdating} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: 100 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.heading, { color: colors.foreground }]}>Projects</Text>
            <Text style={[styles.headingSub, { color: colors.mutedForeground }]}>
              Track budget & progress across job sites
            </Text>
          </View>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowModal(true); }}
            style={[styles.newBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={[styles.newBtnText, { color: colors.primaryForeground }]}>New</Text>
          </Pressable>
        </View>

        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator color="#3B82F6" size="large" />
          </View>
        )}

        {isError && (
          <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: "#ef444440" }]}>
            <Feather name="alert-circle" size={18} color="#ef4444" />
            <Text style={[styles.errorText, { color: "#ef4444" }]}>Could not load projects. Pull to refresh.</Text>
          </View>
        )}

        {!isLoading && !isError && (!projects || projects.length === 0) && (
          <Animated.View entering={FadeInDown.springify()} style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="folder" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No projects yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Create your first project to track budget and jobs across a site.
            </Text>
            <Pressable onPress={() => setShowModal(true)} style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>+ Create Project</Text>
            </Pressable>
          </Animated.View>
        )}

        {(projects ?? []).map((project: any, i: number) => {
          const progress = pct(project.spentAmount ?? 0, project.totalBudget);
          const statusColor = STATUS_COLOR[project.status] ?? "#6b7280";
          return (
            <Animated.View key={project.id} entering={FadeInDown.delay(i * 40).springify()}>
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: colors.foreground }]}>{project.name}</Text>
                    {project.siteAddress ? (
                      <View style={styles.addrRow}>
                        <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.addrText, { color: colors.mutedForeground }]}>{project.siteAddress}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{project.status?.toUpperCase()}</Text>
                  </View>
                </View>

                {project.totalBudget ? (
                  <View style={styles.budgetSection}>
                    <View style={styles.budgetRow}>
                      <Text style={[styles.budgetLabel, { color: colors.mutedForeground }]}>Budget used</Text>
                      <Text style={[styles.budgetPct, { color: colors.primary }]}>{progress}%</Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: colors.border }]}>
                      <View
                        style={[styles.fill, {
                          width: `${progress}%` as any,
                          backgroundColor: progress > 90 ? "#ef4444" : progress > 70 ? "#f59e0b" : "#16a34a",
                        }]}
                      />
                    </View>
                    <View style={styles.budgetAmounts}>
                      <Text style={[styles.budgetAmt, { color: colors.foreground }]}>
                        ${(project.spentAmount ?? 0).toLocaleString()} spent
                      </Text>
                      <Text style={[styles.budgetTotal, { color: colors.mutedForeground }]}>
                        of ${project.totalBudget.toLocaleString()} total
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.noBudget, { color: colors.mutedForeground }]}>No budget set</Text>
                )}

                {project.description ? (
                  <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>{project.description}</Text>
                ) : null}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView
            style={[styles.modal, { backgroundColor: colors.background }]}
            contentContainerStyle={{ paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Project</Text>
              <Pressable onPress={() => { setShowModal(false); resetForm(); }}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {[
              { label: "Project Name *", value: name, set: setName, placeholder: "e.g. Downtown Demolition", icon: "folder" as const },
              { label: "Site Address", value: address, set: setAddress, placeholder: "123 Main St, Dallas TX", icon: "map-pin" as const },
              { label: "Total Budget ($)", value: budget, set: setBudget, placeholder: "e.g. 50000", icon: "dollar-sign" as const, numeric: true },
              { label: "Start Date", value: startDate, set: setStartDate, placeholder: "2026-06-01", icon: "calendar" as const },
              { label: "End Date", value: endDate, set: setEndDate, placeholder: "2026-08-31", icon: "calendar" as const },
            ].map((f) => (
              <View key={f.label} style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
                <View style={[styles.fieldRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name={f.icon} size={14} color={colors.mutedForeground} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.fieldInput, { color: colors.foreground }]}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    value={f.value}
                    onChangeText={f.set}
                    keyboardType={f.numeric ? "numeric" : "default"}
                  />
                </View>
              </View>
            ))}

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Optional project details..."
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <Pressable
              onPress={handleCreate}
              style={[styles.createBtn, { backgroundColor: colors.primary }, createProject.isPending && { opacity: 0.6 }]}
              disabled={createProject.isPending}
            >
              {createProject.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Create Project</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 },
  heading: { fontSize: 22, fontFamily: "Inter_700Bold" },
  headingSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  newBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderWidth: 1, borderRadius: 12 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  emptyCard: { padding: 32, borderWidth: 1, borderRadius: 16, alignItems: "center", gap: 10, marginTop: 24 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  addrRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  addrText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  budgetSection: { gap: 6 },
  budgetRow: { flexDirection: "row", justifyContent: "space-between" },
  budgetLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  budgetPct: { fontSize: 12, fontFamily: "Inter_700Bold" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  budgetAmounts: { flexDirection: "row", gap: 6 },
  budgetAmt: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  budgetTotal: { fontSize: 13, fontFamily: "Inter_400Regular" },
  noBudget: { fontSize: 12, fontFamily: "Inter_400Regular" },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  modal: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  fieldRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  fieldInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80 },
  createBtn: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 8 },
  createBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
