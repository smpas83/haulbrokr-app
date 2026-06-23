import { useState, useMemo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Plus, MapPin, Calendar, Truck, FileText, Search, Filter, X, ChevronDown } from "lucide-react";
import { useListRequests, useGetMyProfile, ListRequestsStatus, JobRequestInputMaterialType } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  bid_received: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800",
  bidding: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  awarded: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  accepted: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
  completed: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  cancelled: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
};

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
    return requests.filter(req => {
      if (statusFilter !== "all" && req.status !== statusFilter) return false;
      if (materialFilter !== "all" && req.materialType !== materialFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const inAddress = req.pickupAddress?.toLowerCase().includes(q) ||
          req.deliveryAddress?.toLowerCase().includes(q);
        const inMaterial = req.materialType?.toLowerCase().includes(q);
        const inCompany = req.customerCompany?.toLowerCase().includes(q);
        if (!inAddress && !inMaterial && !inCompany) return false;
      }
      return true;
    });
  }, [requests, statusFilter, materialFilter, search]);

  const activeFilters = [statusFilter !== "all", materialFilter !== "all", search.trim() !== ""].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("all");
    setMaterialFilter("all");
    setSearch("");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            {isCustomer ? "My Job Requests" : "Job Board"}
          </h1>
          <p className="text-muted-foreground">
            {isCustomer
              ? "Manage your active hauling requests and review bids."
              : "Browse open requests from construction sites."}
          </p>
        </div>
        {isCustomer && (
          <Link href="/requests/new">
            <Button className="font-bold rounded-none h-10 px-5" data-testid="btn-new-request">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </Link>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-card border-2 border-border p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address, material, or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-none border-2 focus-visible:ring-primary h-11"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdowns row */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] rounded-none border-2 h-9 text-sm">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue placeholder="Status" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-none border-2">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="bid_received">Bids Received</SelectItem>
              <SelectItem value="bidding">Bidding</SelectItem>
              <SelectItem value="awarded">Awarded</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={materialFilter} onValueChange={setMaterialFilter}>
            <SelectTrigger className="w-[160px] rounded-none border-2 h-9 text-sm">
              <div className="flex items-center gap-2">
                <ChevronDown className="h-3.5 w-3.5" />
                <SelectValue placeholder="Material" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-none border-2">
              <SelectItem value="all">All Materials</SelectItem>
              {Object.entries(MATERIAL_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear ({activeFilters})
            </button>
          )}

          {!isLoading && (
            <span className="ml-auto text-sm text-muted-foreground font-medium">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-36 w-full rounded-none" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(request => (
            <div
              key={request.id}
              className="bg-card border-2 border-border hover:border-primary transition-colors group"
            >
              <div className="p-5 flex flex-col md:flex-row gap-5">
                {/* Main Info */}
                <div className="flex-1 space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black">
                      {request.quantityTons} Tons — {MATERIAL_LABELS[request.materialType] || request.materialType}
                    </h3>
                    <Badge variant="outline" className={`rounded-none border font-bold uppercase text-[10px] tracking-wider ${STATUS_COLORS[request.status] || ""}`}>
                      {request.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {!isCustomer && request.customerCompany && (
                    <p className="text-sm font-semibold text-muted-foreground">{request.customerCompany}</p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground block text-xs uppercase tracking-wider mb-0.5">Pickup</span>
                        <span className="truncate block">{request.pickupAddress}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground block text-xs uppercase tracking-wider mb-0.5">Delivery</span>
                        <span className="truncate block">{request.deliveryAddress}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>{format(new Date(request.scheduledDate), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span>{request.trucksNeeded} truck{request.trucksNeeded !== 1 ? "s" : ""} needed</span>
                    </div>
                  </div>
                </div>

                {/* Rate + Actions */}
                <div className="flex flex-row md:flex-col justify-between md:justify-end items-center md:items-end gap-3 md:min-w-[140px] border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-5">
                  <div className="text-right">
                    <div className="text-2xl font-black text-foreground leading-none">
                      {request.budgetPerHour ? `$${request.budgetPerHour}/hr` : "Open Bid"}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1">
                      Target Rate
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 items-stretch w-full md:w-auto">
                    <div className="bg-secondary/60 px-3 py-1.5 text-center text-xs font-bold border border-border">
                      <span className="text-primary">{request.bidCount || 0}</span> Bid{request.bidCount !== 1 ? "s" : ""}
                    </div>
                    <Link href={`/requests/${request.id}`}>
                      <Button className="w-full font-bold rounded-none text-sm" size="sm" data-testid={`btn-view-request-${request.id}`}>
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border-2 border-dashed border-border p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-bold mb-1">No requests found</h3>
          <p className="text-muted-foreground text-sm mb-6">
            {activeFilters > 0
              ? "No requests match your current filters."
              : isCustomer
                ? "You haven't posted any job requests yet."
                : "There are no open job requests on the board right now."}
          </p>
          <div className="flex gap-3 justify-center">
            {activeFilters > 0 && (
              <Button variant="outline" className="rounded-none border-2" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
            {isCustomer && activeFilters === 0 && (
              <Link href="/requests/new">
                <Button className="font-bold rounded-none">Post Job Request</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
