import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
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

import { BinCard } from "@/components/BinCard";
import {
  RefreshingIndicator,
  isRefreshingPillVisible,
} from "@/components/RefreshingIndicator";
import { StatusBadge } from "@/components/StatusBadge";
import { useColors } from "@/hooks/useColors";
import {
  useBins,
  useBinOrders,
  useCreateBinOrder,
  useUpdateBinOrder,
  useCancelBinOrder,
  type BinCatalogItem,
  type LiveBinOrder,
} from "@/hooks/useLiveApi";

const WASTE_TYPES = [
  "General Waste",
  "Construction / Demolition",
  "Yard Waste / Green Waste",
  "Concrete & Masonry",
  "Roofing Materials",
  "Scrap Metal",
  "Mixed / Other",
];

export default function BinsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"temporary" | "permanent">("temporary");
  const [selectedBin, setSelectedBin] = useState<BinCatalogItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<LiveBinOrder | null>(null);

  const binsQuery = useBins();
  const ordersQuery = useBinOrders();
  const createBinOrder = useCreateBinOrder();
  const updateBinOrder = useUpdateBinOrder();
  const cancelBinOrder = useCancelBinOrder();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([binsQuery.refetch(), ordersQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [binsQuery, ordersQuery]);

  // Show a subtle "Updating…" pill for a background refetch — hidden on the
  // initial load and during a manual pull-to-refresh — to match the other live
  // screens.
  const isFetching = binsQuery.isFetching || ordersQuery.isFetching;
  const isLoading = binsQuery.isLoading || ordersQuery.isLoading;
  const isUpdating = isRefreshingPillVisible({
    isFetching,
    isLoading,
    refreshing,
  });

  const catalog = binsQuery.data ?? [];
  const bins = catalog.filter((b) => b.serviceType === tab);
  const binOrders = ordersQuery.data ?? [];
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Deep-link target: tapping a bin notification in the activity feed routes here
  // with ?order=<uuid>. We scroll the matching card into view and briefly
  // highlight it so the customer can see exactly which order changed.
  const { order: deepLinkOrderId } = useLocalSearchParams<{ order?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const orderOffsets = useRef<Record<string, number>>({});
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!deepLinkOrderId || binOrders.length === 0) return;
    const exists = binOrders.some((o) => o.id === deepLinkOrderId);
    if (!exists) return;
    setHighlightedOrderId(deepLinkOrderId);
    const t = setTimeout(() => {
      const y = orderOffsets.current[deepLinkOrderId];
      if (y != null)
        scrollRef.current?.scrollTo({ y: Math.max(y - 24, 0), animated: true });
    }, 350);
    const clear = setTimeout(() => setHighlightedOrderId(null), 2600);
    return () => {
      clearTimeout(t);
      clearTimeout(clear);
    };
  }, [deepLinkOrderId, binOrders.length]);

  const handleOrder = (bin: BinCatalogItem) => {
    setSelectedBin(bin);
    setEditingOrder(null);
    setShowForm(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleEditOrder = (order: LiveBinOrder) => {
    setEditingOrder(order);
    setSelectedBin(null);
    setShowForm(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedBin(null);
    setEditingOrder(null);
  };

  const handleCancelOrder = (order: LiveBinOrder) => {
    Alert.alert(
      "Cancel Order?",
      `Cancel your ${order.binSizeLabel} ${order.binTypeLabel} order at ${order.deliveryAddress}? This can't be undone.`,
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: async () => {
            setCancellingId(order.id);
            try {
              await cancelBinOrder.mutateAsync(order.id);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(
                "Couldn't Cancel",
                err?.message ?? "Please try again.",
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  };

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
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Bin Rental
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          Temporary roll-offs &amp; permanent service
        </Text>

        {/* Segment */}
        <View
          style={[
            styles.segment,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {(["temporary", "permanent"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTab(t);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.segmentTab,
                tab === t && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600" as const,
                  fontFamily: "Inter_600SemiBold",
                  color:
                    tab === t ? colors.primaryForeground : colors.foreground,
                }}
              >
                {t === "temporary" ? "Temporary" : "Permanent"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingBottom: Platform.OS === "web" ? 100 : 100 + insets.bottom,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#e9a600"
            colors={["#e9a600"]}
          />
        }
      >
        {/* Bin grid */}
        {binsQuery.isLoading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : binsQuery.isError ? (
          <View style={styles.stateBox}>
            <Text
              style={[
                styles.stateText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              Couldn&apos;t load bin sizes. Pull down to retry.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {bins.map((bin, idx) => (
              <Animated.View
                key={bin.id}
                style={{ flex: 1, minWidth: "46%" }}
                entering={FadeInDown.delay(idx * 50).springify()}
              >
                <BinCard
                  bin={bin}
                  selected={selectedBin?.id === bin.id}
                  onPress={handleOrder}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {/* Active orders */}
        {binOrders.length > 0 && (
          <View style={styles.ordersSection}>
            <Text
              style={[
                styles.sectionLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              MY ACTIVE ORDERS
            </Text>
            {binOrders.map((order) => (
              <View
                key={order.id}
                onLayout={(e) => {
                  orderOffsets.current[order.id] = e.nativeEvent.layout.y;
                }}
                style={[
                  styles.orderCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  highlightedOrderId === order.id && {
                    borderColor: colors.primary,
                    borderWidth: 2,
                    backgroundColor: colors.primary + "12",
                  },
                ]}
              >
                <View style={styles.orderHeader}>
                  <View>
                    <Text
                      style={[
                        styles.orderTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {order.binSizeLabel} {order.binTypeLabel}
                    </Text>
                    <Text
                      style={[
                        styles.orderMeta,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {order.serviceType === "temporary"
                        ? "Temporary"
                        : "Permanent Service"}{" "}
                      • {order.estimatedCost}
                    </Text>
                  </View>
                  <StatusBadge status={order.displayStatus as any} size="sm" />
                </View>
                <View style={styles.orderRow}>
                  <Feather
                    name="map-pin"
                    size={12}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.orderAddr,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {order.deliveryAddress}
                  </Text>
                </View>
                <View style={styles.orderRow}>
                  <Feather
                    name="trash-2"
                    size={12}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.orderAddr,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {order.wasteType}
                  </Text>
                </View>
                {order.status !== "cancelled" &&
                  order.status !== "picked_up" &&
                  order.status !== "delivered" && (
                    <View style={styles.actionRow}>
                      <Pressable
                        disabled={cancellingId === order.id}
                        onPress={() => handleEditOrder(order)}
                        style={[
                          styles.editBtn,
                          {
                            borderColor: colors.border,
                            opacity: cancellingId === order.id ? 0.6 : 1,
                          },
                        ]}
                      >
                        <Feather
                          name="edit-2"
                          size={14}
                          color={colors.foreground}
                        />
                        <Text
                          style={[
                            styles.editText,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          Reschedule
                        </Text>
                      </Pressable>
                      <Pressable
                        disabled={cancellingId === order.id}
                        onPress={() => handleCancelOrder(order)}
                        style={[
                          styles.cancelBtn,
                          {
                            borderColor: colors.border,
                            opacity: cancellingId === order.id ? 0.6 : 1,
                          },
                        ]}
                      >
                        {cancellingId === order.id ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.destructive}
                          />
                        ) : (
                          <>
                            <Feather
                              name="x-circle"
                              size={14}
                              color={colors.destructive}
                            />
                            <Text
                              style={[
                                styles.cancelText,
                                {
                                  color: colors.destructive,
                                  fontFamily: "Inter_600SemiBold",
                                },
                              ]}
                            >
                              Cancel
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Order Form (create) */}
      {showForm && selectedBin && (
        <OrderForm
          bin={selectedBin}
          serviceType={tab}
          colors={colors}
          insets={insets}
          onClose={closeForm}
          submitting={createBinOrder.isPending}
          onSubmit={async (address, wasteType, date) => {
            try {
              await createBinOrder.mutateAsync({
                serviceType: selectedBin.serviceType,
                binSize: selectedBin.binSize,
                binType: selectedBin.binType,
                deliveryAddress: address,
                wasteType,
                deliveryDate: date,
              });
              closeForm();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert(
                "Bin Ordered!",
                `Your ${selectedBin.size} ${selectedBin.type} has been requested. We'll confirm delivery within 24 hours.`,
              );
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Order Failed", err?.message ?? "Please try again.");
            }
          }}
        />
      )}

      {/* Order Form (reschedule / edit) */}
      {showForm && editingOrder && (
        <OrderForm
          title={`Edit ${editingOrder.binSizeLabel} ${editingOrder.binTypeLabel}`}
          subtitle={editingOrder.estimatedCost}
          submitLabel="Save Changes"
          initialAddress={editingOrder.deliveryAddress}
          initialWasteType={editingOrder.wasteType}
          initialDate={editingOrder.deliveryDate?.split("T")[0]}
          colors={colors}
          insets={insets}
          onClose={closeForm}
          submitting={updateBinOrder.isPending}
          onSubmit={async (address, wasteType, date) => {
            try {
              await updateBinOrder.mutateAsync({
                orderId: editingOrder.id,
                deliveryAddress: address,
                wasteType,
                deliveryDate: date,
              });
              closeForm();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert(
                "Order Updated",
                "Your delivery details have been updated. We'll confirm the new schedule shortly.",
              );
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Update Failed", err?.message ?? "Please try again.");
            }
          }}
        />
      )}
    </View>
  );
}

function OrderForm({
  bin,
  serviceType,
  title,
  subtitle,
  submitLabel,
  initialAddress,
  initialWasteType,
  initialDate,
  colors,
  insets,
  onClose,
  onSubmit,
  submitting,
}: {
  bin?: BinCatalogItem;
  serviceType?: "temporary" | "permanent";
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  initialAddress?: string;
  initialWasteType?: string;
  initialDate?: string;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  onClose: () => void;
  onSubmit: (address: string, wasteType: string, date: string) => void;
  submitting?: boolean;
}) {
  const [address, setAddress] = useState(initialAddress ?? "");
  const [wasteIdx, setWasteIdx] = useState(() => {
    const idx = initialWasteType ? WASTE_TYPES.indexOf(initialWasteType) : -1;
    return idx >= 0 ? idx : 0;
  });
  const [date, setDate] = useState(() => {
    if (initialDate) return initialDate;
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  });

  const headerTitle =
    title ?? (bin ? `Order ${bin.size} ${bin.type}` : "Order");
  const headerSubtitle =
    subtitle ??
    (bin
      ? `${bin.priceRange}/${serviceType === "temporary" ? "week" : "month"} est.`
      : "");

  return (
    <View
      style={[styles.overlay, { backgroundColor: colors.background + "ee" }]}
    >
      <View
        style={[
          styles.form,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={styles.formHeader}>
          <View>
            <Text
              style={[
                styles.formTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {headerTitle}
            </Text>
            {headerSubtitle ? (
              <Text
                style={[
                  styles.formSub,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {headerSubtitle}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={onClose}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Text
          style={[
            styles.label,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          DELIVERY ADDRESS
        </Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="123 Main St, City, State"
          placeholderTextColor={colors.mutedForeground}
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

        <Text
          style={[
            styles.label,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              marginTop: 12,
            },
          ]}
        >
          WASTE TYPE
        </Text>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={WASTE_TYPES}
          keyExtractor={(w) => w}
          contentContainerStyle={{ gap: 8, marginBottom: 14 }}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => setWasteIdx(index)}
              style={[
                styles.chip,
                {
                  backgroundColor:
                    wasteIdx === index ? colors.primary : colors.background,
                  borderColor:
                    wasteIdx === index ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_500Medium",
                  color:
                    wasteIdx === index
                      ? colors.primaryForeground
                      : colors.foreground,
                }}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />

        <Text
          style={[
            styles.label,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          DELIVERY DATE
        </Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.mutedForeground}
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

        <Pressable
          disabled={submitting}
          onPress={() => {
            if (submitting) return;
            if (!address.trim()) {
              Alert.alert(
                "Address Required",
                "Please enter a delivery address.",
              );
              return;
            }
            onSubmit(address, WASTE_TYPES[wasteIdx], date);
          }}
          style={[
            styles.submitBtn,
            { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.submitText,
                {
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                },
              ]}
            >
              {submitLabel ?? "Confirm Order"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "700" as const,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 14,
  },
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    padding: 4,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
  },
  scroll: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  stateBox: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  ordersSection: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  orderCard: {
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  orderMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderAddr: {
    fontSize: 12,
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    paddingVertical: 9,
  },
  editText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    paddingVertical: 9,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  form: {
    borderTopWidth: 1,
    padding: 20,
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  formSub: {
    fontSize: 14,
    marginTop: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  submitBtn: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  submitText: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
});
