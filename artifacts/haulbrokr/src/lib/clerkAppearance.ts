import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${typeof window !== "undefined" ? window.location.origin : ""}${basePath}/logo.png`,
  },
  variables: {
    colorPrimary: "hsl(217 91% 60%)",
    colorForeground: "hsl(0 0% 96%)",
    colorMutedForeground: "hsl(240 4% 55%)",
    colorDanger: "hsl(0 72% 51%)",
    colorBackground: "hsl(240 6% 4%)",
    colorInput: "hsl(240 4% 12%)",
    colorInputForeground: "hsl(0 0% 96%)",
    colorNeutral: "hsl(240 4% 16%)",
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-card border border-border/60 shadow-2xl shadow-black/40 rounded-xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-2xl font-bold tracking-tight text-foreground",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "font-semibold",
    formFieldLabel: "font-semibold text-foreground",
    footerActionLink: "text-primary font-semibold hover:underline",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground font-mono text-xs uppercase tracking-wider",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-destructive",
    logoBox: "mb-6 flex justify-center",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton:
      "rounded-lg border border-border hover:bg-muted font-semibold h-11",
    formButtonPrimary:
      "rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11 shadow-sm",
    formFieldInput:
      "rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary h-11 bg-muted/30",
    footerAction: "mt-6 border-t border-border pt-6",
    dividerLine: "bg-border",
    alert: "rounded-xl border border-destructive/50 bg-destructive/10 text-destructive",
    otpCodeFieldInput:
      "rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary",
    formFieldRow: "mb-4",
    main: "p-8",
  },
};

export const clerkBasePath = basePath;
export const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
