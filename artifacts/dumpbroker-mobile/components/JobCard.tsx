import { Feather } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import type { Job } from "@/context/AppContext";
import { MATERIAL_ICON, TYPE_COLOR } from "@/constants/theme";
import { StatusBadge } from "./StatusBadge";

interface Props {
  job: Job;
  onPress?: (job: Job) => void;
  showBidButton?: boolean;
  onBid?: (job: Job) => void;
  /** Live API jobs omit demo-only fields (quantity, distances, bids). */
  isLive?: boolean;
}

export function JobCard({ job, onPress, showBidButton, onBid, isLive }: Props) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.985, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    onPress?.(job);
  }, [scale, onPress, job]);

  const iconName = MATERIAL_ICON[job.material] ?? "truck";
  const typeColor = TYPE_COLOR[job.projectType] ?? colors.primary;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* Header row */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
            <Feather name={iconName as any} size={18} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text
              style={[styles.projectName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
              numberOfLines={1}
            >
              {job.projectName}
            </Text>
            <Text
              style={[styles.material, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
              numberOfLines={1}
            >
              {job.material}
            </Text>
          </View>
          <StatusBadge status={job.status as any} size="sm" />
        </View>

        {/* Project type + rate row */}
        <View style={styles.typeRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + "18", borderColor: typeColor + "40" }]}>
            <Text style={[styles.typeText, { color: typeColor, fontFamily: "Inter_600SemiBold" }]}>
              {job.projectType}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={[styles.rateLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Rate{" "}
          </Text>
          <Text style={[styles.rate, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
            ${job.budgetPerHour}/hr
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Material info row */}
        <View style={styles.materialInfoRow}>
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Material
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {job.material}
            </Text>
          </View>
          {!isLive && (
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Quantity
              </Text>
              <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {job.quantity.toLocaleString()} {job.quantityUnit}
              </Text>
            </View>
          )}
          <View style={styles.infoItem}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              Trucks
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {job.trucksNeeded}
            </Text>
          </View>
        </View>

        {/* Locations */}
        <View style={styles.locations}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: colors.primary }]} />
            <Text
              style={[styles.address, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
              numberOfLines={1}
            >
              {job.pickupAddress}
            </Text>
          </View>
          <View style={[styles.locationLine, { backgroundColor: colors.border }]} />
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: "#16a34a" }]} />
            <Text
              style={[styles.address, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
              numberOfLines={1}
            >
              {job.deliveryAddress}
            </Text>
          </View>
        </View>

        {/* Distances + dates row */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {!isLive && (
            <>
              <View style={styles.footerItem}>
                <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                <Text style={[styles.footerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {job.distanceToStart} mi to start
                </Text>
              </View>
              <View style={styles.footerItem}>
                <Feather name="navigation" size={11} color={colors.mutedForeground} />
                <Text style={[styles.footerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {job.distanceToEnd} mi to end
                </Text>
              </View>
            </>
          )}
          {!!job.scheduledDate && (
            <View style={styles.footerItem}>
              <Feather name="calendar" size={11} color={colors.mutedForeground} />
              <Text style={[styles.footerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {job.scheduledDate}
              </Text>
            </View>
          )}
        </View>

        {/* Bids row + bid button */}
        {!isLive && (
          <View style={styles.bottomRow}>
            <View style={styles.bidsInfo}>
              {job.bidsCount > 0 && (
                <>
                  <View style={[styles.bidCountBadge, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name="trending-up" size={11} color={colors.primary} />
                    <Text style={[styles.bidCountText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                      {job.bidsCount} bid{job.bidsCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </>
              )}
              {job.bidsCount === 0 && (
                <Text style={[styles.noBids, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Be the first to bid
                </Text>
              )}
            </View>
            {showBidButton && job.status === "open" && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onBid?.(job);
                }}
                style={[styles.bidBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.bidBtnText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
                  Bid Project
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 12,
    borderRadius: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: 10,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  projectName: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  material: {
    fontSize: 12,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
  rateLabel: {
    fontSize: 13,
  },
  rate: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  divider: {
    height: 1,
  },
  materialInfoRow: {
    flexDirection: "row",
    gap: 12,
  },
  infoItem: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  locations: {
    gap: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  locationLine: {
    height: 1,
    marginLeft: 4,
  },
  address: {
    fontSize: 12,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 11,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bidsInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bidCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bidCountText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  noBids: {
    fontSize: 12,
  },
  bidBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bidBtnText: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
});
