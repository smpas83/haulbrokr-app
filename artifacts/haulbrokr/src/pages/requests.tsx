import { useState, useMemo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Plus,
  MapPin,
  Calendar,
  Truck,
  FileText,
  Search,
  X,
} from "lucide-react";
import {
  useListRequests,
  useGetMyProfile,
  ListRequestsStatus,
  JobRequestInputMaterialType,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeader,
  StatusChip,
  EmptyState,
  ResultCount,
} from "@/components/design";

const MATERIAL_LABELS: Record<string, string> = {
  dirt: "Dirt",
  gravel: "Gravel",
  sand: "Sand",
  rock: "Rock",
  concrete: "Concrete",
  asphalt: "Asphalt",
  demolition_debris: "Demolition Debris",
  topsoil: "Topsoil",
  fill: "Fill",
  other: "Other",
};

export default function RequestsPage() {
  const { data: profile } = useGetMyProfile();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [materialFilter, setMaterialFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const isCustomer = profile?.role === "customer";

  const { data: requests, isLoading } = useListRequests();

  const filtered = useMemo(() => {
    if (!requests) return [];
    return requests.filter((req) => {
      if (statusFilter !== "all" && req.status !== statusFilter) return false;
      if (materialFilter !== "all" && req.materialType !== materialFilter)
        return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inAddress =
          req.pickupAddress?.toLowerCase().includes(q) ||
          req.deliveryAddress?.toLowerCase().includes(q);
        const inMaterial = req.materialType?.toLowerCase().includes(q);
        const inCompany = req.customerCompany?.toLowerCase().includes(q);
        if (!inAddress && !inMaterial && !inCompany) return false;
      }
      return true;
    });
  }, [requests, statusFilter, materialFilter, search]);

  const activeFilters = [
    statusFilter !== "all",
    materialFilter !== "all",
    search.trim() !== "",
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("all");
    setMaterialFilter("all");
    setSearch("");
  };

  return (
    <div className="space-y-6 page-enter max-w-6xl mx-auto">
      <PageHeader
        title={isCustomer ? "My Job Requests" : "Load Board"}
        description={
          isCustomer
            ? "Manage your active hauling requests and review bids."
            : "Browse open requests from construction sites."
        }
        actions={
          isCustomer ? (
            <Link href="/requests/new">
              <Button data-testid="btn-new-request">
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* Filter Bar */}
      <div className="surface-panel rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address, material, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search"
            aria-label="Search requests by address, material, or company"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.values(ListRequestsStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Materials</SelectItem>
              {Object.entries(MATERIAL_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear ({activeFilters})
            </Button>
          )}
        </div>
      </div>

      {!isLoading && requests && (
        <ResultCount
          count={filtered.length}
          total={requests.length}
          noun="request"
        />
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((request) => (
            <Link key={request.id} href={`/requests/${request.id}`}>
              <div className="group rounded-xl border border-border/60 bg-card p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/10 transition-all cursor-pointer">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <StatusChip status={request.status} />
                      <span className="font-mono text-xs text-muted-foreground">
                        REQ-{request.id.toString().padStart(4, "0")}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold capitalize">
                      {MATERIAL_LABELS[request.materialType] ||
                        request.materialType}{" "}
                      Haul
                    </h3>
                    {!isCustomer && request.customerCompany && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {request.customerCompany}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Pickup
                        </p>
                        <p className="font-medium truncate max-w-[180px]">
                          {request.pickupAddress || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-accent flex-shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Delivery
                        </p>
                        <p className="font-medium truncate max-w-[180px]">
                          {request.deliveryAddress || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Date
                        </p>
                        <p className="font-medium">
                          {request.scheduledDate
                            ? format(
                                new Date(request.scheduledDate),
                                "MMM d, yyyy",
                              )
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:flex-col md:items-end">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">
                        {request.trucksNeeded}
                      </span>
                    </div>
                    {request.bidCount != null && request.bidCount > 0 && (
                      <div className="flex items-center gap-1.5 text-sm text-primary">
                        <FileText className="h-4 w-4" />
                        <span className="font-semibold">
                          {request.bidCount} bids
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title={activeFilters > 0 ? "No matching requests" : "No requests yet"}
          description={
            activeFilters > 0
              ? "Try adjusting your filters to see more results."
              : isCustomer
                ? "Post your first hauling request to get started."
                : "No open requests match your criteria right now. Check back soon."
          }
          action={
            isCustomer && activeFilters === 0
              ? { label: "Post a Request", href: "/requests/new" }
              : activeFilters > 0
                ? { label: "Clear Filters", onClick: clearFilters }
                : undefined
          }
        />
      )}
    </div>
  );
}
