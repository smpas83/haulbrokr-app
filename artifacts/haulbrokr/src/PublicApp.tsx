import { Switch, Route, Router as WouterRouter } from 'wouter';
import SupportPage from "./pages/support";
import PrivacyPage from "./pages/privacy";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PublicApp() {
  return (
    <WouterRouter base={basePath}>
      <Switch>
        <Route path="/support" component={SupportPage} />
        <Route path="/privacy" component={PrivacyPage} />
      </Switch>
    </WouterRouter>
  );
}
