import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from 'wouter';

import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";
import { AppLoader } from "@/components/shared/app-loader";

const AuthShell = lazy(() => import("./AuthShell"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function PublicRouter() {
  return (
    <Switch>
      <Route path="/support" component={SupportPage} />
      <Route path="/privacy" component={PrivacyPage} />
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
