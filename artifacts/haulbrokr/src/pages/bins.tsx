import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Trash2, Package, Calendar as CalendarIcon, MapPin, Navigation,
  Loader2, CheckCircle, AlertCircle, X, Plus, RefreshCw, Clock, ChevronRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LiveRefreshBadge, PageTransition } from "@/components/realtime/microinteractions";
import { liveQueryOptions } from "@/hooks/use-realtime-feedback";

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

// ── Types ────────────────────────────────────────────────────────────────────

interface BinOrder {
  id: string;
  serviceType: string;
  binSize: string;
  binType: string;
  quantity: number;
  deliveryAddress: string;
  deliveryDate: string;
  pickupDate?: string;
  wasteType: string;
  preferredProvider?: string;
  status: string;
  estimatedCostCents?: number;
  notes?: string;
  createdAt: string;
}

// ── Catalog Data ─────────────────────────────────────────────────────────────

const ROLL_OFF_SIZES = [
  { id: "10_yard", label: "10-Yard", desc: "Small cleanouts, garage purges", dims: "14' L × 7.5' W × 3.5' H", est: 395, icon: "🏠" },
  { id: "20_yard", label: "20-Yard", desc: "Roofing, deck tear-outs, medium renos", dims: "22' L × 7.5' W × 4' H", est: 525, icon: "🏗️" },
  { id: "30_yard", label: "30-Yard", desc: "Large remodels, new construction debris", dims: "22' L × 7.5' W × 5.5' H", est: 675, icon: "🏢" },
  { id: "40_yard", label: "40-Yard", desc: "Demo projects, major commercial jobs", dims: "22' L × 7.5' W × 8' H", est: 875, icon: "🏭" },
];

const PERM_SIZES = [
  { id: "2_yard", label: "2-Yard Front-Load", desc: "Small office, boutique, café", dims: "6' L × 4.5' W × 3.5' H", pickups: "1–2×/week", est: 145, icon: "🏪" },
  { id: "4_yard", label: "4-Yard Front-Load", desc: "Mid-size office, retail store", dims: "6' L × 5' W × 5' H", pickups: "1–3×/week", est: 195, icon: "🏬" },
  { id: "6_yard", label: "6-Yard Front-Load", desc: "Restaurant, grocery, apartment complex", dims: "6' L × 5.5' W × 6' H", pickups: "2–5×/week", est: 275, icon: "🏢" },
  { id: "8_yard", label: "8-Yard Front-Load", desc: "Large commercial facility, mall", dims: "6' L × 6' W × 7' H", pickups: "3–6×/week", est: 345, icon: "🏭" },
  { id: "10_yard_perm", label: "10-Yard Open-Top", desc: "Construction site, manufacturing plant", dims: "14' L × 7.5' W × 3.5' H", pickups: "On-call or scheduled", est: 420, icon: "🏗️" },
  { id: "20_yard_perm", label: "20-Yard Open-Top", desc: "Industrial facility, large warehouse", dims: "22' L × 7.5' W × 4' H", pickups: "On-call or scheduled", est: 560, icon: "🏭" },
  { id: "30_yard_perm", label: "30-Yard Open-Top", desc: "Demo contractor, transfer station", dims: "22' L × 7.5' W × 5.5' H", pickups: "On-call or scheduled", est: 710, icon: "🏗️" },
  { id: "40_yard_perm", label: "40-Yard Compactor", desc: "High-volume commercial / industrial compactor", dims: "22' L × 8' W × 8' H", pickups: "On-call or scheduled", est: 920, icon: "⚙️" },
];

const PROVIDERS = [
  { id: "any", label: "Best Available", desc: "We find the best rate for you" },
  { id: "waste_management", label: "Waste Management", desc: "Largest US provider" },
  { id: "republic", label: "Republic Services", desc: "National coverage" },
  { id: "key_disposal", label: "Key Disposal", desc: "Regional specialist" },
  { id: "clean_earth", label: "Clean Earth", desc: "Environmental focus" },
  { id: "casella", label: "Casella Waste", desc: "Northeast & Mid-Atlantic" },
  { id: "advanced", label: "Advanced Disposal", desc: "Southeast US" },
];

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

// ── Location Hook ─────────────────────────────────────────────────────────────

function useReverseGeocode() {
  const [loading, setLoading] = useState(false);

  const getAddress = useCallback(async (): Promise<string | null> => {
    if (!navigator.geolocation) return null;
    setLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      const { latitude, longitude } = pos.coords;
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await resp.json();
      const a = data.address || {};
      const parts = [
        a.house_number,
        a.road,
        a.city || a.town || a.village || a.county,
        a.state,
        a.postcode,
      ].filter(Boolean);
      return parts.join(", ") || data.display_name || null;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getAddress, loading };
}

// ── Bin Card ──────────────────────────────────────────────────────────────────

function BinCard({ bin, selected, onSelect, type }: {
  bin: typeof ROLL_OFF_SIZES[0];
  selected: boolean;
  onSelect: () => void;
  type: "temporary" | "permanent";
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left border-2 p-4 transition-all hover:border-primary group",
        selected ? "border-primary bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{bin.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-base">{bin.label}</span>
            {selected && <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{bin.desc}</p>
          {"dims" in bin && (
            <p className="text-xs text-muted-foreground/60 mt-1">{(bin as any).dims}</p>
          )}
          {"pickups" in bin && (
            <p className="text-xs text-muted-foreground/60 mt-1">Service: {(bin as any).pickups}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-black text-primary">${bin.est}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
            {type === "temporary" ? "est./rental" : "est./mo"}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BinsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getAddress, loading: geoLoading } = useReverseGeocode();

  const [tab, setTab] = useState<"temporary" | "permanent">("temporary");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState<Date>();
  const [pickupDate, setPickupDate] = useState<Date>();
  const [wasteType, setWasteType] = useState("general");
  const [provider, setProvider] = useState("any");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: orders = [], isLoading: ordersLoading, isFetching: ordersFetching, refetch } = useQuery<BinOrder[]>({
    queryKey: ["bin-orders"],
    queryFn: () => apiFetch("/bin-orders"),
    ...liveQueryOptions,
  });

  // Deep-link target: bin status notifications in the activity feed link here as
  // /bins?order=<uuid>. Scroll the matching card into view and briefly highlight
  // it so the customer sees exactly which order changed, then clean up the URL.
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const orderRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("order");
    if (target) setHighlightedOrderId(target);
  }, []);

  useEffect(() => {
    if (!highlightedOrderId || ordersLoading) return;
    if (!orders.some(o => o.id === highlightedOrderId)) return;
    const node = orderRefs.current[highlightedOrderId];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
    const params = new URLSearchParams(window.location.search);
    params.delete("order");
    window.history.replaceState({}, "", window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash);
    const t = setTimeout(() => setHighlightedOrderId(null), 2600);
    return () => clearTimeout(t);
  }, [highlightedOrderId, ordersLoading, orders]);

  const createOrder = useMutation({
    mutationFn: (payload: object) =>
      apiFetch("/bin-orders", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast({ title: "Bin service requested!", description: "A provider will confirm your order shortly." });
      queryClient.invalidateQueries({ queryKey: ["bin-orders"] });
      setShowForm(false);
      setSelectedSize("");
      setDeliveryAddress("");
      setDeliveryDate(undefined);
      setPickupDate(undefined);
      setNotes("");
    },
    onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
  });

  const cancelOrder = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/bin-orders/${id}/cancel`, { method: "PATCH" }),
    onSuccess: () => {
      toast({ title: "Order cancelled" });
      queryClient.invalidateQueries({ queryKey: ["bin-orders"] });
    },
  });

  const handleUseMyLocation = async () => {
    const addr = await getAddress();
    if (addr) {
      setDeliveryAddress(addr);
      toast({ title: "Location detected", description: addr });
    } else {
      toast({ title: "Could not get location", description: "Please enter your address manually.", variant: "destructive" });
    }
  };

  function handleSubmit(): void {
    if (!selectedSize) { toast({ title: "Please select a bin size", variant: "destructive" }); return; }
    if (!deliveryAddress.trim()) { toast({ title: "Please enter a delivery address", variant: "destructive" }); return; }
    if (!deliveryDate) { toast({ title: "Please select a delivery date", variant: "destructive" }); return; }

    const binType = tab === "temporary" ? "roll_off" : "front_load";

    createOrder.mutate({
      serviceType: tab,
      binSize: selectedSize,
      binType,
      quantity,
      deliveryAddress: deliveryAddress.trim(),
      deliveryDate: deliveryDate.toISOString(),
      pickupDate: pickupDate?.toISOString(),
      wasteType,
      preferredProvider: provider,
      notes: notes.trim() || undefined,
    });
  }

  const catalog = tab === "temporary" ? ROLL_OFF_SIZES : PERM_SIZES;
  const activeOrders = orders.filter(o => !["cancelled", "picked_up"].includes(o.status));
  const pastOrders = orders.filter(o => ["cancelled", "picked_up"].includes(o.status));

  return (
    <PageTransition className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Trash2 className="h-8 w-8 text-primary" />
            Bin & Dumpster Rental
          </h1>
          <p className="text-muted-foreground mt-1">
            Order temporary roll-offs or set up permanent bin service from top providers.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LiveRefreshBadge isFetching={ordersFetching} />
          {!showForm && (
            <Button className="font-bold rounded-none h-10 px-5" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Order Bin Service
            </Button>
          )}
        </div>
      </div>

      {/* Order Form */}
      {showForm && (
        <div className="bg-card border-2 border-primary/30 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b-2 border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="font-black text-lg">Configure Your Order</span>
            </div>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 md:p-8 space-y-8">
            {/* Service Type Toggle */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Service Type</Label>
              <div className="flex mt-2 border-2 border-border">
                <button
                  type="button"
                  onClick={() => { setTab("temporary"); setSelectedSize(""); }}
                  className={cn(
                    "flex-1 py-3 px-4 font-bold text-sm transition-colors",
                    tab === "temporary" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  Temporary Roll-Off
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("permanent"); setSelectedSize(""); }}
                  className={cn(
                    "flex-1 py-3 px-4 font-bold text-sm transition-colors border-l-2 border-border",
                    tab === "permanent" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  Permanent Bin Service
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {tab === "temporary"
                  ? "Roll-off dumpsters delivered, left on-site, then picked up. Ideal for one-time projects."
                  : "Recurring front-load bin service for ongoing waste needs. Monthly billing."}
              </p>
            </div>

            {/* Size Catalog */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Select Bin Size
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                {catalog.map((bin) => (
                  <BinCard
                    key={bin.id}
                    bin={bin}
                    selected={selectedSize === bin.id}
                    onSelect={() => setSelectedSize(bin.id)}
                    type={tab}
                  />
                ))}
              </div>
            </div>

            {/* Quantity + Waste Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="mt-2 h-11 border-2 rounded-none"
                />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Waste Type</Label>
                <Select value={wasteType} onValueChange={setWasteType}>
                  <SelectTrigger className="mt-2 h-11 border-2 rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-2 rounded-none">
                    <SelectItem value="general">General Waste</SelectItem>
                    <SelectItem value="construction">Construction / Demolition</SelectItem>
                    <SelectItem value="yard">Yard / Organic Waste</SelectItem>
                    <SelectItem value="recycling">Recycling / Mixed</SelectItem>
                    <SelectItem value="hazardous">Hazardous Materials</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preferred Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="mt-2 h-11 border-2 rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-2 rounded-none">
                    {PROVIDERS.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div>
                          <div className="font-semibold">{p.label}</div>
                          <div className="text-xs text-muted-foreground">{p.desc}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Delivery Address */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Delivery Address <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs rounded-none border-2 border-primary/50 text-primary hover:bg-primary/10 gap-1.5"
                  onClick={handleUseMyLocation}
                  disabled={geoLoading}
                >
                  {geoLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Navigation className="h-3.5 w-3.5" />
                  )}
                  {geoLoading ? "Detecting..." : "Use My Location"}
                </Button>
              </div>
              <Textarea
                placeholder="e.g. 4500 Construction Blvd, Houston, TX 77001"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                className="min-h-[72px] border-2 rounded-none resize-none focus-visible:ring-primary"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                  Delivery Date <span className="text-destructive">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-11 border-2 rounded-none pl-3 text-left font-normal justify-start",
                        !deliveryDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {deliveryDate ? format(deliveryDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-2 rounded-none">
                    <Calendar
                      mode="single"
                      selected={deliveryDate}
                      onSelect={setDeliveryDate}
                      disabled={d => d < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {tab === "temporary" && (
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    Pickup Date (optional)
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-11 border-2 rounded-none pl-3 text-left font-normal justify-start",
                          !pickupDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {pickupDate ? format(pickupDate, "PPP") : "Select date (7-day default)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-2 rounded-none">
                      <Calendar
                        mode="single"
                        selected={pickupDate}
                        onSelect={setPickupDate}
                        disabled={d => d < (deliveryDate ?? new Date())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Special Instructions
              </Label>
              <Textarea
                placeholder="Gate codes, placement instructions, weight restrictions, etc."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="min-h-[72px] border-2 rounded-none resize-none focus-visible:ring-primary"
              />
            </div>

            {/* Estimate Banner */}
            {selectedSize && (
              <div className="flex items-center gap-4 bg-primary/10 border-2 border-primary/30 p-4">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-bold text-sm">Estimated Cost</p>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const cat = catalog.find(c => c.id === selectedSize);
                      return cat
                        ? `$${(cat.est * quantity).toLocaleString()} — ${cat.label} × ${quantity} (${tab === "temporary" ? "per rental" : "per month"}). Final price confirmed by provider.`
                        : "";
                    })()}
                  </p>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2 border-t-2 border-border">
              <Button
                variant="outline"
                className="h-11 px-6 font-bold rounded-none border-2"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-11 px-8 font-bold rounded-none"
                onClick={handleSubmit}
                disabled={createOrder.isPending}
              >
                {createOrder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Info Cards when no form showing */}
      {!showForm && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: "🚛", title: "Temporary Roll-Off", desc: "10–40 yard open-top containers. Delivered and picked up on your schedule. Perfect for projects." },
            { icon: "♻️", title: "Permanent Service", desc: "Weekly front-load bin service for businesses. From 2-yard to 8-yard containers, any frequency." },
            { icon: "🏢", title: "Top Providers", desc: "Waste Management, Republic, Key Disposal, Clean Earth, and more — all matched to your location." },
          ].map((card) => (
            <div key={card.title} className="bg-card border-2 border-border p-5">
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="font-bold text-base mb-1">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black">My Active Orders</h2>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => refetch()}>
            <RefreshCw className={cn("h-4 w-4", ordersFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {ordersLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : activeOrders.length > 0 ? (
          <div className="space-y-3">
            {activeOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onCancel={() => cancelOrder.mutate(order.id)}
                cancelling={cancelOrder.isPending}
                highlighted={highlightedOrderId === order.id}
                cardRef={(el) => { orderRefs.current[order.id] = el; }}
              />
            ))}
          </div>
        ) : (
          <div className="bg-card border-2 border-dashed border-border p-10 text-center">
            <Trash2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-muted-foreground">No active bin orders</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Order Bin Service" to get started.</p>
          </div>
        )}
      </div>

      {/* Past Orders */}
      {pastOrders.length > 0 && (
        <div>
          <h2 className="text-xl font-black mb-4">Order History</h2>
          <div className="space-y-3">
            {pastOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                past
                highlighted={highlightedOrderId === order.id}
                cardRef={(el) => { orderRefs.current[order.id] = el; }}
              />
            ))}
          </div>
        </div>
      )}
    </PageTransition>
  );
}

function OrderCard({ order, onCancel, cancelling, past, highlighted, cardRef }: {
  order: BinOrder;
  onCancel?: () => void;
  cancelling?: boolean;
  past?: boolean;
  highlighted?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  const sizeLabels: Record<string, string> = {
    "10_yard": "10-Yard Roll-Off",
    "20_yard": "20-Yard Roll-Off",
    "30_yard": "30-Yard Roll-Off",
    "40_yard": "40-Yard Roll-Off",
    "2_yard": "2-Yard Front-Load",
    "4_yard": "4-Yard Front-Load",
    "6_yard": "6-Yard Front-Load",
    "8_yard": "8-Yard Front-Load",
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "hb-feed-item bg-card border-2 p-5 transition-colors",
        past ? "opacity-70" : "",
        highlighted ? "border-violet-500 bg-violet-500/5" : "border-border",
      )}
    >
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <Link
          href={`/bins/${order.id}`}
          className="space-y-2 flex-1 min-w-0 group cursor-pointer"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black group-hover:text-primary transition-colors">{sizeLabels[order.binSize] ?? order.binSize}</span>
            <span className="text-muted-foreground text-sm">× {order.quantity}</span>
            <Badge variant="outline" className={cn("rounded-none border text-[10px] uppercase tracking-wider font-bold", STATUS_STYLE[order.status] || "")}>
              {STATUS_LABEL[order.status] ?? order.status}
            </Badge>
          </div>

          <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
            <span className="truncate">{order.deliveryAddress}</span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              Delivery: {format(new Date(order.deliveryDate), "MMM d, yyyy")}
            </div>
            {order.pickupDate && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                Pickup: {format(new Date(order.pickupDate), "MMM d, yyyy")}
              </div>
            )}
          </div>

          {order.estimatedCostCents && (
            <div className="text-sm font-bold text-primary">
              Est. ${(order.estimatedCostCents / 100).toLocaleString()}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                {order.serviceType === "temporary" ? "per rental" : "per month"}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors pt-1">
            View details
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        {!past && onCancel && order.status === "pending" && (
          <div className="flex items-start">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none border-2 border-destructive/50 text-destructive hover:bg-destructive/10 font-bold h-8"
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1" />}
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
