import { useCallback, useMemo, useState, useEffect } from "react";
import { useGetDashboardActivity } from "@workspace/api-client-react";

const LAST_READ_KEY = "haulbrokr:notifications:lastReadAt";

export type NotificationItem = {
  id: number;
  type: string;
  description: string;
  relatedId: number | null;
  relatedBinOrderId: string | null;
  createdAt: string;
  read: boolean;
  category: "dispatch" | "driver" | "loading" | "facility" | "scale" | "pod" | "compliance" | "invoice" | "payment" | "announcement" | "other";
};

function categorize(type: string): NotificationItem["category"] {
  if (type.startsWith("bin_")) return "facility";
  if (type.includes("bid") || type.includes("job_")) return "dispatch";
  if (type.includes("payment") || type.includes("payout")) return "payment";
  if (type.includes("application")) return "compliance";
  if (type.includes("delivery_evidence")) return "pod";
  return "other";
}

export function useNotifications(filter?: NotificationItem["category"] | "all") {
  const { data, isLoading, isFetching, refetch, error } = useGetDashboardActivity();
  const [lastReadAt, setLastReadAt] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(LAST_READ_KEY);
    if (stored) setLastReadAt(Number(stored) || 0);
  }, []);

  const items: NotificationItem[] = useMemo(() => {
    return (data ?? []).map((a) => {
      const created = new Date(a.createdAt).getTime();
      return {
        id: a.id,
        type: a.type,
        description: a.description,
        relatedId: a.relatedId ?? null,
        relatedBinOrderId: a.relatedBinOrderId ?? null,
        createdAt: typeof a.createdAt === "string" ? a.createdAt : new Date(a.createdAt).toISOString(),
        read: created <= lastReadAt,
        category: categorize(a.type),
      };
    });
  }, [data, lastReadAt]);

  const filtered = useMemo(() => {
    if (!filter || filter === "all") return items;
    return items.filter((n) => n.category === filter);
  }, [items, filter]);

  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setLastReadAt(now);
    localStorage.setItem(LAST_READ_KEY, String(now));
  }, []);

  const markRead = useCallback((createdAt: string) => {
    const ts = new Date(createdAt).getTime();
    if (ts > lastReadAt) {
      setLastReadAt(ts);
      localStorage.setItem(LAST_READ_KEY, String(ts));
    }
  }, [lastReadAt]);

  return {
    items: filtered,
    allItems: items,
    unreadCount,
    isLoading,
    isFetching,
    error,
    refetch,
    markAllRead,
    markRead,
  };
}
