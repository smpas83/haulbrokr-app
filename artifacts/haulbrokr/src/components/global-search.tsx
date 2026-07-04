import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Briefcase, ClipboardList, Truck, Users, FolderOpen, Trash2,
  Settings, HelpCircle, MapPin, Building2, DollarSign, Search,
  ShieldCheck, Radio, Plug,
} from "lucide-react";
import {
  useListRequests, useListJobs, useListTrucks, useListProjects,
  useListBinOrders, useListOrgMembers, useGetMyProfile,
} from "@workspace/api-client-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchResult = {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  group: string;
  icon: React.ElementType;
  placeholder?: boolean;
};

interface GlobalSearchProps {
  className?: string;
  variant?: "button" | "inline";
}

export function GlobalSearch({ className, variant = "button" }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: profile } = useGetMyProfile();
  const { data: requests } = useListRequests();
  const { data: jobs } = useListJobs();
  const { data: trucks } = useListTrucks();
  const { data: projects } = useListProjects();
  const { data: binOrders } = useListBinOrders();
  const { data: members } = useListOrgMembers();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const navItems: SearchResult[] = useMemo(() => [
    { id: "nav-dashboard", label: "Dashboard", href: "/dashboard", group: "Navigation", icon: Radio },
    { id: "nav-requests", label: profile?.role === "customer" ? "My Requests" : "Load Board", href: "/requests", group: "Navigation", icon: ClipboardList },
    { id: "nav-jobs", label: "Active Jobs", href: "/jobs", group: "Navigation", icon: Briefcase },
    { id: "nav-map", label: "Live Map", href: "/map", group: "Navigation", icon: MapPin },
    { id: "nav-dispatch", label: "Digital Twin", href: "/dispatch", group: "Navigation", icon: Radio },
    { id: "nav-fleet", label: "My Fleet", href: "/fleet", group: "Navigation", icon: Truck },
    { id: "nav-projects", label: "Projects", href: "/projects", group: "Navigation", icon: FolderOpen },
    { id: "nav-bins", label: "Bin Rental", href: "/bins", group: "Navigation", icon: Trash2 },
    { id: "nav-company", label: "Company", href: "/company", group: "Navigation", icon: Building2 },
    { id: "nav-factoring", label: "Get Paid Early", href: "/factoring", group: "Navigation", icon: DollarSign },
    { id: "nav-integrations", label: "Integrations", href: "/integrations", group: "Navigation", icon: Plug },
    { id: "nav-admin", label: "Admin Command Center", href: "/admin", group: "Navigation", icon: ShieldCheck },
    { id: "nav-account", label: "Account Settings", href: "/account", group: "Settings", icon: Settings },
    { id: "nav-notifications", label: "Notifications", href: "/notifications", group: "Settings", icon: Settings },
    { id: "nav-support", label: "Support", href: "/support", group: "Support", icon: HelpCircle },
    { id: "nav-privacy", label: "Privacy Policy", href: "/privacy", group: "Support", icon: HelpCircle },
  ], [profile?.role]);

  const dynamicResults: SearchResult[] = useMemo(() => {
    const results: SearchResult[] = [];

    (requests ?? []).slice(0, 20).forEach((r) => {
      results.push({
        id: `req-${r.id}`,
        label: `Request #${r.id}`,
        sublabel: `${r.materialType} · ${r.pickupAddress ?? "No address"}`,
        href: `/requests/${r.id}`,
        group: "Requests",
        icon: ClipboardList,
      });
    });

    (jobs ?? []).slice(0, 20).forEach((j) => {
      results.push({
        id: `job-${j.id}`,
        label: `Job #${j.id}`,
        sublabel: `${j.materialType} · ${j.status.replace("_", " ")}`,
        href: `/jobs/${j.id}`,
        group: "Jobs",
        icon: Briefcase,
      });
    });

    (trucks ?? []).slice(0, 20).forEach((t) => {
      results.push({
        id: `truck-${t.id}`,
        label: t.truckNumber ? `Truck #${t.truckNumber}` : `${t.truckType} truck`,
        sublabel: `${t.capacityTons} tons · $${t.ratePerHour}/hr`,
        href: `/fleet/${t.id}/edit`,
        group: "Fleet",
        icon: Truck,
      });
    });

    (projects ?? []).slice(0, 20).forEach((p) => {
      const project = p as { id: number; name: string; siteAddress?: string | null; status?: string };
      results.push({
        id: `proj-${project.id}`,
        label: project.name,
        sublabel: project.siteAddress ?? project.status,
        href: `/projects/${project.id}`,
        group: "Projects",
        icon: FolderOpen,
      });
    });

    (binOrders ?? []).slice(0, 15).forEach((b) => {
      const order = b as { id: string; binSizeLabel?: string; status: string };
      results.push({
        id: `bin-${order.id}`,
        label: `Bin order ${order.binSizeLabel ?? order.id.slice(0, 8)}`,
        sublabel: order.status.replace("_", " "),
        href: `/bins?order=${encodeURIComponent(order.id)}`,
        group: "Facilities",
        icon: Trash2,
      });
    });

    (members?.members ?? [])
      .filter((m) => m.role === "driver")
      .slice(0, 15)
      .forEach((m) => {
        results.push({
          id: `driver-${m.id}`,
          label: m.contactName ?? m.email ?? `Driver #${m.id}`,
          sublabel: m.role,
          href: "/company",
          group: "Drivers",
          icon: Users,
        });
      });

    if (profile?.companyName) {
      results.push({
        id: "customer-org",
        label: profile.companyName,
        sublabel: "Your organization",
        href: "/company",
        group: "Customers",
        icon: Building2,
      });
    }

    // PLACEHOLDER: Invoices — requires GET /invoices API (not yet in OpenAPI spec)
    results.push({
      id: "placeholder-invoices",
      label: "Invoices",
      sublabel: "PLACEHOLDER — invoice search API not available",
      href: "/factoring",
      group: "Invoices",
      icon: DollarSign,
      placeholder: true,
    });

    return results;
  }, [requests, jobs, trucks, projects, binOrders, members, profile]);

  const allResults = [...navItems, ...dynamicResults];

  const handleSelect = (href: string) => {
    setOpen(false);
    setLocation(href);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const item of allResults) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, [allResults]);

  return (
    <>
      {variant === "button" ? (
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "relative h-9 justify-start gap-2 text-muted-foreground font-normal w-full max-w-xs",
            className,
          )}
          onClick={() => setOpen(true)}
          aria-label="Open global search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline-flex flex-1 text-left truncate">Search...</span>
          <CommandShortcut className="hidden sm:inline-flex">⌘K</CommandShortcut>
        </Button>
      ) : (
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground w-full",
            className,
          )}
          onClick={() => setOpen(true)}
          aria-label="Open global search"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search jobs, fleet, settings...</span>
          <kbd className="hidden sm:inline text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search jobs, requests, fleet, settings..." aria-label="Search" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Array.from(grouped.entries()).map(([group, items], idx) => (
            <div key={group}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.sublabel ?? ""} ${group}`}
                    onSelect={() => handleSelect(item.href)}
                    className={cn(item.placeholder && "opacity-60")}
                  >
                    <item.icon className="h-4 w-4" />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground truncate">{item.sublabel}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
