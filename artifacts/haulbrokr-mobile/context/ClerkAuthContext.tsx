import { useAuth } from "@clerk/expo";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, useRef } from "react";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

interface ClerkAuthContextType {
  isSignedIn: boolean;
  isLoaded: boolean;
  userId: string | null;
  getToken: () => Promise<string | null>;
}

const ClerkAuthContext = createContext<ClerkAuthContextType>({
  isSignedIn: false,
  isLoaded: false,
  userId: null,
  getToken: async () => null,
});

export function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, getToken, userId } = useAuth();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const nextUserId = userId ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== nextUserId) {
      queryClient.clear();
    }
    prevUserIdRef.current = nextUserId;
  }, [userId, queryClient]);

  useEffect(() => {
    setBaseUrl(API_BASE);
    setAuthTokenGetter(async () => {
      if (!isSignedIn) return null;
      return getToken();
    });
  }, [isSignedIn, getToken]);

  return (
    <ClerkAuthContext.Provider value={{ isSignedIn: !!isSignedIn, isLoaded: !!isLoaded, userId: userId ?? null, getToken }}>
      {children}
    </ClerkAuthContext.Provider>
  );
}

export function useClerkAuth() {
  return useContext(ClerkAuthContext);
}
