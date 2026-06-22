import { useAuth, useUser } from "@clerk/expo";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import React, { createContext, useContext, useEffect } from "react";

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
