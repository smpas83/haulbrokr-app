import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusBadge } from "@/components/StatusBadge";
import { useColors } from "@/hooks/useColors";
import { useBinOrder, useCancelBinOrder } from "@/hooks/useLiveApi";

const PROVIDER_LABEL: Record<string, string> = {
  any: "Best Available",
  waste_management: "Waste Management",
  republic: "Republic Services",
  key_disposal: "Key Disposal",
  clean_earth: "Clean Earth",
  casella: "Casella Waste",
  advanced: "Advanced Disposal",
};

// The persisted lifecycle is a strict forward chain. We derive the timeline from
// the current status: every step up to and including the current one is "done".
const LIFECYCLE: { key: string; label: string; desc: string }[] = [
  { key: "pending", label: "Order Placed", desc: "Your request was submitted and is awaiting confirmation." },
  { key: "confirmed", label: "Confirmed", desc: "A provider confirmed your order and is scheduling delivery." },
  { key: "delivered", label: "Delivered", desc: "The bin was dropped off and is ready to use." },
  { key: "picked_up", label: "Picked Up", desc: "The bin was hauled away. All done!" },
];
const LIFECYCLE_ORDER = LIFECYCLE.map((s) => s.key);

function fmtDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function BinDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const orderQuery = useBinOrder(id);
  const cancelBinOrder = useCancelBinOrder();
  const [cancelling, setCancelling] = useState(false);

  const order = orderQuery.data;

  const handleCancel = () => {
    if (!order) return;
    Alert.alert(
      "Cancel Order?",
      `Cancel your ${order.binSizeLabel} ${order.binTypeLabel} order at ${order.deliveryAddress}? This can't be undone.`,
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelBinOrder.mutateAsync(order.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Couldn't Cancel", err?.message ?? "Please try again.");
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const Header = (
    <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: topPad + 12 }]}>
      <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="arrow-left" size={20} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Bin Order</Text>
      <View style={styles.backBtn} />
    </View>
  );

  if (orderQuery.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {Header}
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {Header}
        <View style={styles.centerBox}>
          <Feather name="trash-2" size={40} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 17, marginBottom: 6 }}>Order Not Found</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", paddingHorizontal: 32, marginBottom: 24 }}>
            This order may no longer be available or the link is invalid.
          </Text>
          <Pressable onPress={() => router.replace("/(tabs)/bins")} style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 }}>
            <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Browse Bins</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const isCancelled = order.status === "cancelled";
  const currentIdx = LIFECYCLE_ORDER.indexOf(order.status);
  const canCancel = order.status === "pending" || order.status === "confirmed";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {Header}

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {order.binSizeLabel} {order.binTypeLabel}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {order.serviceType === "temporary" ? "Temporary Roll-Off" : "Permanent Service"}
              </Text>
            </View>
            <StatusBadge status={order.displayStatus as any} />
          </View>
          <View style={[styles.costRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.costLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>ESTIMATED COST</Text>
            <Text style={[styles.costValue, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>{order.estimatedCost}</Text>
          </View>
        </View>

        {/* Timeline */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>STATUS TIMELINE</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {isCancelled ? (
            <View style={styles.cancelledRow}>
              <Feather name="x-circle" size={20} color={colors.destructive} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepLabel, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>Order Cancelled</Text>
                <Text style={[styles.stepDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  This order was cancelled and is no longer active.
                </Text>
              </View>
            </View>
          ) : (
            LIFECYCLE.map((step, idx) => {
              const done = idx <= currentIdx;
              const current = idx === currentIdx;
              const isLast = idx === LIFECYCLE.length - 1;
              const stepDate =
                step.key === "pending"
                  ? fmtDate(order.createdAt)
                  : step.key === "delivered"
                    ? fmtDate(order.deliveryDate)
                    : null;
              return (
                <View key={step.key} style={styles.stepRow}>
                  <View style={styles.stepRail}>
                    <Feather
                      name={done ? "check-circle" : "circle"}
                      size={18}
                      color={done ? (current ? colors.primary : "#16a34a") : colors.mutedForeground + "66"}
                    />
                    {!isLast && (
                      <View style={[styles.stepLine, { backgroundColor: idx < currentIdx ? "#16a34a66" : colors.border }]} />
                    )}
                  </View>
                  <View style={[styles.stepContent, isLast && { paddingBottom: 0 }]}>
                    <View style={styles.stepHeaderRow}>
                      <Text style={[styles.stepLabel, { color: done ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
                        {step.label}
                      </Text>
                      {current && (
                        <Text style={[styles.currentTag, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>CURRENT</Text>
                      )}
                    </View>
                    <Text style={[styles.stepDesc, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{step.desc}</Text>
                    {stepDate && (
                      <Text style={[styles.stepDate, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        {step.key === "delivered" && order.status === "pending" ? "Scheduled: " : ""}
                        {stepDate}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Details */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>ORDER DETAILS</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DetailRow icon="map-pin" label="Delivery Address" value={order.deliveryAddress} colors={colors} />
          <DetailRow icon="calendar" label="Delivery Date" value={fmtDate(order.deliveryDate) ?? "—"} colors={colors} />
          <DetailRow icon="trash-2" label="Waste Type" value={order.wasteType} colors={colors} />
          <DetailRow
            icon="truck"
            label="Preferred Provider"
            value={PROVIDER_LABEL[(order as any).preferredProvider ?? "any"] ?? "Best Available"}
            colors={colors}
          />
          {(order as any).notes ? (
            <DetailRow icon="file-text" label="Special Instructions" value={(order as any).notes} colors={colors} last />
          ) : null}
        </View>

        {/* Cancel */}
        {canCancel && (
          <Pressable
            onPress={handleCancel}
            disabled={cancelling}
            style={[styles.cancelBtn, { borderColor: colors.destructive, opacity: cancelling ? 0.6 : 1 }]}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <>
                <Feather name="x-circle" size={16} color={colors.destructive} />
                <Text style={[styles.cancelText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>Cancel Order</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value, colors, last }: {
  icon: any;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Feather name={icon} size={15} color={colors.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 10 },
  headerTitle: { flex: 1, fontSize: 20 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginBottom: 8 },
  summaryTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { fontSize: 18 },
  subtitle: { fontSize: 13, marginTop: 2 },
  costRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, marginTop: 14, paddingTop: 14 },
  costLabel: { fontSize: 11, letterSpacing: 0.5 },
  costValue: { fontSize: 18 },
  sectionLabel: { fontSize: 11, letterSpacing: 0.8, marginTop: 8, marginBottom: 6, marginLeft: 2 },
  stepRow: { flexDirection: "row", gap: 12 },
  stepRail: { alignItems: "center", width: 18 },
  stepLine: { width: 2, flex: 1, minHeight: 24, marginVertical: 2 },
  stepContent: { flex: 1, paddingBottom: 18 },
  stepHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepLabel: { fontSize: 14 },
  currentTag: { fontSize: 9, letterSpacing: 0.6 },
  stepDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  stepDate: { fontSize: 12, marginTop: 4 },
  cancelledRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  detailRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 12 },
  detailLabel: { fontSize: 11, letterSpacing: 0.4, marginBottom: 3, textTransform: "uppercase" },
  detailValue: { fontSize: 14, lineHeight: 19 },
  cancelBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 10, paddingVertical: 14, marginTop: 8 },
  cancelText: { fontSize: 15 },
});
