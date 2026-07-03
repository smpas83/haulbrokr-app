import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Truck, ArrowLeft, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateTruck, useUpdateTruck, useGetTruck,
  TruckInputTruckType, TruckInputCoiStatus, getListTrucksQueryKey,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  truckType: z.nativeEnum(TruckInputTruckType, {
    required_error: "Please select a truck type.",
  }),
  capacityTons: z.coerce.number().positive("Capacity must be positive."),
  ratePerHour: z.coerce.number().positive("Rate must be positive."),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1).optional().or(z.literal("").transform(() => undefined)),
  licensePlate: z.string().optional(),
  truckNumber: z.string().optional(),
  vin: z.string().optional(),
  coiStatus: z.nativeEnum(TruckInputCoiStatus).default(TruckInputCoiStatus.none),
  isAvailable: z.boolean().default(true),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const COI_LABELS: Record<string, string> = {
  none: "Not on file",
  pending: "Pending review",
  active: "Active / Verified",
  expired: "Expired",
};

export default function NewTruckPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/fleet/:id/edit");
  const truckId = params?.id ? Number(params.id) : undefined;
  const isEdit = truckId !== undefined && !Number.isNaN(truckId);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTruck = useCreateTruck();
  const updateTruck = useUpdateTruck();
  const { data: existing, isLoading: loadingTruck } = useGetTruck(truckId as number, {
    query: { enabled: isEdit } as any,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      truckType: undefined,
      capacityTons: "" as any,
      ratePerHour: "" as any,
      make: "",
      model: "",
      year: "" as any,
      licensePlate: "",
      truckNumber: "",
      vin: "",
      coiStatus: TruckInputCoiStatus.none,
      isAvailable: true,
      notes: "",
    },
  });

  const { reset } = form;
  useEffect(() => {
    if (isEdit && existing) {
      reset({
        truckType: existing.truckType as TruckInputTruckType,
        capacityTons: existing.capacityTons as any,
        ratePerHour: existing.ratePerHour as any,
        make: existing.make ?? "",
        model: existing.model ?? "",
        year: (existing.year ?? "") as any,
        licensePlate: existing.licensePlate ?? "",
        truckNumber: existing.truckNumber ?? "",
        vin: existing.vin ?? "",
        coiStatus: (existing.coiStatus ?? TruckInputCoiStatus.none) as TruckInputCoiStatus,
        isAvailable: existing.isAvailable,
        notes: existing.notes ?? "",
      });
    }
  }, [isEdit, existing, reset]);

  function onSubmit(values: FormValues) {
    const onSuccess = () => {
      toast({ title: isEdit ? "Truck updated" : "Truck added to fleet" });
      queryClient.invalidateQueries({ queryKey: getListTrucksQueryKey() });
      setLocation("/fleet");
    };
    const onError = (err: unknown) => {
      toast({
        title: isEdit ? "Failed to update truck" : "Failed to add truck",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    };

    if (isEdit) {
      updateTruck.mutate({ id: truckId as number, data: values }, { onSuccess, onError });
    } else {
      createTruck.mutate({ data: values }, { onSuccess, onError });
    }
  }

  const isPending = createTruck.isPending || updateTruck.isPending;

  if (isEdit && loadingTruck) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-enter pb-12">
      <div>
        <Button variant="ghost" className="mb-2 -ml-4" onClick={() => setLocation("/fleet")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Fleet
        </Button>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Truck className="h-8 w-8 text-primary" />
          {isEdit ? "Edit Truck" : "Add Truck to Fleet"}
        </h1>
      </div>

      <div className="bg-card border border-border/60 shadow-sm p-6 md:p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            <div className="space-y-6 border-b-2 border-border pb-8">
              <h2 className="text-xl font-bold tracking-tight">Core Specifications</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="truckType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck Type <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 border-2 rounded-xl focus:ring-primary">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="border-2 rounded-xl">
                          {Object.values(TruckInputTruckType).map(type => (
                            <SelectItem key={type} value={type} className="capitalize font-medium">
                              {type.replace('_', ' ')} Dump
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="capacityTons"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity (Tons) <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="20" {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary font-mono text-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ratePerHour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Rate ($/Hour) <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                          <Input type="number" placeholder="110" {...field} className="h-12 pl-8 border-2 rounded-xl focus-visible:ring-primary font-mono text-lg" />
                        </div>
                      </FormControl>
                      <FormDescription>Your baseline rate. You can adjust this per bid.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-6 border-b-2 border-border pb-8">
              <h2 className="text-xl font-bold tracking-tight">Identification & Compliance</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="truckNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Truck / Unit Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 27" {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary font-mono" />
                      </FormControl>
                      <FormDescription>Your internal fleet ID.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VIN</FormLabel>
                      <FormControl>
                        <Input placeholder="1HGCM82633A..." {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary uppercase font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="coiStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Insurance (COI) Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 border-2 rounded-xl focus:ring-primary">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="border-2 rounded-xl">
                          {Object.values(TruckInputCoiStatus).map(s => (
                            <SelectItem key={s} value={s} className="font-medium">
                              {COI_LABELS[s] ?? s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-6 border-b-2 border-border pb-8">
              <h2 className="text-xl font-bold tracking-tight">Vehicle Details (Optional)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="make"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Make</FormLabel>
                      <FormControl>
                        <Input placeholder="Kenworth, Peterbilt..." {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="T880..." {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2020" {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>License Plate</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC-1234" {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary uppercase font-mono" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Input placeholder="Driver name, specific equipment..." {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="isAvailable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-xl border-2 p-4 bg-muted/20">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-bold">Currently Available for Dispatch</FormLabel>
                    <FormDescription>
                      Turn this off if the truck is in the shop or on a long-term contract elsewhere.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-4 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="h-12 px-6 font-bold rounded-xl border-2"
                onClick={() => setLocation("/fleet")}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="h-12 px-8 font-bold rounded-xl"
                disabled={isPending}
                data-testid="btn-submit-truck"
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  isEdit ? "Save Changes" : "Add Truck"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
