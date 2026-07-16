import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { Loader2 } from "lucide-react";

import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";
import { PageViewTracker } from "./components/page-view-tracker";

const AuthShell = lazy(() => import("./AuthShell"));

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
    <>
      <PageViewTracker />
      <Switch>
        <Route path="/support" component={SupportPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route>
          <Suspense fallback={<AppLoader />}>
            <AuthShell />
          </Suspense>
        </Route>
      </Switch>
    </>
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
