import { ClerkProvider } from "@clerk/react";
import { Switch, Route, useLocation } from "wouter";
import { SignInPage, SignUpPage } from "./pages/auth";
import { clerkAppearance, clerkBasePath, clerkPubKey } from "./lib/clerkAppearance";

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

function stripBase(path: string): string {
  return clerkBasePath && path.startsWith(clerkBasePath)
    ? path.slice(clerkBasePath.length) || "/"
    : path;
}

export default function ClerkAuthRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      signInUrl={`${clerkBasePath}/sign-in`}
      signUpUrl={`${clerkBasePath}/sign-up`}
      signInFallbackRedirectUrl={`${clerkBasePath}/dashboard`}
      signUpFallbackRedirectUrl={`${clerkBasePath}/onboarding`}
      localization={{}}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
      </Switch>
    </ClerkProvider>
  );
}
