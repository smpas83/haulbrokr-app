import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { resourceCache } from "@clerk/expo/resource-cache";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, AppState, type AppStateStatus, Platform, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { ClerkAuthProvider } from "@/context/ClerkAuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { useMyProfile } from "@/hooks/useLiveApi";
import { recoverStaleClientJwtOnStartup, syncClerkSessionStorage, tokenCache } from "@/lib/clerkTokenCache";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Bridge React Query's focus tracking to React Native AppState so interval
// polling pauses when the OS backgrounds the app and resumes on foreground.
// Only installed on native; on web we keep React Query's default focus listener.
if (Platform.OS !== "web") {
  focusManager.setEventListener((handleFocus) => {
    const onAppStateChange = (status: AppStateStatus) => {
      handleFocus(status === "active");
    };
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  });
}

function ClerkSessionStorageSync() {
  const { isSignedIn, isLoaded } = useAuth();

  useEffect(() => {
    void syncClerkSessionStorage(isLoaded, !!isSignedIn);
  }, [isLoaded, isSignedIn]);

  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const profileQuery = useMyProfile();
  const segments = useSegments();
  const isPublicRoute = segments[0] === "sign-in" || segments[0] === "onboarding";

  useEffect(() => {
    if (!isLoaded) {
      if (!isPublicRoute) {
        router.replace("/sign-in" as any);
      }
      return;
    }
    if (isSignedIn) {
      if (segments[0] === "sign-in") {
        router.replace("/" as any);
        return;
      }
      if (profileQuery.isError) {
        router.replace("/onboarding" as any);
      }
      return;
    }
    if (!isPublicRoute) {
      router.replace("/sign-in" as any);
    }
  }, [isLoaded, isSignedIn, profileQuery.isError, isPublicRoute, segments]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#1e2235", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#e9a600" />
      </View>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [authStorageReady, setAuthStorageReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  useEffect(() => {
    void recoverStaleClientJwtOnStartup().finally(() => setAuthStorageReady(true));
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && authStorageReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authStorageReady]);

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const clerkKeyInvalid =
    !publishableKey ||
    publishableKey.includes("xxx") ||
    publishableKey.includes("...") ||
    !/^pk_(test|live)_/.test(publishableKey);

  if ((!fontsLoaded && !fontError) || !authStorageReady) {
    return null;
  }

  if (clerkKeyInvalid) {
    return (
      <View style={{ flex: 1, backgroundColor: "#1e2235", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "#f87171", fontFamily: "Inter_600SemiBold", fontSize: 16, textAlign: "center", marginBottom: 12 }}>
          Clerk key missing or invalid
        </Text>
        <Text style={{ color: "#8ba0b8", fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21 }}>
          Set exactly one EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env to your real pk_live_... or pk_test_... value, then restart Expo with --clear.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider
          publishableKey={publishableKey}
          tokenCache={tokenCache}
          __experimental_resourceCache={resourceCache}
        >
          <QueryClientProvider client={queryClient}>
            <ClerkAuthProvider>
              <ClerkSessionStorageSync />
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <LanguageProvider>
                    <AppProvider>
                      <AuthGate>
                        <Stack screenOptions={{ headerShown: false }}>
                          <Stack.Screen name="(tabs)" />
                          <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
                          <Stack.Screen name="onboarding" options={{ animation: "slide_from_bottom" }} />
                          <Stack.Screen name="job/[id]" />
                          <Stack.Screen name="bin/[id]" />
                          <Stack.Screen name="dump-sites" />
                          <Stack.Screen name="terms" />
                          <Stack.Screen name="help" />
                          <Stack.Screen name="privacy" />
                          <Stack.Screen name="wallet" />
                          <Stack.Screen name="language" />
                          <Stack.Screen name="tracking/[id]" />
                          <Stack.Screen name="notifications" />
                          <Stack.Screen name="invoice/[id]" />
                          <Stack.Screen name="fleet" />
                          <Stack.Screen name="driver-jobs" />
                          <Stack.Screen name="foreman" />
                          <Stack.Screen name="admin-payouts" />
                          <Stack.Screen name="admin-compliance" />
                          <Stack.Screen name="admin-credit" />
                        </Stack>
                      </AuthGate>
                    </AppProvider>
                  </LanguageProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </ClerkAuthProvider>
          </QueryClientProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
