import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect } from "react";

import { clearClerkSessionTokens, markPendingSignOut, reloadApp } from "@/lib/clerkTokenCache";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface ClerkAuthContextType {
  isSignedIn: boolean;
  isLoaded: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
  signOutAndReset: () => Promise<void>;
}

const ClerkAuthContext = createContext<ClerkAuthContextType>({
  isSignedIn: false,
  isLoaded: false,
  userId: null,
  getToken: async () => null,
  signOutAndReset: async () => {},
});

export function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, getToken, userId, signOut } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBaseUrl(API_BASE);
    setAuthTokenGetter(async () => {
      if (!isSignedIn) return null;
      return getToken();
    });
  }, [isSignedIn, getToken]);

  const signOutAndReset = useCallback(async () => {
    await markPendingSignOut();
    queryClient.clear();
    await clearClerkSessionTokens();
    try {
      await signOut();
    } catch {
      // Tokens are already cleared; reload will finish the reset.
    }
    reloadApp();
    router.replace("/sign-in" as any);
  }, [queryClient, signOut]);

  return (
    <ClerkAuthContext.Provider value={{ isSignedIn: !!isSignedIn, isLoaded: !!isLoaded, userId: userId ?? null, getToken, signOutAndReset }}>
      {children}
    </ClerkAuthContext.Provider>
  );
}

export function useClerkAuth() {
  return useContext(ClerkAuthContext);
}
