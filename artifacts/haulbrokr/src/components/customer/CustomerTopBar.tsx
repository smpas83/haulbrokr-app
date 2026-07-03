import { memo, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Bell, Building2, ChevronDown, Cloud, Search, User,
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

interface CustomerTopBarProps {
  companyName?: string;
  unreadCount?: number;
  hasMultipleAccounts?: boolean;
}

export const CustomerTopBar = memo(function CustomerTopBar({
  companyName,
  unreadCount = 0,
  hasMultipleAccounts = false,
}: CustomerTopBarProps) {
  const { user } = useUser();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const initials = (user?.fullName ?? companyName ?? "HB")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header
      className="h-[72px] flex-shrink-0 border-2 border-border bg-card/80 backdrop-blur-sm flex items-center gap-3 px-4 md:px-6 -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-4 md:mb-6"
      role="banner"
    >
      <div className="flex items-center gap-2 min-w-0 flex-shrink">
        <Building2 className="h-5 w-5 text-primary flex-shrink-0" aria-hidden="true" />
        <span className="font-black text-sm md:text-base truncate">{companyName ?? "Your Company"}</span>
      </div>

      {hasMultipleAccounts && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="rounded-none border-2 hidden sm:flex gap-1">
              Account
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-none border-2">
            <DropdownMenuItem>{companyName}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search jobs, documents, invoices…"
            className="pl-9 rounded-none border-2 h-10"
            aria-label="Search operations"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-none relative"
          aria-label={unreadCount > 0 ? `${unreadCount} notifications` : "Notifications"}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-none text-[10px] bg-primary text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>

        <time
          className="text-xs font-mono text-muted-foreground hidden lg:block tabular-nums"
          dateTime={now.toISOString()}
        >
          {format(now, "EEE, MMM d · h:mm a")}
        </time>

        <Badge variant="outline" className="rounded-none border-2 hidden xl:flex gap-1 text-muted-foreground">
          <Cloud className="h-3 w-3" aria-hidden="true" />
          {/* PLACEHOLDER: ChatGPT visual package — live weather widget */}
          Weather —
        </Badge>

        <Link href="/account">
          <Avatar className="h-9 w-9 rounded-none border-2 border-border cursor-pointer">
            <AvatarFallback className="rounded-none bg-primary/10 text-primary font-bold text-xs">
              {initials || <User className="h-4 w-4" aria-hidden="true" />}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
});
