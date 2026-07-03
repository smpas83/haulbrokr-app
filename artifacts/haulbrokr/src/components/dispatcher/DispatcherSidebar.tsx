import { memo } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Radio, Users, Truck, Building2, MapPin, FolderOpen,
  FileText, BarChart3, ShieldCheck, Settings, Pin, Search, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dispatcher", label: "Live Dispatch", icon: Radio },
  { href: "/company", label: "Drivers", icon: Users },
  { href: "/fleet", label: "Fleet", icon: Truck },
  { href: "/jobs", label: "Customers", icon: Building2 },
  { href: "/requests", label: "Facilities", icon: MapPin },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/factoring", label: "Invoices", icon: FileText },
  { href: "/dashboard", label: "Analytics", icon: BarChart3 },
  { href: "/account", label: "Compliance", icon: ShieldCheck },
  { href: "/account", label: "Settings", icon: Settings },
];

interface DispatcherSidebarProps {
  collapsed: boolean;
  onlineDrivers: number;
  liveTrucks: number;
}

function SidebarLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  return (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          collapsed && "justify-center px-0"
        )}
        title={collapsed ? item.label : undefined}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {!collapsed && <span>{item.label}</span>}
      </div>
    </Link>
  );
}

export const DispatcherSidebar = memo(function DispatcherSidebar({
  collapsed,
  onlineDrivers,
  liveTrucks,
}: DispatcherSidebarProps) {
  const [location] = useLocation();

  return (
    <aside
      className={cn(
        "flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "w-[72px]" : "w-[280px]"
      )}
      aria-label="Dispatcher navigation"
    >
      <ScrollArea className="flex-1">
        <nav className="px-2 py-4 space-y-1">
          {MAIN_NAV.map((item) => (
            <SidebarLink
              key={`${item.href}-${item.label}`}
              item={item}
              collapsed={collapsed}
              active={location === item.href || location.startsWith(`${item.href}/`)}
            />
          ))}

          <Separator className="my-4 bg-sidebar-border" />

          {!collapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-2">
              Pinned Jobs
            </p>
          )}
          <div className={cn("px-3 py-2 text-xs text-sidebar-foreground/50", collapsed && "text-center px-0")}>
            {!collapsed ? (
              <span className="flex items-center gap-2">
                <Pin className="h-3 w-3" aria-hidden="true" />
                {/* PLACEHOLDER: pinned jobs API */}
                No pinned jobs
              </span>
            ) : (
              <Pin className="h-4 w-4 mx-auto opacity-50" aria-label="Pinned jobs" />
            )}
          </div>

          {!collapsed && (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-2 mt-4">
              Recent Searches
            </p>
          )}
          <div className={cn("px-3 py-2 text-xs text-sidebar-foreground/50", collapsed && "text-center px-0")}>
            {!collapsed ? (
              <span className="flex items-center gap-2">
                <Search className="h-3 w-3" aria-hidden="true" />
                {/* PLACEHOLDER: recent searches storage */}
                No recent searches
              </span>
            ) : (
              <Search className="h-4 w-4 mx-auto opacity-50" aria-label="Recent searches" />
            )}
          </div>
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className={cn("flex items-center gap-2 text-xs", collapsed && "justify-center")}>
          <Activity className="h-3 w-3 text-green-500" aria-hidden="true" />
          {!collapsed && (
            <span className="text-sidebar-foreground/70">
              System <span className="font-bold text-green-500">Online</span>
            </span>
          )}
        </div>
        {!collapsed && (
          <>
            <p className="text-xs text-sidebar-foreground/60">
              Online Drivers: <span className="font-bold text-sidebar-foreground">{onlineDrivers}</span>
            </p>
            <p className="text-xs text-sidebar-foreground/60">
              Live Trucks: <span className="font-bold text-sidebar-foreground">{liveTrucks}</span>
            </p>
          </>
        )}
      </div>
    </aside>
  );
});
