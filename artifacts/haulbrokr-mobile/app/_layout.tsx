import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { ClerkProvider, useAuth } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { ClerkAuthProvider } from "@/context/ClerkAuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { useMyProfile } from "@/hooks/useLiveApi";

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

const tokenCache = {
  async getToken(key: string) {
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async saveToken(key: string, value: string) {
    try { await SecureStore.setItemAsync(key, value); } catch {}
  },
  async clearToken(key: string) {
    try { await SecureStore.deleteItemAsync(key); } catch {}
  },
};

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const profileQuery = useMyProfile();

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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <QueryClientProvider client={queryClient}>
            <ClerkAuthProvider>
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
