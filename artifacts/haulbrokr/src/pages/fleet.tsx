import { Link } from "wouter";
import {
  Plus,
  Truck,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  User,
} from "lucide-react";
import {
  useListTrucks,
  useDeleteTruck,
  useUpdateTruck,
  useListOrgMembers,
  getListTrucksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
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
    return (
      <Badge className="rounded-xl bg-green-600 text-white font-bold uppercase text-[10px]">
        <ShieldCheck className="h-3 w-3 mr-1" /> COI Active
      </Badge>
    );
  }
  if (s === "expired") {
    return (
      <Badge className="rounded-xl bg-destructive text-destructive-foreground font-bold uppercase text-[10px]">
        <ShieldAlert className="h-3 w-3 mr-1" /> COI Expired
      </Badge>
    );
  }
  if (s === "pending") {
    return (
      <Badge
        variant="secondary"
        className="rounded-xl font-bold uppercase text-[10px]"
      >
        <ShieldQuestion className="h-3 w-3 mr-1" /> COI Pending
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="rounded-xl font-bold uppercase text-[10px] text-muted-foreground"
    >
      <ShieldQuestion className="h-3 w-3 mr-1" /> No COI
    </Badge>
  );
}

export default function FleetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: trucks, isLoading } = useListTrucks();
  const { data: membersResp } = useListOrgMembers();
  const deleteTruck = useDeleteTruck();
  const updateTruck = useUpdateTruck();

  const drivers = (membersResp?.members ?? []).filter(
    (m) => m.role === "driver",
  );

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
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleAssignDriver = (truckId: number, value: string) => {
    const assignedDriverId =
      value === UNASSIGNED ? (null as any) : Number(value);
    updateTruck.mutate(
      { id: truckId, data: { assignedDriverId } },
      {
        onSuccess: () => {
          toast({
            title: assignedDriverId
              ? "Driver assigned to truck"
              : "Driver unassigned",
          });
          queryClient.invalidateQueries({ queryKey: getListTrucksQueryKey() });
        },
        onError: (err) => {
          toast({
            title: "Failed to assign driver",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6 page-enter max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Fleet</h1>
          <p className="text-muted-foreground">
            Manage your dump trucks, compliance, and driver assignments.
          </p>
        </div>
        <Link href="/fleet/new">
          <Button className="font-bold rounded-xl" data-testid="btn-add-truck">
            <Plus className="mr-2 h-4 w-4" />
            Add Truck
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : trucks && trucks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trucks.map((truck) => (
            <div
              key={truck.id}
              className="bg-card border border-border/60 p-5 flex flex-col hover:border-primary/50 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-muted p-3 rounded-sm">
                  <Truck className="h-8 w-8 text-primary" />
                </div>
                <Badge
                  variant={truck.isAvailable ? "default" : "secondary"}
                  className="rounded-xl font-bold uppercase text-[10px]"
                >
                  {truck.isAvailable ? "Available" : "In Use / Offline"}
                </Badge>
              </div>

              <div className="mb-3 flex-1">
                <div className="flex items-center gap-2">
                  {truck.truckNumber && (
                    <span className="font-mono text-sm font-black bg-primary text-primary-foreground px-1.5 py-0.5">
                      #{truck.truckNumber}
                    </span>
                  )}
                  <h3 className="text-xl font-black capitalize tracking-tight">
                    {truck.truckType.replace("_", " ")}
                  </h3>
                </div>
                <div className="flex gap-3 text-sm text-muted-foreground mt-1 font-medium">
                  <span>{truck.capacityTons} Tons Capacity</span>
                  <span>•</span>
                  <span className="text-foreground font-bold">
                    ${truck.ratePerHour}/hr Default
                  </span>
                </div>
              </div>

              <div className="mb-3">
                <CoiBadge status={truck.coiStatus} />
              </div>

              <div className="bg-muted/50 p-3 mb-4 space-y-2 text-sm border border-border">
                {truck.make && truck.model && (
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {truck.year} {truck.make} {truck.model}
                    </span>
                  </div>
                )}
                {truck.licensePlate && (
                  <div className="flex items-center gap-2 font-mono">
                    <span className="bg-yellow-200 text-yellow-900 border border-yellow-400 px-2 py-0.5 text-xs font-bold rounded-sm dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700">
                      {truck.licensePlate}
                    </span>
                  </div>
                )}
                {truck.vin && (
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    VIN: {truck.vin}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground flex items-center gap-1 mb-1">
                  <User className="h-3 w-3" /> Assigned Driver
                </label>
                <Select
                  value={
                    truck.assignedDriverId
                      ? String(truck.assignedDriverId)
                      : UNASSIGNED
                  }
                  onValueChange={(v) => handleAssignDriver(truck.id, v)}
                  disabled={updateTruck.isPending}
                >
                  <SelectTrigger className="rounded-xl border-2 h-10 text-sm">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2">
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.contactName || d.companyName || `Driver #${d.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {drivers.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    No drivers yet. Invite drivers from the{" "}
                    <Link href="/company" className="underline font-semibold">
                      Company
                    </Link>{" "}
                    page.
                  </p>
                )}
              </div>

              <div className="flex gap-2 mt-auto">
                <Link href={`/fleet/${truck.id}/edit`} className="flex-1">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-2 font-semibold"
                  >
                    Edit
                  </Button>
                </Link>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="rounded-xl border-2 text-destructive hover:bg-destructive/10 hover:border-destructive"
                    >
                      Remove
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-xl border-2">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Remove truck from fleet?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this truck profile. Active
                        jobs using this truck will not be affected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl border-2">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDelete(truck.id)}
                      >
                        Yes, Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-dashed border-border/60 p-12 text-center">
          <Truck className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2">Your fleet is empty</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Add your dump trucks to start bidding on jobs. Accurate truck
            profiles help customers choose your bids.
          </p>
          <Link href="/fleet/new">
            <Button size="lg" className="font-bold rounded-xl h-12 px-8">
              Add Your First Truck
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
