import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Truck, ClipboardList, Briefcase, LayoutDashboard,
  LogOut, Loader2, Settings, Menu, X, Trash2,
  FolderOpen, DollarSign, Plug, ShieldCheck, Building2
} from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
import { useGetMyProfile, useGetAdminAccess } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DocumentGateBanner } from "@/components/documents";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  show: boolean;
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link href={item.href} onClick={onClick} aria-current={active ? "page" : undefined}>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}>
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {item.label}
      </div>
    </Link>
  );
}

function Sidebar({ navItems, profile, user, onSignOut }: {
  navItems: NavItem[];
  profile: any;
  user: any;
  onSignOut: () => void;
}) {
  const [location] = useLocation();
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50">
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt="HaulBrokr"
          className="h-8 w-auto"
        />
      </div>

      <div className="p-4 border-b border-sidebar-border/50">
        <div className="text-sm font-medium text-sidebar-foreground truncate">{profile?.companyName || user?.fullName}</div>
        <div className="text-xs text-sidebar-foreground/60 uppercase tracking-wider mt-1">{profile?.role}</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.filter(i => i.show).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={location === item.href || location.startsWith(`${item.href}/`)}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border/50">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
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
  const { data: profile, isLoading } = useGetMyProfile();
  const { data: adminAccess } = useGetAdminAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30" role="status" aria-live="polite" aria-label="Loading navigation">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isCustomer = profile?.role === "customer";
  const isProvider = profile?.role === "provider";

  // HAULBROKR staff are identified by an @haulbrokr.com email address. Admin
  // surfaces are reserved for staff only, so we require BOTH the backend admin
  // grant AND a verified @haulbrokr.com email before exposing them. This makes
  // sure customers and vendors can never see admin tooling even if the backend
  // admin check is ever misconfigured.
  const STAFF_EMAIL_DOMAIN = "@haulbrokr.com";
  const isStaffEmail = (user?.emailAddresses ?? []).some(
    (e: any) => e?.emailAddress?.toLowerCase().endsWith(STAFF_EMAIL_DOMAIN)
  );
  const isStaff = !!adminAccess?.isAdmin && isStaffEmail;

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/requests", label: isCustomer ? "My Requests" : "Job Board", icon: ClipboardList, show: true },
    { href: "/fleet", label: "My Fleet", icon: Truck, show: isProvider },
    { href: "/jobs", label: "Active Jobs", icon: Briefcase, show: true },
    { href: "/projects", label: "Projects", icon: FolderOpen, show: isCustomer },
    { href: "/company", label: "Company", icon: Building2, show: isCustomer || isProvider },
    { href: "/factoring", label: "Get Paid Early", icon: DollarSign, show: isProvider },
    { href: "/bins", label: "Bin Rental", icon: Trash2, show: true },
    // Integrations and Admin are staff-only (HAULBROKR employees).
    { href: "/integrations", label: "Integrations", icon: Plug, show: isStaff },
    { href: "/admin", label: "Admin", icon: ShieldCheck, show: isStaff },
    { href: "/account", label: "Account", icon: Settings, show: true },
  ];

  const visibleNav = navItems.filter(i => i.show);

  const handleSignOut = () => signOut(() => { window.location.href = import.meta.env.BASE_URL; });

  return (
    <div className="flex min-h-screen bg-muted/30">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:border-2 focus:border-primary">
        Skip to main content
      </a>
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col">
        <Sidebar navItems={navItems} profile={profile} user={user} onSignOut={handleSignOut} />
      </aside>

      {/* Main Content */}
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden" tabIndex={-1}>
        {/* Mobile Header */}
        <header className="h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 md:hidden sticky top-0 z-40">
          <div className="flex items-center gap-2 text-sidebar-primary font-bold text-lg">
            <Truck className="h-5 w-5" />
            HaulBrokr
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r border-sidebar-border">
              <Sidebar
                navItems={navItems}
                profile={profile}
                user={user}
                onSignOut={() => { setMobileOpen(false); handleSignOut(); }}
              />
            </SheetContent>
          </Sheet>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8">
          <DocumentGateBanner />
          {children}
        </div>

        {/* Mobile Bottom Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar border-t border-sidebar-border">
          <div className="flex items-stretch h-16">
            {visibleNav.map((item) => {
              const active = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className="flex-1" aria-current={active ? "page" : undefined}>
                  <div className={cn(
                    "flex flex-col items-center justify-center h-full gap-1 text-[10px] font-semibold transition-colors",
                    active
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/50"
                  )}>
                    <item.icon className={cn("h-5 w-5", active && "text-sidebar-primary")} />
                    <span className="leading-none">{item.label.split(" ")[0]}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
}
