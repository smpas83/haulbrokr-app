import { useState } from "react";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import {
  Bell, RefreshCw, Loader2, Briefcase, Trash2, ShieldAlert,
  DollarSign, Megaphone, Truck,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useNotifications, type NotificationItem } from "@/hooks/use-notifications";

const FILTER_OPTIONS: { value: NotificationItem["category"] | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "dispatch", label: "Dispatch" },
  { value: "driver", label: "Driver" },
  { value: "facility", label: "Facility" },
  { value: "payment", label: "Payments" },
  { value: "compliance", label: "Compliance" },
  { value: "other", label: "Other" },
];

const CATEGORY_ICON: Record<NotificationItem["category"], React.ElementType> = {
  dispatch: Briefcase,
  driver: Truck,
  loading: Truck,
  facility: Trash2,
  scale: Briefcase,
  pod: Briefcase,
  compliance: ShieldAlert,
  invoice: DollarSign,
  payment: DollarSign,
  announcement: Megaphone,
  other: Bell,
};

function getNotificationHref(item: NotificationItem): string | null {
  if (item.relatedBinOrderId) return `/bins?order=${encodeURIComponent(item.relatedBinOrderId)}`;
  if (item.relatedId) {
    if (item.type.startsWith("bin_")) return `/bins?order=${encodeURIComponent(String(item.relatedId))}`;
    if (item.type.includes("bid") || item.type.includes("request")) return `/requests/${item.relatedId}`;
    return `/jobs/${item.relatedId}`;
  }
  return null;
}

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationItem;
  onRead: (createdAt: string) => void;
}) {
  const [, setLocation] = useLocation();
  const Icon = CATEGORY_ICON[item.category];
  const href = getNotificationHref(item);

  const handleClick = () => {
    onRead(item.createdAt);
    if (href) setLocation(href);
  };

  const content = (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-xl border transition-colors",
        item.read
          ? "border-border/40 bg-card/30"
          : "border-primary/20 bg-primary/5",
      )}
    >
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        item.read ? "bg-muted/50" : "bg-primary/15",
      )}>
        <Icon className={cn("h-4 w-4", item.read ? "text-muted-foreground" : "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-snug", !item.read && "font-semibold")}>{item.description}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {format(parseISO(item.createdAt), "MMM d, yyyy · h:mm a")}
        </p>
      </div>
      {!item.read && (
        <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" aria-label="Unread" />
      )}
    </div>
  );

  if (href) {
    return (
      <button type="button" className="w-full text-left" onClick={handleClick}>
        {content}
      </button>
    );
  }

  return (
    <div role="listitem" onClick={() => onRead(item.createdAt)}>
      {content}
    </div>
  );
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<NotificationItem["category"] | "all">("all");
  const { items, unreadCount, isLoading, isFetching, refetch, markAllRead, markRead } = useNotifications(filter);

  const grouped = [
    { label: "Unread", items: items.filter((n) => !n.read) },
    { label: "Earlier", items: items.filter((n) => n.read) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto page-enter">
      <PageHeader
        eyebrow="Alerts"
        title="Notifications"
        description="Dispatch updates, compliance alerts, payments, and announcements."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Refresh</span>
            </Button>
          )
        }
        toolbar={
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
              {FILTER_OPTIONS.map((opt) => (
                <TabsTrigger
                  key={opt.value}
                  value={opt.value}
                  className="rounded-lg border border-transparent data-[state=active]:border-primary/30 data-[state=active]:bg-primary/10 text-xs"
                >
                  {opt.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
        badge={
          unreadCount > 0 ? (
            <Badge variant="secondary" className="mb-1">{unreadCount} unread</Badge>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading notifications" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="When dispatch events, payments, or compliance updates occur, they'll appear here."
          action={{ label: "Go to Dashboard", href: "/dashboard" }}
        />
      ) : (
        <div className="space-y-6" role="list" aria-label="Notification history">
          {grouped.map((group) => (
            <section key={group.label}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <NotificationRow key={item.id} item={item} onRead={markRead} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pb-4">
        PLACEHOLDER: Push notifications on web require service worker + POST /notifications/register integration.
      </p>
    </div>
  );
}
