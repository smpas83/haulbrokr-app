import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClerkBootstrap } from "@/components/ClerkBootstrap";
import { AppProvider } from "@/context/AppContext";
import { ClerkAuthProvider } from "@/context/ClerkAuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { useMyProfile } from "@/hooks/useLiveApi";
import { ClerkConfigError, resolveClerkPublishableKey } from "@/lib/clerkConfig";
import { bootstrapClerk, clerkTokenCache } from "@/lib/clerkTokenCache";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

if (Platform.OS !== "web") {
  focusManager.setEventListener((handleFocus) => {
    const onAppStateChange = (status: AppStateStatus) => {
      handleFocus(status === "active");
    };
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  });
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const profileQuery = useMyProfile();

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

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in" as any);
      return;
    }
    if (profileQuery.isError) {
      router.replace("/onboarding" as any);
    }
  }, [isLoaded, isSignedIn, profileQuery.isError]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [boot, setBoot] = useState<{ ready: boolean; error?: string }>({ ready: false });
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  const publishableKey = resolveClerkPublishableKey();

  useEffect(() => {
    bootstrapClerk(publishableKey).then((result) => {
      if (__DEV__) {
        console.log("AUTH config", {
          keyPrefix: publishableKey ? publishableKey.slice(0, 12) : "(missing)",
          bootstrapOk: result.ok,
          error: result.error,
        });
      }
      setBoot({ ready: true, error: result.ok ? undefined : result.error });
    });
  }, [publishableKey]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && boot.ready) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, boot.ready]);

  if (!boot.ready || (!fontsLoaded && !fontError)) {
    return null;
  }

  if (boot.error) {
    return (
      <SafeAreaProvider>
        <ClerkConfigError
          title="Clerk failed to start"
          message={boot.error}
          onRetry={() => {
            setBoot({ ready: false });
            bootstrapClerk(publishableKey).then((result) =>
              setBoot({ ready: true, error: result.ok ? undefined : result.error })
            );
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} tokenCache={clerkTokenCache}>
          <QueryClientProvider client={queryClient}>
            <ClerkAuthProvider>
              <ClerkBootstrap publishableKey={publishableKey}>
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
              </ClerkBootstrap>
            </ClerkAuthProvider>
          </QueryClientProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
