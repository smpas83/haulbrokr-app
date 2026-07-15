import { lazy, Suspense, useEffect, useRef } from "react";
import { ClerkProvider, Show, useClerk } from "@clerk/react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Layout } from "./components/layout";
import { Toaster } from "@/components/ui/toaster";
import { useGetMyProfile } from "@workspace/api-client-react";
import { clerkAppearance, clerkBasePath, clerkPubKey } from "./lib/clerkAppearance";

const OnboardingPage = lazy(() => import("./pages/onboarding"));
const DashboardPage = lazy(() => import("./pages/dashboard"));
const RequestsPage = lazy(() => import("./pages/requests"));
const NewRequestPage = lazy(() => import("./pages/request-new"));
const RequestDetailPage = lazy(() => import("./pages/request-detail"));
const FleetPage = lazy(() => import("./pages/fleet"));
const NewTruckPage = lazy(() => import("./pages/fleet-new"));
const JobsPage = lazy(() => import("./pages/jobs"));
const MapPage = lazy(() => import("./pages/map"));
const JobDetailPage = lazy(() => import("./pages/job-detail"));
const DispatchPage = lazy(() => import("./pages/dispatch"));
const AccountPage = lazy(() => import("./pages/account"));
const CompanyPage = lazy(() => import("./pages/company"));
const BinsPage = lazy(() => import("./pages/bins"));
const BinDetailPage = lazy(() => import("./pages/bin-detail"));
const ProjectsPage = lazy(() => import("./pages/projects"));
const ProjectDetailPage = lazy(() => import("./pages/project-detail"));
const FactoringPage = lazy(() => import("./pages/factoring"));
const IntegrationsPage = lazy(() => import("./pages/integrations"));
const MobilePaymentPage = lazy(() => import("./pages/mobile-payment"));
const AdminPage = lazy(() => import("./pages/admin"));
const AdminLoginPage = lazy(() => import("./pages/admin-login"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

function stripBase(path: string): string {
  return clerkBasePath && path.startsWith(clerkBasePath)
    ? path.slice(clerkBasePath.length) || "/"
    : path;
}

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

function AppLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) qc.clear();
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function RequireProfile({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading, error } = useGetMyProfile();

  if (isLoading) {
    return <AppLoader />;
  }

  if (error && (error as any).status === 404) {
    return <Redirect to="/onboarding" />;
  }

  if (profile) {
    return <Layout>{children}</Layout>;
  }

  return null;
}

function AuthShellRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      signInUrl={`${clerkBasePath}/sign-in`}
      signUpUrl={`${clerkBasePath}/sign-up`}
      signInFallbackRedirectUrl={`${clerkBasePath}/dashboard`}
      signUpFallbackRedirectUrl={`${clerkBasePath}/onboarding`}
      localization={{}}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Suspense fallback={<AppLoader />}>
          <Switch>
            <Route path="/onboarding">
              <Show when="signed-in">
                <OnboardingPage />
              </Show>
              <Show when="signed-out">
                <Redirect to="/sign-in" />
              </Show>
            </Route>

            <Route path="/dashboard">
              <Show when="signed-in"><RequireProfile><DashboardPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/requests/new">
              <Show when="signed-in"><RequireProfile><NewRequestPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/requests/:id">
              <Show when="signed-in"><RequireProfile><RequestDetailPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/requests">
              <Show when="signed-in"><RequireProfile><RequestsPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/fleet/new">
              <Show when="signed-in"><RequireProfile><NewTruckPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/fleet/:id/edit">
              <Show when="signed-in"><RequireProfile><NewTruckPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/fleet">
              <Show when="signed-in"><RequireProfile><FleetPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/dispatch">
              <Show when="signed-in"><RequireProfile><DispatchPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/jobs/:id">
              <Show when="signed-in"><RequireProfile><JobDetailPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/jobs">
              <Show when="signed-in"><RequireProfile><JobsPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/map">
              <Show when="signed-in"><RequireProfile><MapPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/account">
              <Show when="signed-in"><RequireProfile><AccountPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/mobile-payment">
              <Show when="signed-in"><RequireProfile><MobilePaymentPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/company">
              <Show when="signed-in"><RequireProfile><CompanyPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/bins/:id">
              <Show when="signed-in"><RequireProfile><BinDetailPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/bins">
              <Show when="signed-in"><RequireProfile><BinsPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/projects/:id">
              <Show when="signed-in"><RequireProfile><ProjectDetailPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/projects">
              <Show when="signed-in"><RequireProfile><ProjectsPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/factoring">
              <Show when="signed-in"><RequireProfile><FactoringPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/integrations">
              <Show when="signed-in"><RequireProfile><IntegrationsPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/admin/login">
              <AdminLoginPage />
            </Route>

            <Route path="/admin">
              <AdminPage />
            </Route>


            <Route component={NotFoundPage} />
          </Switch>
        </Suspense>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default AuthShellRoutes;
