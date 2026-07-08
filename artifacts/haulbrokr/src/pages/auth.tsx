import type { ReactNode } from "react";
import { SignIn, SignUp } from "@clerk/react";
import { Truck, ShieldCheck, Zap, MapPin } from "lucide-react";
import logo from "@/assets/haulbrokr-logo.png";
import logoWebp from "@/assets/haulbrokr-logo.webp";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function postSignInTarget(): string {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("redirect_url");
  if (
    requested &&
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    !/\/(sign-in|sign-up)(\/|$)/.test(requested)
  ) {
    return requested;
  }
  return `${basePath}/dashboard`;
}

const TRUST_POINTS = [
  { icon: Truck, label: "Verified carrier network" },
  { icon: MapPin, label: "Live GPS on every active haul" },
  { icon: ShieldCheck, label: "Compliance document gates" },
  { icon: Zap, label: "AI dispatch copilot included" },
];

function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2 bg-background">
      <a
        href="#auth-form"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground"
      >
        Skip to sign in form
      </a>
      <aside className="hidden lg:flex flex-col justify-between p-12 border-r border-border/60 bg-card/30">
        <div>
          <picture>
            <source type="image/webp" srcSet={logoWebp} />
            <img
              src={logo}
              alt="HaulBrokr"
              className="h-9 w-auto"
              width="400"
              height="225"
            />
          </picture>
          <h1 className="mt-12 text-4xl font-bold tracking-tight leading-tight max-w-md">
            The premium marketplace for moving material.
          </h1>
          <p className="mt-4 text-muted-foreground text-lg max-w-md leading-relaxed">
            Mission control for contractors, fleet owners, and drivers — one
            platform from bid to payout.
          </p>
        </div>
        <ul className="space-y-4">
          {TRUST_POINTS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-3 text-sm text-muted-foreground"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </aside>
      <div
        id="auth-form"
        className="flex flex-col items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-[440px]">
          <div className="mb-8 lg:hidden text-center">
            <picture>
              <source type="image/webp" srcSet={logoWebp} />
              <img
                src={logo}
                alt="HaulBrokr"
                className="h-8 w-auto mx-auto"
                width="400"
                height="225"
              />
            </picture>
          </div>
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="surface-panel rounded-2xl p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function SignInPage() {
  const target = postSignInTarget();
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your mission control dashboard."
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={target}
        signUpFallbackRedirectUrl={`${basePath}/onboarding`}
      />
    </AuthShell>
  );
}

export function SignUpPage() {
  return (
    <AuthShell
      title="Join the network"
      subtitle="Create your account — customer, vendor, or driver."
    >
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/onboarding`}
        signInFallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </AuthShell>
  );
}
