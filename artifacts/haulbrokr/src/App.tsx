import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from 'wouter';
import { Loader2 } from "lucide-react";

import { AuthenticationUnavailable } from "@/components/auth-unavailable";
import { runtimeConfig, warnAboutRuntimeConfig } from "@/lib/runtimeConfig";
import LandingPage from "./pages/landing";
import AboutPage from "./pages/about";
import ContactPage from "./pages/contact";
import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";
import TermsPage from "./pages/terms";

const AuthShell = lazy(() => import("./AuthShell"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

warnAboutRuntimeConfig();

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
      <Route path="/" component={LandingPage} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route>
        {runtimeConfig.isClerkConfigured ? (
          <Suspense fallback={<AppLoader />}>
            <AuthShell />
          </Suspense>
        ) : (
          <AuthUnavailableRoute />
        )}
      </Route>
    </Switch>
  );
}

function AuthUnavailableRoute() {
  const [location, setLocation] = useLocation();
  const isAuthRoute =
    location.startsWith("/sign-in") || location.startsWith("/sign-up");

  useEffect(() => {
    if (isAuthRoute) {
      return;
    }

    setLocation(`/sign-in?redirect_url=${encodeURIComponent(location || "/")}`, {
      replace: true,
    });
  }, [isAuthRoute, location, setLocation]);

  return <AuthenticationUnavailable />;
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <PublicRouter />
    </WouterRouter>
  );
}
export default App;
