import { Link } from "wouter";
import { Plus, Truck, Settings2, ShieldCheck, ShieldAlert, ShieldQuestion, User } from "lucide-react";
import {
  useListTrucks, useDeleteTruck, useUpdateTruck, useListOrgMembers,
  getListTrucksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, EmptyState, DataCard, SectionFade, QueryErrorState } from "@/components/design";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const UNASSIGNED = "unassigned";

function CoiBadge({ status }: { status?: string | null }) {
  const s = status ?? "none";
  if (s === "active") {
    return <Badge className="bg-success/15 text-success border-success/30 font-semibold uppercase text-[10px]"><ShieldCheck className="h-3 w-3 mr-1" /> COI Active</Badge>;
  }
  if (s === "expired") {
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30 font-semibold uppercase text-[10px]"><ShieldAlert className="h-3 w-3 mr-1" /> COI Expired</Badge>;
  }
  if (s === "pending") {
    return <Badge variant="secondary" className="font-semibold uppercase text-[10px]"><ShieldQuestion className="h-3 w-3 mr-1" /> COI Pending</Badge>;
  }
  return <Badge variant="outline" className="font-semibold uppercase text-[10px] text-muted-foreground"><ShieldQuestion className="h-3 w-3 mr-1" /> No COI</Badge>;
}

export default function FleetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: trucks, isLoading, isError, refetch } = useListTrucks();
  const { data: membersResp } = useListOrgMembers();
  const deleteTruck = useDeleteTruck();
  const updateTruck = useUpdateTruck();

  const drivers = (membersResp?.members ?? []).filter(m => m.role === "driver");

  const handleDelete = (id: number) => {
    deleteTruck.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Truck removed from fleet" });
          queryClient.invalidateQueries({ queryKey: getListTrucksQueryKey() });
        },
        onError: (err) => {
          toast({ 
            title: "Failed to remove truck", 
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleAssignDriver = (truckId: number, value: string) => {
    const assignedDriverId = value === UNASSIGNED ? (null as any) : Number(value);
    updateTruck.mutate(
      { id: truckId, data: { assignedDriverId } },
      {
        onSuccess: () => {
          toast({ title: assignedDriverId ? "Driver assigned to truck" : "Driver unassigned" });
          queryClient.invalidateQueries({ queryKey: getListTrucksQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Failed to assign driver",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6 page-enter max-w-5xl mx-auto">
      <PageHeader
        title="My Fleet"
        description="Manage your dump trucks, compliance, and driver assignments."
        actions={
          <Link href="/fleet/new">
            <Button data-testid="btn-add-truck">
              <Plus className="mr-2 h-4 w-4" />
              Add Truck
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <QueryErrorState
          title="Failed to load fleet"
          onRetry={() => refetch()}
        />
      ) : trucks && trucks.length > 0 ? (
        <SectionFade>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trucks.map((truck, i) => (
              <DataCard key={truck.id} className={cn("card-fade", `stagger-${(i % 4) + 1}`)}>
                <div className="p-5 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <Truck className="h-8 w-8 text-primary" />
                    </div>
                    <Badge variant={truck.isAvailable ? "default" : "secondary"} className="font-semibold uppercase text-[10px]">
                      {truck.isAvailable ? "Available" : "In Use / Offline"}
                    </Badge>
                  </div>
                  
                  <div className="mb-3 flex-1">
                    <div className="flex items-center gap-2">
                      {truck.truckNumber && (
                        <span className="font-mono text-sm font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md">#{truck.truckNumber}</span>
                      )}
                      <h3 className="text-xl font-bold capitalize tracking-tight">{truck.truckType.replace('_', ' ')}</h3>
                    </div>
                    <div className="flex gap-3 text-sm text-muted-foreground mt-1 font-medium">
                      <span>{truck.capacityTons} Tons Capacity</span>
                      <span>•</span>
                      <span className="text-foreground font-semibold">${truck.ratePerHour}/hr Default</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <CoiBadge status={truck.coiStatus} />
                  </div>

                  <div className="bg-muted/30 p-3 mb-4 space-y-2 text-sm border border-border/40 rounded-lg">
                    {truck.make && truck.model && (
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <span>{truck.year} {truck.make} {truck.model}</span>
                      </div>
                    )}
                    {truck.licensePlate && (
                      <div className="flex items-center gap-2 font-mono">
                        <span className="bg-warning/20 text-warning-foreground border border-warning/40 px-2 py-0.5 text-xs font-bold rounded-md">
                          {truck.licensePlate}
                        </span>
                      </div>
                    )}
                    {truck.vin && (
                      <div className="text-xs text-muted-foreground font-mono truncate">VIN: {truck.vin}</div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1 mb-1.5">
                      <User className="h-3 w-3" /> Assigned Driver
                    </label>
                    <Select
                      value={truck.assignedDriverId ? String(truck.assignedDriverId) : UNASSIGNED}
                      onValueChange={(v) => handleAssignDriver(truck.id, v)}
                      disabled={updateTruck.isPending}
                    >
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                        {drivers.map(d => (
                          <SelectItem key={d.id} value={String(d.id)}>{d.contactName || d.companyName || `Driver #${d.id}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {drivers.length === 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        No drivers yet. Invite drivers from the <Link href="/company" className="underline font-semibold text-primary">Company</Link> page.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <Link href={`/fleet/${truck.id}/edit`} className="flex-1">
                      <Button variant="outline" className="w-full">Edit</Button>
                    </Link>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:border-destructive/50">Remove</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove truck from fleet?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this truck profile. Active jobs using this truck will not be affected.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(truck.id)}
                          >
                            Yes, Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </DataCard>
            ))}
          </div>
        </SectionFade>
      ) : (
        <EmptyState
          icon={Truck}
          title="Your fleet is empty"
          description="Add your dump trucks to start bidding on jobs. Accurate truck profiles help customers choose your bids."
          action={{ label: "Add Your First Truck", href: "/fleet/new" }}
        />
      )}
    </div>
  );
}
