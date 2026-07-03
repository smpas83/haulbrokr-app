import { memo, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Bell, ChevronLeft, ChevronRight, Cloud, Plus, Radio, Search,
  Truck, User,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DispatcherTopBarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  systemOnline?: boolean;
}

export const DispatcherTopBar = memo(function DispatcherTopBar({
  sidebarCollapsed,
  onToggleSidebar,
  systemOnline = true,
}: DispatcherTopBarProps) {
  const { user } = useUser();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const initials = (user?.fullName ?? "HB")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className="h-[72px] flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-sm flex items-center gap-3 px-4 md:px-6"
      role="banner"
    >
      <Button
        variant="ghost"
        size="icon"
        className="rounded-none flex-shrink-0"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!sidebarCollapsed}
      >
        {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <Link href="/dispatcher" className="flex-shrink-0">
        <img
          src={`${import.meta.env.BASE_URL}haulbrokr-logo.png`}
          alt="HaulBrokr"
          className="h-8 w-auto hidden sm:block"
        />
      </Link>

      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Global search jobs, drivers, trucks…"
            className="pl-9 rounded-none border-2 h-10"
            aria-label="Global search"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        <Button variant="ghost" size="icon" className="rounded-none relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" aria-hidden="true" />
        </Button>

        <Badge
          variant="outline"
          className={cn(
            "rounded-none border-2 hidden lg:flex gap-1.5",
            systemOnline ? "border-green-600/40 text-green-600" : "border-destructive/40 text-destructive"
          )}
        >
          <Radio className="h-3 w-3" aria-hidden="true" />
          {systemOnline ? "Live" : "Degraded"}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-none" aria-label="Quick actions">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-none border-2">
            <DropdownMenuItem asChild>
              <Link href="/requests">Browse Job Board</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/fleet/new">Add Truck</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/jobs">View Active Jobs</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <time className="text-xs font-mono text-muted-foreground hidden xl:block tabular-nums" dateTime={now.toISOString()}>
          {format(now, "EEE, MMM d · h:mm a")}
        </time>

        <Badge variant="outline" className="rounded-none border-2 hidden xl:flex gap-1 text-muted-foreground">
          <Cloud className="h-3 w-3" aria-hidden="true" />
          {/* PLACEHOLDER: ChatGPT visual package — live weather widget */}
          Weather —
        </Badge>

        <Avatar className="h-9 w-9 rounded-none border-2 border-border">
          <AvatarFallback className="rounded-none bg-primary/10 text-primary font-bold text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
});
