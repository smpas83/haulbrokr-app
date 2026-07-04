import { ReactNode, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Truck,
  ClipboardList,
  Briefcase,
  LayoutDashboard,
  LogOut,
  Loader2,
  Settings,
  Menu,
  Trash2,
  FolderOpen,
  DollarSign,
  Plug,
  ShieldCheck,
  Building2,
  MapPin,
  Sparkles,
  Radio,
} from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
import {
  useGetMyProfile,
  useGetAdminAccess,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DocumentGateBanner } from "@/components/documents";
import { CopilotPanel } from "@/components/copilot-panel";
import {
  getRoleLabel,
  MOBILE_NAV_PRIORITY,
  MOBILE_NAV_SHORT,
} from "@/lib/role-labels";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  show: boolean;
  section: "operations" | "business" | "account";
}

const NAV_SECTIONS = [
  { id: "operations" as const, label: "Operations" },
  { id: "business" as const, label: "Business" },
  { id: "account" as const, label: "Account" },
];

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 cursor-pointer",
          active
            ? "bg-primary/15 text-primary border border-primary/20"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-transparent",
        )}
      >
        <item.icon
          className={cn("h-4 w-4 flex-shrink-0", active && "text-primary")}
          aria-hidden="true"
        />
        {item.label}
        {active && (
          <div
            className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
            aria-hidden="true"
          />
        )}
      </div>
    </Link>
  );
}

function Sidebar({
  navItems,
  profile,
  user,
  onSignOut,
  onCopilotOpen,
  onNavigate,
}: {
  navItems: NavItem[];
  profile: any;
  user: any;
  onSignOut: () => void;
  onCopilotOpen: () => void;
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const visibleItems = navItems.filter((i) => i.show);

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border/50">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          aria-label="HaulBrokr home"
        >
          <img
            src={`${import.meta.env.BASE_URL}haulbrokr-logo.png`}
            alt="HaulBrokr"
            className="h-7 w-auto"
            width={120}
            height={28}
          />
        </Link>
      </div>

      <div className="px-4 py-4 border-b border-sidebar-border/50">
        <div className="surface-panel rounded-xl p-3">
          <div className="text-sm font-semibold text-sidebar-foreground truncate">
            {profile?.companyName || user?.fullName}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Radio className="h-3 w-3" aria-hidden="true" />
              {getRoleLabel(profile?.role)}
            </span>
          </div>
        </div>
      </div>

      <nav
        className="flex-1 px-3 py-4 space-y-4 overflow-y-auto"
        aria-label="Main navigation"
      >
        {NAV_SECTIONS.map((section) => {
          const sectionItems = visibleItems.filter(
            (i) => i.section === section.id,
          );
          if (sectionItems.length === 0) return null;
          return (
            <div key={section.id}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
              <div className="space-y-1">
                {sectionItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={
                      location === item.href ||
                      location.startsWith(`${item.href}/`)
                    }
                    onClick={onNavigate}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border/50 space-y-2">
        <div
          className="surface-panel rounded-xl p-3 flex items-center gap-2 cursor-pointer hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onCopilotOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onCopilotOpen()}
          aria-label="Open AI Copilot assistant"
        >
          <Sparkles
            className="h-4 w-4 text-primary shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              AI Copilot
            </p>
            <p className="text-[10px] text-emerald-400">Online</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg"
          onClick={onSignOut}
          aria-label="Log out of HaulBrokr"
        >
          <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
          Log out
        </Button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const { data: profile, isLoading } = useGetMyProfile();
  const { data: adminAccess } = useGetAdminAccess();

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen bg-background"
        role="status"
        aria-label="Loading"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2
            className="h-8 w-8 animate-spin text-primary"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            Loading mission control...
          </p>
        </div>
      </div>
    );
  }

  const isCustomer = profile?.role === "customer";
  const isProvider = profile?.role === "provider";

  const STAFF_EMAIL_DOMAIN = "@haulbrokr.com";
  const isStaffEmail = (user?.emailAddresses ?? []).some((e: any) =>
    e?.emailAddress?.toLowerCase().endsWith(STAFF_EMAIL_DOMAIN),
  );
  const isStaff = !!adminAccess?.isAdmin && isStaffEmail;

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      show: true,
      section: "operations",
    },
    {
      href: "/requests",
      label: isCustomer ? "My Requests" : "Load Board",
      icon: ClipboardList,
      show: true,
      section: "operations",
    },
    {
      href: "/jobs",
      label: "Active Jobs",
      icon: Briefcase,
      show: true,
      section: "operations",
    },
    {
      href: "/dispatch",
      label: "Digital Twin",
      icon: Radio,
      show: true,
      section: "operations",
    },
    {
      href: "/map",
      label: "Live Map",
      icon: MapPin,
      show: true,
      section: "operations",
    },
    {
      href: "/fleet",
      label: "My Fleet",
      icon: Truck,
      show: isProvider,
      section: "business",
    },
    {
      href: "/projects",
      label: "Projects",
      icon: FolderOpen,
      show: isCustomer,
      section: "business",
    },
    {
      href: "/company",
      label: "Company",
      icon: Building2,
      show: isCustomer || isProvider,
      section: "business",
    },
    {
      href: "/factoring",
      label: "Get Paid Early",
      icon: DollarSign,
      show: isProvider,
      section: "business",
    },
    {
      href: "/bins",
      label: "Bin Rental",
      icon: Trash2,
      show: true,
      section: "business",
    },
    {
      href: "/integrations",
      label: "Integrations",
      icon: Plug,
      show: isStaff,
      section: "account",
    },
    {
      href: "/admin",
      label: "Admin",
      icon: ShieldCheck,
      show: isStaff,
      section: "account",
    },
    {
      href: "/account",
      label: "Account",
      icon: Settings,
      show: true,
      section: "account",
    },
  ];

  const mobileNavItems = useMemo(() => {
    const priority =
      MOBILE_NAV_PRIORITY[profile?.role ?? "default"] ??
      MOBILE_NAV_PRIORITY.default;
    const visible = navItems.filter((i) => i.show);
    const prioritized = priority
      .map((href) => visible.find((i) => i.href === href))
      .filter((i): i is NavItem => i != null);
    if (prioritized.length >= 5) return prioritized.slice(0, 5);
    const remaining = visible.filter(
      (i) => !prioritized.some((p) => p.href === i.href),
    );
    return [...prioritized, ...remaining].slice(0, 5);
  }, [profile?.role, isCustomer, isProvider, isStaff]);

  const handleSignOut = () =>
    signOut(() => {
      window.location.href = import.meta.env.BASE_URL;
    });

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      {/* Desktop Sidebar */}
      <aside
        className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col shrink-0"
        aria-label="Sidebar"
      >
        <Sidebar
          navItems={navItems}
          profile={profile}
          user={user}
          onSignOut={handleSignOut}
          onCopilotOpen={() => setCopilotOpen(true)}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile Header */}
        <header className="h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 md:hidden sticky top-0 z-40">
          <Link href="/dashboard" aria-label="HaulBrokr home">
            <img
              src={`${import.meta.env.BASE_URL}haulbrokr-logo.png`}
              alt="HaulBrokr"
              className="h-6 w-auto"
              width={100}
              height={24}
            />
          </Link>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="p-0 w-72 bg-sidebar border-r border-sidebar-border"
            >
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <Sidebar
                navItems={navItems}
                profile={profile}
                user={user}
                onSignOut={() => {
                  setMobileOpen(false);
                  handleSignOut();
                }}
                onCopilotOpen={() => {
                  setMobileOpen(false);
                  setCopilotOpen(true);
                }}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </header>

        <main
          id="main-content"
          className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8 page-enter"
        >
          <DocumentGateBanner />
          {children}
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border safe-area-bottom"
          aria-label="Quick navigation"
        >
          <div className="flex items-stretch h-16">
            {mobileNavItems.map((item) => {
              const active =
                location === item.href || location.startsWith(`${item.href}/`);
              const shortLabel =
                MOBILE_NAV_SHORT[item.href] ?? item.label.split(" ")[0];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex-1 relative"
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                >
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-semibold transition-colors",
                      active ? "text-primary" : "text-sidebar-foreground/50",
                    )}
                  >
                    <item.icon
                      className={cn("h-5 w-5", active && "text-primary")}
                      aria-hidden="true"
                    />
                    <span className="leading-none truncate max-w-[64px]">
                      {shortLabel}
                    </span>
                    {active && (
                      <div
                        className="absolute bottom-1 h-0.5 w-6 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      <CopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
