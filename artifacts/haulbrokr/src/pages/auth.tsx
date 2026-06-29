import { SignIn, SignUp } from "@clerk/react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Decide where to send a regular user after sign-in:
// the page they were trying to reach (?redirect_url=...), otherwise /dashboard.
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

export function SignInPage() {
  const target = postSignInTarget();
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-[440px]">
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
          fallbackRedirectUrl={target}
          signUpFallbackRedirectUrl={`${basePath}/onboarding`}
        />
      </div>
    </div>
  );
}

export function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-secondary px-4 py-12">
      <div className="w-full max-w-[440px]">
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
          fallbackRedirectUrl={`${basePath}/onboarding`}
          signInFallbackRedirectUrl={`${basePath}/dashboard`}
        />
      </div>
    </div>
  );
}
