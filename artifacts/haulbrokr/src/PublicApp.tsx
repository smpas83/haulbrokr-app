import { Switch, Route, Router as WouterRouter } from "wouter";
import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";
import TermsPage from "./pages/terms";
import AboutPage from "./pages/about";
import ContactPage from "./pages/contact";
import { SignInPage, SignUpPage } from "./pages/auth";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PublicApp() {
  return (
    <WouterRouter base={basePath}>
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />
      </Switch>
    </WouterRouter>
  );
}
