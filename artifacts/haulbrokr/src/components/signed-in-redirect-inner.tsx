import { useEffect } from "react";
import { ClerkProvider, useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { clerkAppearance, clerkBasePath, clerkPubKey } from "@/lib/clerkAppearance";

function RedirectIfSignedIn() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setLocation("/dashboard", { replace: true });
    }
  }, [isLoaded, isSignedIn, setLocation]);

  return null;
}

export default function SignedInRedirectInner() {
  if (!clerkPubKey) return null;

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      signInUrl={`${clerkBasePath}/sign-in`}
      signUpUrl={`${clerkBasePath}/sign-up`}
    >
      <RedirectIfSignedIn />
    </ClerkProvider>
  );
}
