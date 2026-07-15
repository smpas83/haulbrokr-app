import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { Loader2 } from "lucide-react";

import LandingPage from "./pages/landing";
import { SignedInRedirect } from "./components/signed-in-redirect";

const AuthShell = lazy(() => import("./AuthShell"));
const ClerkAuthRoutes = lazy(() => import("./ClerkAuthRoutes"));
const SupportPage = lazy(() => import("./pages/support"));
const PrivacyPage = lazy(() => import("./pages/privacy"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/">
        <LandingPage />
        <SignedInRedirect />
      </Route>
      <Route path="/support">
        <Suspense fallback={<AppLoader />}>
          <SupportPage />
        </Suspense>
      </Route>
      <Route path="/privacy">
        <Suspense fallback={<AppLoader />}>
          <PrivacyPage />
        </Suspense>
      </Route>
      <Route path="/sign-in/*?">
        <Suspense fallback={<AppLoader />}>
          <ClerkAuthRoutes />
        </Suspense>
      </Route>
      <Route path="/sign-up/*?">
        <Suspense fallback={<AppLoader />}>
          <ClerkAuthRoutes />
        </Suspense>
      </Route>
      <Route>
        <Suspense fallback={<AppLoader />}>
          <AuthShell />
        </Suspense>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <PublicRouter />
    </WouterRouter>
  );
}

export default App;
