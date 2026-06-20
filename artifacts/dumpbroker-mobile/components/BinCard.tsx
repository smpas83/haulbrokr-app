import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

export interface BinSize {
  id: string;
  size: string;
  type: string;
  description: string;
  priceRange: string;
  priceUnit: string;
  bestFor: string;
}

interface Props<T extends BinSize> {
  bin: T;
  selected?: boolean;
  onPress?: (bin: T) => void;
}

export function BinCard<T extends BinSize>({ bin, selected, onPress }: Props<T>) {
  const colors = useColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(bin);
  }, [scale, onPress, bin]);

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          {
            backgroundColor: selected ? colors.primary : colors.card,
            borderColor: selected ? colors.primary : colors.border,
            borderWidth: selected ? 2 : 1,
          },
        ]}
      >
        <View style={styles.top}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: selected
                  ? colors.primaryForeground + "25"
                  : colors.primary + "18",
              },
            ]}
          >
            <Feather
              name="package"
              size={20}
              color={selected ? colors.primaryForeground : colors.primary}
            />
          </View>
          <Text
            style={[
              styles.size,
              {
                color: selected ? colors.primaryForeground : colors.foreground,
                fontFamily: "Inter_700Bold",
              },
            ]}
          >
            {bin.size}
          </Text>
          <Text
            style={[
              styles.type,
              {
                color: selected
                  ? colors.primaryForeground + "cc"
                  : colors.mutedForeground,
                fontFamily: "Inter_500Medium",
              },
            ]}
          >
            {bin.type}
          </Text>
        </View>

        <View style={styles.priceRow}>
          <Text
            style={[
              styles.price,
              {
                color: selected ? colors.primaryForeground : colors.primary,
                fontFamily: "Inter_700Bold",
              },
            ]}
          >
            {bin.priceRange}
          </Text>
          <Text
            style={[
              styles.priceUnit,
              {
                color: selected
                  ? colors.primaryForeground + "99"
                  : colors.mutedForeground,
                fontFamily: "Inter_400Regular",
              },
            ]}
          >
            /{bin.priceUnit}
          </Text>
        </View>

        <Text
          style={[
            styles.bestFor,
            {
              color: selected
                ? colors.primaryForeground + "bb"
                : colors.mutedForeground,
              fontFamily: "Inter_400Regular",
            },
          ]}
          numberOfLines={2}
        >
          {bin.bestFor}
        </Text>

        {selected && (
          <View style={styles.selectedIndicator}>
            <Feather
              name="check"
              size={14}
              color={colors.primaryForeground}
            />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    margin: 4,
  },
  card: {
    padding: 14,
    gap: 8,
    minHeight: 160,
    position: "relative",
  },
  top: {
    gap: 3,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  size: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  type: {
    fontSize: 12,
    fontWeight: "500" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  priceUnit: {
    fontSize: 12,
  },
  bestFor: {
    fontSize: 11,
    lineHeight: 15,
  },
  selectedIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
