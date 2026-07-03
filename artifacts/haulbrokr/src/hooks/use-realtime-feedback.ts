import { useEffect, useMemo, useRef } from "react";

import { toast } from "@/hooks/use-toast";

export const LIVE_REFETCH_INTERVAL_MS = 15000;

export const liveQueryOptions = {
  refetchInterval: LIVE_REFETCH_INTERVAL_MS,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  staleTime: 5000,
} as const;

type ActivityLike = {
  id: string | number;
  type: string;
  description?: string | null;
};

export function getLiveActivityToastCopy(type: string, description?: string | null) {
  switch (type) {
    case "request_posted":
    case "bid_awarded":
      return { title: "New dispatch", description: description ?? "A new dispatch update is available." };
    case "bid_accepted":
    case "job_accepted":
      return { title: "Driver accepted", description: description ?? "A driver accepted the dispatch." };
    case "job_started":
      return { title: "Driver arrived", description: description ?? "The driver is active on the job." };
    case "job_completed":
      return { title: "Job completed", description: description ?? "The job is ready for review." };
    case "payment_requires_action":
      return { title: "Payment needs attention", description: description ?? "Review the payment on the job." };
    case "payment_failed":
      return { title: "Payment failed", description: description ?? "Review the payment method." };
    case "bin_delivered":
    case "bin_picked_up":
    case "bin_confirmed":
      return { title: "Fleet status updated", description: description ?? "A fleet or bin status changed." };
    default:
      return null;
  }
}

export function useLiveActivityToasts(activities?: ActivityLike[] | null) {
  const latestIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    const latest = activities?.[0];
    if (!latest) return;

    if (latestIdRef.current == null) {
      latestIdRef.current = latest.id;
      return;
    }

    if (latest.id === latestIdRef.current) return;
    latestIdRef.current = latest.id;

    const copy = getLiveActivityToastCopy(latest.type, latest.description);
    if (copy) toast(copy);
  }, [activities]);
}

export function useChangedValueToast({
  value,
  getCopy,
}: {
  value: string | number | null | undefined;
  getCopy: (value: string | number) => { title: string; description?: string } | null;
}) {
  const previousRef = useRef<string | number | null | undefined>(undefined);

  useEffect(() => {
    if (value == null) return;
    if (previousRef.current === undefined) {
      previousRef.current = value;
      return;
    }
    if (previousRef.current === value) return;
    previousRef.current = value;

    const copy = getCopy(value);
    if (copy) toast(copy);
  }, [value, getCopy]);
}

export function useLatestStatusToast<
  T extends { id: number | string; status: string; note?: string | null; createdAt?: string | Date }
>(
  items?: T[] | null
) {
  const latestIdRef = useRef<string | number | null>(null);
  const latest = useMemo(() => {
    if (!items?.length) return undefined;
    return [...items].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number(a.id);
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number(b.id);
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
      return String(b.id).localeCompare(String(a.id));
    })[0];
  }, [items]);

  useEffect(() => {
    if (!latest) return;
    if (latestIdRef.current == null) {
      latestIdRef.current = latest.id;
      return;
    }
    if (latest.id === latestIdRef.current) return;
    latestIdRef.current = latest.id;

    if (latest.status === "arrived") {
      toast({ title: "Driver arrived", description: latest.note ?? "The driver reported arrival on site." });
    } else if (latest.status === "ticket_uploaded") {
      toast({ title: "Ticket uploaded", description: latest.note ?? "A new haul ticket is available." });
    } else if (latest.status === "completed") {
      toast({ title: "Job completed", description: latest.note ?? "The driver marked the job complete." });
    }
  }, [latest]);
}
