import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  Alert,
  FlatList,
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

import { EmptyState } from "@/components/EmptyState";
import { JobCard } from "@/components/JobCard";
import { RefreshingIndicator, isRefreshingPillVisible } from "@/components/RefreshingIndicator";
import { LastUpdated } from "@/components/LastUpdated";
import { useApp } from "@/context/AppContext";
import type { Job, JobStatus, ProjectType } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useLiveJobs, useLiveRequests, useCreateRequest, useMarketplaceMap } from "@/hooks/useLiveApi";
import { liveJobToViewJob, liveRequestToViewJob, type LiveJob, type LiveRequest } from "@/lib/liveJob";
import { marketplaceLoadToJob } from "@/lib/marketplaceMap";

type Filter = "all" | JobStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "accepted", label: "Active" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const MATERIALS = [
  "Dirt / Fill",
  "Concrete Debris",
  "Asphalt Millings",
  "Rock & Gravel",
  "Demolition Debris",
  "Sand",
  "Topsoil",
  "Scrap Metal",
];

// Maps each display material to the API `materialType` enum
// (dirt | gravel | sand | concrete | asphalt | demolition | topsoil | fill | other).
const MATERIAL_TO_API: Record<string, string> = {
  "Dirt / Fill": "dirt",
  "Concrete Debris": "concrete",
  "Asphalt Millings": "asphalt",
  "Rock & Gravel": "gravel",
  "Demolition Debris": "demolition",
  Sand: "sand",
  Topsoil: "topsoil",
  "Scrap Metal": "other",
};

const PROJECT_TYPES: ProjectType[] = ["Transport", "Material & Transport", "Tracking", "Recycling"];

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const isProvider = profile.role === "provider";
  const { data: liveJobsRaw, isLoading, isError, isFetching, refetch, dataUpdatedAt: jobsUpdatedAt } = useLiveJobs();
  const {
    data: liveRequestsRaw,
    isFetching: isFetchingRequests,
    refetch: refetchRequests,
    dataUpdatedAt: requestsUpdatedAt,
  } = useLiveRequests({ mine: true, enabled: !isProvider });
  const {
    data: liveOpenRequestsRaw,
    isFetching: isFetchingOpenRequests,
    refetch: refetchOpenRequests,
    dataUpdatedAt: openRequestsUpdatedAt,
  } = useLiveRequests({ mine: false, enabled: isProvider });
  const createRequest = useCreateRequest();
  const { data: marketplace, refetch: refetchMarketplace } = useMarketplaceMap();

  const jobs = useMemo<Job[]>(() => {
    const fromJobs = Array.isArray(liveJobsRaw)
      ? (liveJobsRaw as LiveJob[]).map(liveJobToViewJob)
      : [];
    if (isProvider) {
      const fromOpenRequests = Array.isArray(liveOpenRequestsRaw)
        ? (liveOpenRequestsRaw as LiveRequest[])
            .filter((r) => r.status === "open" || r.status === "bidding" || r.status === "bid_received")
            .map(liveRequestToViewJob)
        : [];
      const combined = [...fromOpenRequests, ...fromJobs];
      return combined;
    }
    const fromRequests =
      Array.isArray(liveRequestsRaw)
        ? (liveRequestsRaw as LiveRequest[])
            .filter((r) => r.status === "open" || r.status === "bidding" || r.status === "bid_received")
            .map(liveRequestToViewJob)
        : [];
    const combined = [...fromRequests, ...fromJobs];
    return combined;
  }, [liveJobsRaw, liveRequestsRaw, liveOpenRequestsRaw, isProvider]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), refetchRequests(), refetchOpenRequests(), refetchMarketplace()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchRequests, refetchOpenRequests, refetchMarketplace]);

  const filtered = useMemo(() => {
    let result = jobs;
    if (filter !== "all") result = result.filter((j) => j.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (j) =>
          j.material.toLowerCase().includes(q) ||
          j.pickupAddress.toLowerCase().includes(q) ||
          j.deliveryAddress.toLowerCase().includes(q) ||
          j.projectName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [jobs, filter, search]);

  const handlePost = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowForm(true);
  }, []);

  const handleQuickBid = useCallback((job: Job) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/job/${job.id}`);
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Show a subtle "Updating…" pill when a background refetch (e.g. the
  // foreground refetch after reopening the app) is in flight over cached data —
  // not during the initial load or a manual pull-to-refresh.
  const isUpdating = isRefreshingPillVisible({
    isFetching: isFetching || isFetchingRequests || isFetchingOpenRequests,
    isLoading,
    refreshing,
  });

  // Freshness of the load list: the most recent successful refetch across the
  // live queries feeding this screen.
  const lastUpdated = Math.max(jobsUpdatedAt, requestsUpdatedAt, openRequestsUpdatedAt) || undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RefreshingIndicator visible={isUpdating} />
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
            paddingTop: topPad + 16,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text
              style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
            >
              {isProvider ? "Load Board" : "My Requests"}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {filtered.length} {filter === "all" ? "total" : filter.replace("_", " ")} loads
            </Text>
            <LastUpdated timestamp={lastUpdated} style={{ marginTop: 2 }} />
          </View>
          {!isProvider && (
            <Pressable
              onPress={handlePost}
              style={[styles.postBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
              <Text
                style={[styles.postBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}
              >
                Post Load
              </Text>
            </Pressable>
          )}
        </View>

        {/* Search */}
        <View
          style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
            placeholder="Search material, project, location..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Filter chips */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          keyExtractor={(f) => f.key}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setFilter(item.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: filter === item.key ? colors.primary : colors.card,
                  borderColor: filter === item.key ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: filter === item.key ? colors.primaryForeground : colors.foreground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {/* List */}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(j) => j.id}
        scrollEnabled={!!filtered.length}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 100 : 100 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={["#3B82F6"]} />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/job/${item.id}`);
              }}
            >
              <JobCard
                job={item}
                isLive
                showBidButton={isProvider}
                onBid={handleQuickBid}
              />
            </Pressable>
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <EmptyState
              icon="loader"
              title="Loading jobs…"
              description="Fetching your latest jobs from the platform."
            />
          ) : isError ? (
            <EmptyState
              icon="alert-circle"
              title="Couldn't load jobs"
              description="Something went wrong. Pull down to try again."
            />
          ) : (
            <EmptyState
              icon="briefcase"
              title={
                search ? "No results found" : isProvider ? "No active loads" : "No jobs yet"
              }
              description={
                search
                  ? "Try a different search term or clear filters"
                  : isProvider
                  ? "Open loads appear here. Tap a load to place your bid."
                  : "Jobs appear here once you hire a provider. Post a load to get started."
              }
              actionLabel={!isProvider && !search ? "Post a Load" : undefined}
              onAction={!isProvider && !search ? handlePost : undefined}
            />
          )
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Post Job Form */}
      {showForm && (
        <PostJobModal
          colors={colors}
          insets={insets}
          submitting={createRequest.isPending}
          onClose={() => setShowForm(false)}
          onSubmit={async (data) => {
            try {
              await createRequest.mutateAsync({
                materialType: MATERIAL_TO_API[data.material] ?? "other",
                quantityTons: data.quantity,
                pickupAddress: data.pickupAddress,
                deliveryAddress: data.deliveryAddress,
                scheduledDate: data.scheduledDate,
                trucksNeeded: data.trucksNeeded,
                budgetPerHour: data.budgetPerHour,
                notes: data.notes || undefined,
              });
              await refetchRequests();
              setShowForm(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Posted!", "Your load request is live and receiving bids.");
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Couldn't post load", err?.message ?? "Please try again.");
            }
          }}
        />
      )}
    </View>
  );
}

function PostJobModal({
  colors,
  insets,
  submitting,
  onClose,
  onSubmit,
}: {
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Job, "id" | "postedAt" | "bidsCount" | "bids" | "postedBy">) => void;
}) {
  const [matIdx, setMatIdx] = useState(0);
  const [typeIdx, setTypeIdx] = useState(0);
  const [quantity, setQuantity] = useState("100");
  const [trucks, setTrucks] = useState("1");
  const [pickup, setPickup] = useState("");
  const [delivery, setDelivery] = useState("");
  const [budget, setBudget] = useState("125");
  const [preferred, setPreferred] = useState("115");
  const [projectName, setProjectName] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [providerSupplies, setProviderSupplies] = useState(true);

  const handleSubmit = () => {
    if (!pickup.trim() || !delivery.trim()) {
      Alert.alert("Missing Info", "Please fill in pickup and delivery addresses.");
      return;
    }
    onSubmit({
      projectName: projectName || `${MATERIALS[matIdx]} Haul`,
      projectType: PROJECT_TYPES[typeIdx],
      material: MATERIALS[matIdx],
      quantity: parseInt(quantity) || 100,
      quantityUnit: "tons",
      pickupAddress: pickup,
      deliveryAddress: delivery,
      budgetPerHour: parseInt(budget) || 125,
      preferredRate: parseInt(preferred) || 115,
      status: "open",
      trucksNeeded: parseInt(trucks) || 1,
      scheduledDate: date,
      endDate: endDate,
      providerSupplies,
      distanceToStart: Math.round(Math.random() * 40 + 5),
      distanceToEnd: Math.round(Math.random() * 80 + 20),
      notes: "",
    });
  };

  return (
    <View style={[styles.modalOverlay, { backgroundColor: colors.background + "ee" }]}>
      <View
        style={[
          styles.modal,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Post a Load Request
          </Text>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>

        {/* Project name */}
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Project Name
        </Text>
        <TextInput
          style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, fontFamily: "Inter_400Regular" }]}
          placeholder="e.g. Waterfront Project"
          placeholderTextColor={colors.mutedForeground}
          value={projectName}
          onChangeText={setProjectName}
        />

        {/* Project type */}
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Project Type
        </Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={PROJECT_TYPES}
          keyExtractor={(t) => t}
          contentContainerStyle={styles.materialChips}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => setTypeIdx(index)}
              style={[
                styles.materialChip,
                {
                  backgroundColor: typeIdx === index ? colors.primary : colors.background,
                  borderColor: typeIdx === index ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: typeIdx === index ? colors.primaryForeground : colors.foreground }}>
                {item}
              </Text>
            </Pressable>
          )}
        />

        {/* Material picker */}
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Material Type
        </Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={MATERIALS}
          keyExtractor={(m) => m}
          contentContainerStyle={styles.materialChips}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => setMatIdx(index)}
              style={[
                styles.materialChip,
                {
                  backgroundColor: matIdx === index ? colors.primary : colors.background,
                  borderColor: matIdx === index ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: matIdx === index ? colors.primaryForeground : colors.foreground }}>
                {item}
              </Text>
            </Pressable>
          )}
        />

        <View style={styles.row}>
          <Field label="Quantity (tons)" value={quantity} onChangeText={setQuantity} keyboardType="numeric" colors={colors} style={{ flex: 1 }} />
          <Field label="Trucks" value={trucks} onChangeText={setTrucks} keyboardType="numeric" colors={colors} style={{ flex: 1 }} />
        </View>
        <Field label="Pickup Address" value={pickup} onChangeText={setPickup} colors={colors} placeholder="123 Main St, Dallas, TX" />
        <Field label="Delivery Address" value={delivery} onChangeText={setDelivery} colors={colors} placeholder="Landfill Rd, Dallas, TX" />
        <View style={styles.row}>
          <Field label="Preferred Rate ($/hr)" value={preferred} onChangeText={setPreferred} keyboardType="numeric" colors={colors} style={{ flex: 1 }} />
          <Field label="Budget ($/hr)" value={budget} onChangeText={setBudget} keyboardType="numeric" colors={colors} style={{ flex: 1 }} />
        </View>
        <View style={styles.row}>
          <Field label="Start Date" value={date} onChangeText={setDate} colors={colors} style={{ flex: 1 }} />
          <Field label="End Date" value={endDate} onChangeText={setEndDate} colors={colors} style={{ flex: 1 }} />
        </View>

        <Pressable
          onPress={() => setProviderSupplies((v) => !v)}
          style={[styles.checkboxRow, { borderColor: colors.border }]}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: providerSupplies ? colors.primary : colors.border,
                backgroundColor: providerSupplies ? colors.primary : "transparent",
              },
            ]}
          >
            {providerSupplies && <Feather name="check" size={12} color={colors.primaryForeground} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.checkboxLabel, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
              Provider must supply trucks & equipment
            </Text>
            <Text style={[styles.checkboxSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Provider brings all trucks and equipment to the job
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
        >
          <Text style={[styles.submitText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
            {submitting ? "Posting…" : "Post Load Request"}
          </Text>
        </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  colors,
  placeholder,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "numeric" | "default";
  colors: ReturnType<typeof useColors>;
  placeholder?: string;
  style?: object;
}) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.fieldInput,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
            fontFamily: "Inter_400Regular",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 14,
  },
  title: { fontSize: 26, fontWeight: "700" as const },
  subtitle: { fontSize: 13, marginTop: 2 },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  postBtnText: { fontSize: 14, fontWeight: "600" as const },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    borderRadius: 8,
  },
  searchInput: { flex: 1, fontSize: 14, height: "100%" },
  chips: { gap: 8, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 20,
  },
  chipText: { fontSize: 13, fontWeight: "500" as const },
  list: { padding: 16 },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  modal: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: "700" as const },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  fieldInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderRadius: 8,
  },
  materialChips: { gap: 8, marginBottom: 14 },
  materialChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 6,
  },
  row: { flexDirection: "row", gap: 12 },
  submitBtn: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    borderRadius: 10,
  },
  submitText: { fontSize: 16, fontWeight: "700" as const },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    borderRadius: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
    borderRadius: 4,
  },
  checkboxLabel: { fontSize: 14, fontWeight: "500" as const, marginBottom: 3 },
  checkboxSub: { fontSize: 12, lineHeight: 16 },
});
