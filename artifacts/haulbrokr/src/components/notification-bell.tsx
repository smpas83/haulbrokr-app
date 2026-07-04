import { Link } from "wouter";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { unreadCount } = useNotifications();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative shrink-0", className)}
      asChild
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
    >
      <Link href="/notifications">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
