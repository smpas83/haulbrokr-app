import { useAuth } from "@clerk/expo";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, DevSettings, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { clearClerkSessionTokens } from "@/lib/clerkTokenCache";
import { useMyProfile } from "@/hooks/useLiveApi";

const LOAD_TIMEOUT_MS = 10_000;

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
  const profileQuery = useMyProfile();
  const [timedOut, setTimedOut] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recovered, setRecovered] = useState(false);

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
      console.log("AUTH", {
        isLoaded,
        isSignedIn,
        profileError: profileQuery.isError,
        profileFetching: profileQuery.isFetching,
        profileLoading: profileQuery.isLoading,
      });
    }
  }, [isLoaded, isSignedIn, profileQuery.isError, profileQuery.isFetching, profileQuery.isLoading]);

  const handleRecover = async () => {
    setRecovering(true);
    try {
      await clearClerkSessionTokens();
      if (__DEV__ && Platform.OS !== "web") {
        DevSettings.reload();
        return;
      }
      setRecovered(true);
      setTimedOut(false);
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

  if (!isLoaded && timedOut && !recovered) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Authentication is taking too long</Text>
        <Text style={styles.body}>
          A stale session token in SecureStore can block Clerk from loading. Reset auth storage and reload the app.
        </Text>
        <Pressable style={styles.btn} onPress={() => void handleRecover()} disabled={recovering}>
          {recovering ? (
            <ActivityIndicator color="#1e2235" />
          ) : (
            <Text style={styles.btnText}>Reset & Reload</Text>
          )}
        </Pressable>
      </View>
    );
  }

  if (!isLoaded && recovered) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Auth storage cleared</Text>
        <Text style={styles.body}>Force-quit HaulBrokr and reopen the app to finish signing out.</Text>
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
