import { useAuth } from "@clerk/expo";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { clearClerkSessionTokens, reloadApp } from "@/lib/clerkTokenCache";

const LOAD_TIMEOUT_MS = 6_000;

type Props = {
  publishableKey: string;
  children: React.ReactNode;
};

/**
 * Guards auth bootstrap: surfaces config errors, recovers from stale SecureStore
 * JWTs that can leave Clerk's headless client stuck with isLoaded=false forever.
 */
export function ClerkBootstrap({ publishableKey, children }: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  useEffect(() => {
    if (__DEV__) {
      console.log("AUTH", { isLoaded, isSignedIn });
    }
  }, [isLoaded, isSignedIn]);

  // Auto-recover in dev when Clerk headless load hangs (stale JWT in singleton).
  useEffect(() => {
    if (!__DEV__ || isLoaded || !timedOut || recovering) return;
    void (async () => {
      setRecovering(true);
      await clearClerkSessionTokens();
      reloadApp();
    })();
  }, [isLoaded, timedOut, recovering]);

  const handleRecover = async () => {
    setRecovering(true);
    try {
      await clearClerkSessionTokens();
      reloadApp();
    } finally {
      setRecovering(false);
    }
  };

  if (!publishableKey) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Clerk is not configured</Text>
        <Text style={styles.body}>
          Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in artifacts/haulbrokr-mobile/.env, then restart Metro with --clear.
        </Text>
      </View>
    );
  }

  if (!isLoaded && timedOut) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e9a600" size="large" />
        <Text style={styles.title}>Resetting authentication…</Text>
        <Text style={styles.body}>
          Clerk did not finish loading — clearing stale session storage and reloading.
        </Text>
        {Platform.OS !== "web" && !__DEV__ && (
          <Pressable style={styles.btn} onPress={() => void handleRecover()} disabled={recovering}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return <>{children}</>;
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
});
