import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from 'wouter';

import { AppErrorBoundary } from "./components/app-error-boundary";
import { AppLoader } from "./components/app-loader";
import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";
import LandingPage from "./pages/landing";

const AuthShell = lazy(() => import("./AuthShell"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function PublicRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route>
        <AppErrorBoundary>
          <Suspense fallback={<AppLoader />}>
            <AuthShell />
          </Suspense>
        </AppErrorBoundary>
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
