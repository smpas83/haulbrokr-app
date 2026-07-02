import Constants from "expo-constants";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { reloadApp } from "@/lib/clerkTokenCache";

/** Resolve Clerk key from Metro env or app.config.js extra (EAS builds). */
export function resolveClerkPublishableKey(): string {
  return (
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ??
    ""
  );
}

type Props = {
  title: string;
  message: string;
  onRetry?: () => void;
};

export function ClerkConfigError({ title, message, onRetry }: Props) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>Reload app</Text>
        </Pressable>
      )}
      <Pressable style={styles.btnSecondary} onPress={() => reloadApp()}>
        <Text style={styles.btnSecondaryText}>Hard reload</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#1e2235",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  title: {
    color: "#f0f6ff",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    textAlign: "center",
  },
  body: {
    color: "#8ba0b8",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  btn: {
    marginTop: 8,
    backgroundColor: "#e9a600",
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 48,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: "#1e2235",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  btnSecondary: { paddingVertical: 8 },
  btnSecondaryText: {
    color: "#e9a600",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
});
