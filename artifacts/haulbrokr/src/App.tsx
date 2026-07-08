import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { Loader2 } from "lucide-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";
import TermsPage from "./pages/terms";
import AboutPage from "./pages/about";
import ContactPage from "./pages/contact";

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
    <Switch>
      <Route path="/support" component={SupportPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/contact" component={ContactPage} />
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
    <ErrorBoundary>
      <WouterRouter base={basePath}>
        <PublicRouter />
      </WouterRouter>
    </ErrorBoundary>
  );
}
export default App;
