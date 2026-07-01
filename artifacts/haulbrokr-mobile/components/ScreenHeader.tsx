import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type ScreenHeaderProps = {
  title: string;
  subtitle?: React.ReactNode;
  icon?: keyof typeof Feather.glyphMap;
  right?: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  style?: ViewStyle;
};

export function ScreenHeader({
  title,
  subtitle,
  icon,
  right,
  onBack,
  showBack = true,
  style,
}: ScreenHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          paddingTop: topPad + 12,
        },
        style,
      ]}
    >
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack ?? (() => router.back())}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        <Text
          style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {typeof subtitle === "string" ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {right}
      {icon ? (
        <View style={[styles.headerIcon, { backgroundColor: colors.primary + "18" }]}>
          <Feather name={icon} size={18} color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
});
