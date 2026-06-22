import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft, Trash2, MapPin, Calendar as CalendarIcon, Clock, Package,
  Truck, FileText, Loader2, X, CheckCircle, Circle, XCircle, AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const resp = await fetch(`${BASE}/api${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json();
}

interface BinOrder {
  id: string;
  serviceType: string;
  binSize: string;
  binType: string;
  binSizeLabel?: string;
  binTypeLabel?: string;
  quantity: number;
  deliveryAddress: string;
  deliveryDate: string;
  pickupDate?: string | null;
  wasteType: string;
  preferredProvider?: string;
  status: string;
  estimatedCost?: string;
  estimatedCostCents?: number;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  picked_up: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending Confirmation",
  confirmed: "Confirmed",
  delivered: "Delivered",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
};

const PROVIDER_LABEL: Record<string, string> = {
  any: "Best Available",
  waste_management: "Waste Management",
  republic: "Republic Services",
  key_disposal: "Key Disposal",
  clean_earth: "Clean Earth",
  casella: "Casella Waste",
  advanced: "Advanced Disposal",
};

const WASTE_LABEL: Record<string, string> = {
  general: "General Waste",
  construction: "Construction / Demolition",
  yard: "Yard / Organic Waste",
  recycling: "Recycling / Mixed",
  hazardous: "Hazardous Materials",
};

// The persisted lifecycle is a strict forward chain. We derive the timeline from
// the current status: every step up to and including the current one is "done",
// the next is "upcoming". A cancelled order short-circuits to its own terminal row.
const LIFECYCLE: { key: string; label: string; desc: string }[] = [
  { key: "pending", label: "Order Placed", desc: "Your request was submitted and is awaiting confirmation." },
  { key: "confirmed", label: "Confirmed", desc: "A provider confirmed your order and is scheduling delivery." },
  { key: "delivered", label: "Delivered", desc: "The bin was dropped off and is ready to use." },
  { key: "picked_up", label: "Picked Up", desc: "The bin was hauled away. All done!" },
];
const LIFECYCLE_ORDER = LIFECYCLE.map((s) => s.key);

export default function BinDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: order, isLoading, isError } = useQuery<BinOrder>({
    queryKey: ["bin-order", id],
    queryFn: () => apiFetch(`/bin-orders/${id}`),
    enabled: !!id,
  });

  const [confirmCancel, setConfirmCancel] = useState(false);

  const cancelOrder = useMutation({
    mutationFn: () => apiFetch(`/bin-orders/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Order cancelled" });
      queryClient.invalidateQueries({ queryKey: ["bin-order", id] });
      queryClient.invalidateQueries({ queryKey: ["bin-orders"] });
      setConfirmCancel(false);
    },
    onError: () => toast({ title: "Failed to cancel order", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto flex justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-4">
        <Trash2 className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
        <div>
          <p className="font-black text-lg">Bin order not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            This order may have been removed, or the link is invalid.
          </p>
        </div>
        <Button className="rounded-none font-bold h-10" onClick={() => setLocation("/bins")}>
          Back to Bin Rental
        </Button>
      </div>
    );
  }

  const isCancelled = order.status === "cancelled";
  const currentIdx = LIFECYCLE_ORDER.indexOf(order.status);
  const canCancel = order.status === "pending" || order.status === "confirmed";
  const sizeLabel = order.binSizeLabel
    ? `${order.binSizeLabel} ${order.binTypeLabel ?? ""}`.trim()
    : order.binSize;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Back */}
      <Link href="/bins" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Bin Rental
      </Link>

      {/* Header card */}
      <div className="bg-card border-2 border-border p-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Trash2 className="h-7 w-7 text-primary flex-shrink-0" />
              <h1 className="text-2xl font-black tracking-tight">{sizeLabel}</h1>
              <span className="text-muted-foreground text-sm">× {order.quantity}</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "rounded-none border text-[10px] uppercase tracking-wider font-bold",
                STATUS_STYLE[order.status] || "",
              )}
            >
              {STATUS_LABEL[order.status] ?? order.status}
            </Badge>
          </div>
          {order.estimatedCost && (
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Estimated Cost
              </div>
              <div className="text-2xl font-black text-primary">{order.estimatedCost}</div>
              <div className="text-xs text-muted-foreground">
                {order.serviceType === "temporary" ? "per rental" : "per month"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status timeline */}
      <div className="bg-card border-2 border-border p-6">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-5">
          Status Timeline
        </h2>

        {isCancelled ? (
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-700 dark:text-red-400">Order Cancelled</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                This order was cancelled{order.updatedAt ? ` on ${format(new Date(order.updatedAt), "MMM d, yyyy")}` : ""}.
              </p>
            </div>
          </div>
        ) : (
          <ol className="relative space-y-0">
            {LIFECYCLE.map((step, idx) => {
              const done = idx <= currentIdx;
              const current = idx === currentIdx;
              const isLast = idx === LIFECYCLE.length - 1;
              const stepDate =
                step.key === "pending"
                  ? order.createdAt
                  : step.key === "delivered"
                    ? order.deliveryDate
                    : step.key === "picked_up"
                      ? order.pickupDate ?? undefined
                      : undefined;
              return (
                <li key={step.key} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {done ? (
                      <CheckCircle className={cn("h-5 w-5 flex-shrink-0", current ? "text-primary" : "text-green-600")} />
                    ) : (
                      <Circle className="h-5 w-5 flex-shrink-0 text-muted-foreground/40" />
                    )}
                    {!isLast && (
                      <div className={cn("w-0.5 flex-1 min-h-[28px]", idx < currentIdx ? "bg-green-600/40" : "bg-border")} />
                    )}
                  </div>
                  <div className={cn("pb-6", isLast && "pb-0")}>
                    <p className={cn("font-bold text-sm", done ? "" : "text-muted-foreground")}>
                      {step.label}
                      {current && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-primary font-black">Current</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                    {stepDate && (
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {step.key === "delivered" && order.status === "pending" ? "Scheduled: " : ""}
                        {format(new Date(stepDate), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Order details */}
      <div className="bg-card border-2 border-border p-6 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">
          Order Details
        </h2>

        <DetailRow icon={MapPin} label="Delivery Address" value={order.deliveryAddress} />
        <DetailRow
          icon={CalendarIcon}
          label="Delivery Date"
          value={format(new Date(order.deliveryDate), "EEEE, MMM d, yyyy")}
        />
        {order.pickupDate && (
          <DetailRow
            icon={Clock}
            label="Pickup Date"
            value={format(new Date(order.pickupDate), "EEEE, MMM d, yyyy")}
          />
        )}
        <DetailRow icon={Package} label="Waste Type" value={WASTE_LABEL[order.wasteType] ?? order.wasteType} />
        <DetailRow
          icon={Truck}
          label="Preferred Provider"
          value={PROVIDER_LABEL[order.preferredProvider ?? "any"] ?? order.preferredProvider ?? "Best Available"}
        />
        {order.notes && <DetailRow icon={FileText} label="Special Instructions" value={order.notes} />}
        <DetailRow
          icon={Clock}
          label="Ordered"
          value={format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
        />
      </div>

      {/* Actions */}
      {canCancel && (
        <div className="bg-card border-2 border-destructive/30 p-6">
          {!confirmCancel ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Need to cancel?</p>
                  <p className="text-sm text-muted-foreground">
                    You can cancel this order while it hasn't been delivered yet.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="rounded-none border-2 border-destructive/50 text-destructive hover:bg-destructive/10 font-bold h-10 flex-shrink-0"
                onClick={() => setConfirmCancel(true)}
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancel Order
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="font-bold text-sm text-destructive">
                Are you sure? This can't be undone.
              </p>
              <div className="flex gap-3 flex-shrink-0">
                <Button
                  variant="outline"
                  className="rounded-none border-2 font-bold h-10"
                  onClick={() => setConfirmCancel(false)}
                  disabled={cancelOrder.isPending}
                >
                  Keep Order
                </Button>
                <Button
                  className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold h-10"
                  onClick={() => cancelOrder.mutate()}
                  disabled={cancelOrder.isPending}
                >
                  {cancelOrder.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <X className="h-4 w-4 mr-1.5" />
                  )}
                  Cancel Order
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <p className="text-sm font-semibold mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}
