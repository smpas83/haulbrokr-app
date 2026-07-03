import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Truck, ClipboardList, Briefcase, LayoutDashboard,
  LogOut, Loader2, Settings, Menu, Trash2,
  FolderOpen, DollarSign, Plug, ShieldCheck, Building2, MapPin,
  Sparkles, Radio
} from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
import { useGetMyProfile, useGetAdminAccess } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DocumentGateBanner } from "@/components/documents";
import { CopilotPanel } from "@/components/copilot-panel";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  show: boolean;
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  return (
    <Link href={item.href} onClick={onClick}>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 cursor-pointer",
        active
          ? "bg-primary/15 text-primary border border-primary/20"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-transparent"
      )}>
        <item.icon className={cn("h-4 w-4 flex-shrink-0", active && "text-primary")} />
        {item.label}
        {active && (
          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </div>
    </Link>
  );
}

function Sidebar({ navItems, profile, user, onSignOut, onCopilotOpen }: {
  navItems: NavItem[];
  profile: any;
  user: any;
  onSignOut: () => void;
  onCopilotOpen: () => void;
}) {
  const [location] = useLocation();
  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border/50">
        <img
          src={`${import.meta.env.BASE_URL}haulbrokr-logo.png`}
          alt="HaulBrokr"
          className="h-7 w-auto"
        />
      </div>

      <div className="px-4 py-4 border-b border-sidebar-border/50">
        <div className="glass-panel rounded-xl p-3">
          <div className="text-sm font-semibold text-sidebar-foreground truncate">
            {profile?.companyName || user?.fullName}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Radio className="h-3 w-3" />
              {profile?.role}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Mission Control
        </p>
        {navItems.filter(i => i.show).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={location === item.href || location.startsWith(`${item.href}/`)}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border/50 space-y-2">
        <div className="glass-panel rounded-xl p-3 flex items-center gap-2 cursor-pointer hover:border-primary/30 transition-colors" onClick={onCopilotOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onCopilotOpen()}>
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">AI Copilot</p>
            <p className="text-[10px] text-emerald-400">Online</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg"
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
  const [copilotOpen, setCopilotOpen] = useState(false);
  const { data: profile, isLoading } = useGetMyProfile();
  const { data: adminAccess } = useGetAdminAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading mission control...</p>
        </div>
      </div>
    );
  }

  const isCustomer = profile?.role === "customer";
  const isProvider = profile?.role === "provider";

  const STAFF_EMAIL_DOMAIN = "@haulbrokr.com";
  const isStaffEmail = (user?.emailAddresses ?? []).some(
    (e: any) => e?.emailAddress?.toLowerCase().endsWith(STAFF_EMAIL_DOMAIN)
  );
  const isStaff = !!adminAccess?.isAdmin && isStaffEmail;

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { href: "/requests", label: isCustomer ? "My Requests" : "Load Board", icon: ClipboardList, show: true },
    { href: "/fleet", label: "My Fleet", icon: Truck, show: isProvider },
    { href: "/dispatch", label: "Digital Twin", icon: Radio, show: true },
    { href: "/jobs", label: "Active Jobs", icon: Briefcase, show: true },
    { href: "/map", label: "Live Map", icon: MapPin, show: true },
    { href: "/projects", label: "Projects", icon: FolderOpen, show: isCustomer },
    { href: "/company", label: "Company", icon: Building2, show: isCustomer || isProvider },
    { href: "/factoring", label: "Get Paid Early", icon: DollarSign, show: isProvider },
    { href: "/bins", label: "Bin Rental", icon: Trash2, show: true },
    { href: "/integrations", label: "Integrations", icon: Plug, show: isStaff },
    { href: "/admin", label: "Admin", icon: ShieldCheck, show: isStaff },
    { href: "/account", label: "Account", icon: Settings, show: true },
  ];

  const visibleNav = navItems.filter(i => i.show);

  const handleSignOut = () => signOut(() => { window.location.href = import.meta.env.BASE_URL; });

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col shrink-0">
        <Sidebar navItems={navItems} profile={profile} user={user} onSignOut={handleSignOut} onCopilotOpen={() => setCopilotOpen(true)} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile Header */}
        <header className="h-14 bg-sidebar/80 backdrop-blur-xl border-b border-sidebar-border flex items-center justify-between px-4 md:hidden sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}haulbrokr-logo.png`}
              alt="HaulBrokr"
              className="h-6 w-auto"
            />
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-r border-sidebar-border">
              <Sidebar
                navItems={navItems}
                profile={profile}
                user={user}
                onSignOut={() => { setMobileOpen(false); handleSignOut(); }}
                onCopilotOpen={() => { setMobileOpen(false); setCopilotOpen(true); }}
              />
            </SheetContent>
          </Sheet>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 pb-24 md:pb-8 page-enter">
          <DocumentGateBanner />
          {children}
        </div>

        {/* Mobile Bottom Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar/90 backdrop-blur-xl border-t border-sidebar-border safe-area-bottom">
          <div className="flex items-stretch h-16">
            {visibleNav.slice(0, 5).map((item) => {
              const active = location === item.href || location.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <div className={cn(
                    "flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-semibold transition-colors",
                    active
                      ? "text-primary"
                      : "text-sidebar-foreground/50"
                  )}>
                    <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                    <span className="leading-none truncate max-w-[60px]">{item.label.split(" ")[0]}</span>
                    {active && <div className="absolute bottom-1 h-0.5 w-6 rounded-full bg-primary" />}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </main>
      <CopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
