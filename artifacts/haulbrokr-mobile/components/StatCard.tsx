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

interface Props {
  icon: string;
  value: string | number;
  label: string;
  accent?: boolean;
  onPress?: () => void;
}

export function StatCard({ icon, value, label, accent, onPress }: Props) {
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
    onPress?.();
  }, [scale, onPress]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          {
            backgroundColor: accent ? colors.primary : colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: accent
                ? colors.primaryForeground + "20"
                : colors.primary + "18",
            },
          ]}
        >
          <Feather
            name={icon as any}
            size={18}
            color={accent ? colors.primaryForeground : colors.primary}
          />
        </View>
        <Text
          style={[
            styles.value,
            {
              color: accent ? colors.primaryForeground : colors.foreground,
              fontFamily: "Inter_700Bold",
            },
          ]}
        >
          {value}
        </Text>
        <Text
          style={[
            styles.label,
            {
              color: accent
                ? colors.primaryForeground + "cc"
                : colors.mutedForeground,
              fontFamily: "Inter_400Regular",
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 130,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
});
