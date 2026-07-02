import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from 'wouter';

import { LoadingSpinner } from "@/components/design-system";
import { PublicLayout } from "@/components/design-system/layouts";
import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";

const AuthShell = lazy(() => import("./AuthShell"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <LoadingSpinner />
    </div>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/support">
        <PublicLayout><SupportPage /></PublicLayout>
      </Route>
      <Route path="/privacy">
        <PublicLayout><PrivacyPage /></PublicLayout>
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
