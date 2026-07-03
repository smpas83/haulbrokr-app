import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from 'wouter';

import { AppLoader } from "@/components/shared";
import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";

const AuthShell = lazy(() => import("./AuthShell"));
const FeaturesPage = lazy(() => import("./pages/features"));
const IndustriesPage = lazy(() => import("./pages/industries"));
const PricingPage = lazy(() => import("./pages/pricing"));
const AboutPage = lazy(() => import("./pages/about"));
const ContactPage = lazy(() => import("./pages/contact"));
const TermsPage = lazy(() => import("./pages/terms"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function PublicRouter() {
  return (
    <Switch>
      <Route path="/support" component={SupportPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/features">
        <Suspense fallback={<AppLoader />}><FeaturesPage /></Suspense>
      </Route>
      <Route path="/industries">
        <Suspense fallback={<AppLoader />}><IndustriesPage /></Suspense>
      </Route>
      <Route path="/pricing">
        <Suspense fallback={<AppLoader />}><PricingPage /></Suspense>
      </Route>
      <Route path="/about">
        <Suspense fallback={<AppLoader />}><AboutPage /></Suspense>
      </Route>
      <Route path="/contact">
        <Suspense fallback={<AppLoader />}><ContactPage /></Suspense>
      </Route>
      <Route path="/terms">
        <Suspense fallback={<AppLoader />}><TermsPage /></Suspense>
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
