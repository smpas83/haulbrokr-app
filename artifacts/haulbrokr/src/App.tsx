import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { Loader2 } from "lucide-react";

import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";
import LandingPage from "./pages/landing";

const AuthShell = lazy(() => import("./AuthShell"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");
const useLocalLandingFallback = isLocalhost && clerkPubKey?.startsWith("pk_live_");

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
      <Route path="/support" component={SupportPage} />
      <Route path="/privacy" component={PrivacyPage} />
      {useLocalLandingFallback && <Route path="/" component={LandingPage} />}
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
