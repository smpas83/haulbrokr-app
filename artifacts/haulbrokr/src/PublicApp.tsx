import { Switch, Route, Router as WouterRouter } from 'wouter';
import LandingPage from "./pages/landing";
import AboutPage from "./pages/about";
import ContactPage from "./pages/contact";
import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";
import TermsPage from "./pages/terms";
import NotFoundPage from "./pages/not-found";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PublicApp() {
  return (
    <WouterRouter base={basePath}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/landing" component={LandingPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route component={NotFoundPage} />
      </Switch>
    </WouterRouter>
  );
}
