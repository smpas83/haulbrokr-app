import { lazy, Suspense, useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";

import { LoadingSpinner } from "@/components/design-system";
import {
  CustomerDashboardLayout,
  DispatcherDashboardLayout,
  DriverDashboardLayout,
  FleetDashboardLayout,
} from "@/components/design-system/layouts";
import { Toaster } from "@/components/ui/toaster";
import { useGetMyProfile } from "@workspace/api-client-react";
import { SignInPage, SignUpPage } from "./pages/auth";
import LandingPage from "./pages/landing";

const OnboardingPage = lazy(() => import("./pages/onboarding"));
const DashboardPage = lazy(() => import("./pages/dashboard"));
const RequestsPage = lazy(() => import("./pages/requests"));
const NewRequestPage = lazy(() => import("./pages/request-new"));
const RequestDetailPage = lazy(() => import("./pages/request-detail"));
const FleetPage = lazy(() => import("./pages/fleet"));
const NewTruckPage = lazy(() => import("./pages/fleet-new"));
const JobsPage = lazy(() => import("./pages/jobs"));
const JobDetailPage = lazy(() => import("./pages/job-detail"));
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
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.png`,
  },
  variables: {
    colorPrimary: "hsl(45 93% 47%)",
    colorForeground: "hsl(222 47% 11%)",
    colorMutedForeground: "hsl(215 16% 47%)",
    colorDanger: "hsl(0 84% 60%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(214 32% 91%)",
    colorInputForeground: "hsl(222 47% 11%)",
    colorNeutral: "hsl(214 32% 91%)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    borderRadius: "0rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white border-2 border-border shadow-2xl rounded-none w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold tracking-tight text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "font-semibold",
    formFieldLabel: "font-bold text-foreground",
    footerActionLink: "text-primary font-bold hover:underline",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground font-mono text-xs uppercase tracking-wider",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600",
    alertText: "text-destructive",
    logoBox: "mb-6 flex justify-center",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "rounded-none border-2 border-border hover:bg-muted font-bold h-11",
    formButtonPrimary: "rounded-none bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-11 shadow-sm",
    formFieldInput: "rounded-none border-2 border-border focus:border-primary focus:ring-1 focus:ring-primary h-11 bg-background",
    footerAction: "mt-6 border-t border-border pt-6",
    dividerLine: "bg-border",
    alert: "rounded-none border-2 border-destructive bg-destructive/10 text-destructive",
    otpCodeFieldInput: "rounded-none border-2 border-border focus:border-primary focus:ring-1 focus:ring-primary",
    formFieldRow: "mb-4",
    main: "p-8",
  },
};

function AppLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <LoadingSpinner />
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
    const DashboardLayout =
      profile.role === "customer"
        ? CustomerDashboardLayout
        : profile.role === "driver"
          ? DriverDashboardLayout
          : profile.role === "provider"
            ? FleetDashboardLayout
            : DispatcherDashboardLayout;

    return <DashboardLayout>{children}</DashboardLayout>;
  }

  return null;
}

function AuthShellRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={`${basePath}/dashboard`}
      signUpFallbackRedirectUrl={`${basePath}/onboarding`}
      localization={{}}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Suspense fallback={<AppLoader />}>
          <Switch>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/">
              <Show when="signed-in"><Redirect to="/dashboard" /></Show>
              <Show when="signed-out"><LandingPage /></Show>
            </Route>
            <Route path="/sign-up/*?" component={SignUpPage} />

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

            <Route path="/jobs/:id">
              <Show when="signed-in"><RequireProfile><JobDetailPage /></RequireProfile></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>

            <Route path="/jobs">
              <Show when="signed-in"><RequireProfile><JobsPage /></RequireProfile></Show>
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
