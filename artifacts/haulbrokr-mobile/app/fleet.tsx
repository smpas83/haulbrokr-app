import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
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
import { useTrucks, useCreateTruck, type LiveTruck } from "@/hooks/useLiveApi";

const TRUCK_TYPES = [
  "standard",
  "articulated",
  "side_dump",
  "bottom_dump",
  "transfer",
  "dump_truck",
  "super_10",
  "end_dump",
  "belly_dump",
] as const;

type FleetFilter = "all" | "available" | "unavailable";

function truckTitle(t: LiveTruck): string {
  const parts = [t.year, t.make, t.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : t.truckType;
}

export default function FleetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [selectedFilter, setSelectedFilter] = useState<FleetFilter>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [truckType, setTruckType] = useState<string>("dump_truck");
  const [capacityTons, setCapacityTons] = useState("20");
  const [ratePerHour, setRatePerHour] = useState("150");
  const [licensePlate, setLicensePlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");

  const { data: trucksRaw, isLoading } = useTrucks();
  const createTruck = useCreateTruck();
  const trucks = Array.isArray(trucksRaw) ? trucksRaw : [];

  const filtered = trucks.filter((t) =>
    selectedFilter === "all"
      ? true
      : selectedFilter === "available"
        ? t.isAvailable
        : !t.isAvailable,
  );
  const availableCount = trucks.filter((t) => t.isAvailable).length;
  const totalCapacity = trucks.reduce((a, t) => a + (t.capacityTons ?? 0), 0);
  const avgRate =
    trucks.length > 0
      ? Math.round(
          trucks.reduce((a, t) => a + (t.ratePerHour ?? 0), 0) / trucks.length,
        )
      : 0;

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
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Fleet Manager
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {trucks.length} truck{trucks.length !== 1 ? "s" : ""} registered
          </Text>
        </View>
        <Pressable
          onPress={() => setShowAddForm(true)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary cards */}
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <View style={styles.summaryRow}>
            <SummaryCard
              label="Trucks"
              value={trucks.length.toString()}
              color={colors.primary}
              icon="truck"
              colors={colors}
            />
            <SummaryCard
              label="Available"
              value={availableCount.toString()}
              color={ACCENT.green}
              icon="check-circle"
              colors={colors}
            />
            <SummaryCard
              label="Capacity"
              value={`${totalCapacity}t`}
              color={ACCENT.blue}
              icon="box"
              colors={colors}
            />
            <SummaryCard
              label="Avg Rate"
              value={`$${avgRate}`}
              color="#f59e0b"
              icon="dollar-sign"
              colors={colors}
            />
          </View>
        </Animated.View>

        {/* Filter chips */}
        <Animated.View entering={FadeInDown.delay(40).springify()}>
          <View style={styles.chips}>
            {(["all", "available", "unavailable"] as const).map((f) => (
              <Pressable
                key={f}
                onPress={() => setSelectedFilter(f)}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      selectedFilter === f ? colors.primary : colors.card,
                    borderColor:
                      selectedFilter === f ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        selectedFilter === f
                          ? colors.primaryForeground
                          : colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {f === "all"
                    ? "All"
                    : f === "available"
                      ? "Available"
                      : "In Use"}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Loading / empty states */}
        {isLoading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : trucks.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather
              name="truck"
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
              No Trucks Yet
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
              Register your trucks to build out your fleet and start accepting
              hauls.
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather
              name="filter"
              size={32}
              color={colors.mutedForeground}
              style={{ marginBottom: 10 }}
            />
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              No trucks match this filter.
            </Text>
          </View>
        ) : (
          filtered.map((truck, idx) => {
            const sc = truck.isAvailable ? ACCENT.green : "#6b7280";
            return (
              <Animated.View
                key={truck.id}
                entering={FadeInDown.delay(60 + idx * 50).springify()}
              >
                <View
                  style={[
                    styles.truckCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Top row */}
                  <View style={styles.truckTop}>
                    <View
                      style={[
                        styles.truckAvatar,
                        { backgroundColor: sc + "18" },
                      ]}
                    >
                      <Feather name="truck" size={20} color={sc} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[
                          styles.driverName,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        {truckTitle(truck)}
                      </Text>
                      <Text
                        style={[
                          styles.truckType,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {truck.truckType}
                        {truck.licensePlate ? ` • ${truck.licensePlate}` : ""}
                      </Text>
                    </View>
                    {/* Availability badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: sc + "18", borderColor: sc + "40" },
                      ]}
                    >
                      <View
                        style={[styles.statusDot, { backgroundColor: sc }]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: sc, fontFamily: "Inter_600SemiBold" },
                        ]}
                      >
                        {truck.isAvailable ? "Available" : "In Use"}
                      </Text>
                    </View>
                  </View>

                  {/* Notes */}
                  {truck.notes ? (
                    <View
                      style={[
                        styles.notesChip,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Feather
                        name="file-text"
                        size={12}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.notesText,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {truck.notes}
                      </Text>
                    </View>
                  ) : null}

                  {/* Stats */}
                  <View style={styles.truckStats}>
                    <TruckStat
                      label="Capacity"
                      value={`${truck.capacityTons} t`}
                      colors={colors}
                    />
                    <TruckStat
                      label="Rate"
                      value={`$${truck.ratePerHour}/hr`}
                      colors={colors}
                    />
                  </View>
                </View>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showAddForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              Register Truck
            </Text>
            <ScrollView
              style={{ maxHeight: 420 }}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                Truck type
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 12 }}
              >
                {TRUCK_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setTruckType(t)}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor:
                          truckType === t ? colors.primary : colors.background,
                        borderColor:
                          truckType === t ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          truckType === t
                            ? colors.primaryForeground
                            : colors.foreground,
                        fontSize: 12,
                        fontFamily: "Inter_500Medium",
                      }}
                    >
                      {t.replace(/_/g, " ")}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                Capacity (tons)
              </Text>
              <TextInput
                value={capacityTons}
                onChangeText={setCapacityTons}
                keyboardType="decimal-pad"
                style={[
                  styles.fieldInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                Rate per hour ($)
              </Text>
              <TextInput
                value={ratePerHour}
                onChangeText={setRatePerHour}
                keyboardType="decimal-pad"
                style={[
                  styles.fieldInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                License plate
              </Text>
              <TextInput
                value={licensePlate}
                onChangeText={setLicensePlate}
                autoCapitalize="characters"
                style={[
                  styles.fieldInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
              <Text
                style={[
                  styles.fieldLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                Make / model (optional)
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  placeholder="Make"
                  placeholderTextColor={colors.mutedForeground}
                  value={make}
                  onChangeText={setMake}
                  style={[
                    styles.fieldInput,
                    {
                      flex: 1,
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                />
                <TextInput
                  placeholder="Model"
                  placeholderTextColor={colors.mutedForeground}
                  value={model}
                  onChangeText={setModel}
                  style={[
                    styles.fieldInput,
                    {
                      flex: 1,
                      color: colors.foreground,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowAddForm(false)}
                style={[styles.modalBtn, { borderColor: colors.border }]}
              >
                <Text
                  style={{
                    color: colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={createTruck.isPending}
                onPress={async () => {
                  const cap = parseFloat(capacityTons);
                  const rate = parseFloat(ratePerHour);
                  if (!cap || cap <= 0 || !rate || rate <= 0) {
                    Alert.alert(
                      "Invalid input",
                      "Capacity and rate must be positive numbers.",
                    );
                    return;
                  }
                  try {
                    await createTruck.mutateAsync({
                      truckType,
                      capacityTons: cap,
                      ratePerHour: rate,
                      licensePlate: licensePlate.trim() || undefined,
                      make: make.trim() || undefined,
                      model: model.trim() || undefined,
                    });
                    setShowAddForm(false);
                    setLicensePlate("");
                    setMake("");
                    setModel("");
                  } catch (err: any) {
                    Alert.alert(
                      "Could not add truck",
                      err?.message ?? "Please try again.",
                    );
                  }
                }}
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={{
                    color: colors.primaryForeground,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  {createTruck.isPending ? "Saving…" : "Add Truck"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
  colors,
}: {
  label: string;
  value: string;
  color: string;
  icon: string;
  colors: any;
}) {
  return (
    <View
      style={[
        styles.summaryCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Feather name={icon as any} size={16} color={color} />
      <Text
        style={[
          styles.summaryValue,
          { color: colors.foreground, fontFamily: "Inter_700Bold" },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.summaryLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function TruckStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text
        style={[
          styles.statValue,
          { color: colors.foreground, fontFamily: "Inter_700Bold" },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  addBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  content: { padding: 16, gap: 12 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  summaryValue: { fontSize: 20 },
  summaryLabel: { fontSize: 10, textAlign: "center" },
  chips: { flexDirection: "row", gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 12 },
  truckCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  truckTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  truckAvatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  driverName: { fontSize: 15 },
  truckType: { fontSize: 12 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12 },
  notesChip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  notesText: { flex: 1, fontSize: 13 },
  truckStats: { flexDirection: "row", gap: 28 },
  statValue: { fontSize: 18, textAlign: "center" },
  statLabel: { fontSize: 11, textAlign: "center" },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 4,
  },
  emptyTitle: { fontSize: 17, marginBottom: 4 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    margin: 16,
    gap: 12,
  },
  modalTitle: { fontSize: 18, marginBottom: 4 },
  fieldLabel: {
    fontSize: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 16,
    marginRight: 8,
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
