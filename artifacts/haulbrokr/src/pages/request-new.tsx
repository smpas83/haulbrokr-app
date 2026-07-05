import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  MapPin, Calendar as CalendarIcon, Truck, ArrowLeft, Loader2,
  Building2, ChevronDown, Search, X, Check, Navigation
} from "lucide-react";
import { format } from "date-fns";
import {
  useCreateRequest,
  useListDumpSiteStates,
  useListDumpSites,
  JobRequestInputMaterialType,
  JobRequestInputTruckType,
  DumpSite,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const USA_STATES = [
  { abbr: "AL", name: "Alabama" }, { abbr: "AK", name: "Alaska" }, { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" }, { abbr: "CA", name: "California" }, { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" }, { abbr: "DE", name: "Delaware" }, { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" }, { abbr: "HI", name: "Hawaii" }, { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" }, { abbr: "IN", name: "Indiana" }, { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" }, { abbr: "KY", name: "Kentucky" }, { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" }, { abbr: "MD", name: "Maryland" }, { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" }, { abbr: "MN", name: "Minnesota" }, { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" }, { abbr: "MT", name: "Montana" }, { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" }, { abbr: "NH", name: "New Hampshire" }, { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" }, { abbr: "NY", name: "New York" }, { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" }, { abbr: "OH", name: "Ohio" }, { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" }, { abbr: "PA", name: "Pennsylvania" }, { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" }, { abbr: "SD", name: "South Dakota" }, { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" }, { abbr: "UT", name: "Utah" }, { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" }, { abbr: "WA", name: "Washington" }, { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" }, { abbr: "WY", name: "Wyoming" },
];

const SITE_TYPE_LABELS: Record<string, string> = {
  landfill: "Landfill",
  transfer_station: "Transfer Station",
  recycling_center: "Recycling Center",
  construction_debris: "C&D Debris",
  hazardous_waste: "Hazardous Waste",
  compost: "Compost",
};

const SITE_TYPE_COLORS: Record<string, string> = {
  landfill: "bg-slate-500",
  transfer_station: "bg-blue-600",
  recycling_center: "bg-green-600",
  construction_debris: "bg-amber-600",
  hazardous_waste: "bg-red-600",
  compost: "bg-emerald-600",
};

interface DumpSitePickerProps {
  label: string;
  onSelect: (address: string) => void;
}

function DumpSitePicker({ label, onSelect }: DumpSitePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedState, setSelectedState] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const { data: states = [] } = useListDumpSiteStates();

  const { data: sites = [], isLoading } = useListDumpSites(
    { state: selectedState || undefined, type: selectedType !== "all" ? selectedType as any : undefined },
    { query: { enabled: !!selectedState } as any }
  );

  const filtered = sites.filter((s) =>
    search.trim() === "" ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  );

  function handleSelect(site: DumpSite) {
    onSelect(site.fullAddress || `${site.name}, ${site.address}, ${site.city}, ${site.state} ${site.zip}`);
    setOpen(false);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs rounded-xl border-2 border-primary/50 text-primary hover:bg-primary/10 gap-1.5"
        >
          <Building2 className="h-3.5 w-3.5" />
          Browse Dump Sites
          <ChevronDown className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[440px] p-0 rounded-xl border-2 shadow-xl"
        align="start"
        side="bottom"
      >
        <div className="p-3 border-b-2 border-border bg-muted/40">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Select {label} Dump Site</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose a site to auto-fill the address field.
          </p>
        </div>

        {/* Filters */}
        <div className="p-3 border-b border-border space-y-2 bg-card">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">State</label>
              <Select value={selectedState} onValueChange={(v) => { setSelectedState(v); setSearch(""); }}>
                <SelectTrigger className="h-9 border-2 rounded-xl text-sm focus:ring-primary">
                  <SelectValue placeholder="Pick a state..." />
                </SelectTrigger>
                <SelectContent className="border-2 rounded-xl max-h-[200px]">
                  {USA_STATES.filter(s => states.includes(s.abbr)).map((s) => (
                    <SelectItem key={s.abbr} value={s.abbr} className="text-sm">
                      {s.name} ({s.abbr})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Facility Type</label>
              <Select value={selectedType} onValueChange={setSelectedType} disabled={!selectedState}>
                <SelectTrigger className="h-9 border-2 rounded-xl text-sm focus:ring-primary">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent className="border-2 rounded-xl">
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(SITE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedState && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 border-2 rounded-xl text-sm focus-visible:ring-primary"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Site List */}
        <ScrollArea className="h-[280px]">
          {!selectedState ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
              <MapPin className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Select a state to browse dump sites</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Building2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No sites found matching your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => handleSelect(site)}
                  className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm truncate">{site.name}</span>
                        <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {site.address}, {site.city}, {site.state} {site.zip}
                      </p>
                      {site.phone && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{site.phone}</p>
                      )}
                    </div>
                    <Badge className={cn("text-[10px] px-1.5 py-0 rounded-xl text-white flex-shrink-0", SITE_TYPE_COLORS[site.type] || "bg-slate-500")}>
                      {SITE_TYPE_LABELS[site.type] || site.type}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {selectedState && filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground">{filtered.length} site{filtered.length !== 1 ? "s" : ""} found in {USA_STATES.find(s => s.abbr === selectedState)?.name}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const formSchema = z.object({
  materialType: z.nativeEnum(JobRequestInputMaterialType, {
    required_error: "Please select a material type.",
  }),
  truckType: z.nativeEnum(JobRequestInputTruckType, {
    required_error: "Please select a truck type.",
  }),
  quantityTons: z.coerce.number().positive("Quantity must be positive."),
  pickupAddress: z.string().min(5, "Pickup address is required."),
  deliveryAddress: z.string().min(5, "Delivery address is required."),
  scheduledDate: z.date({
    required_error: "A scheduled date is required.",
  }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format (e.g. 07:30)."),
  estimatedHours: z.coerce.number().min(0.5, "Must be at least 0.5 hours."),
  trucksNeeded: z.coerce.number().int().positive("Must request at least 1 truck."),
  budgetPerHour: z.coerce.number().positive().optional().or(z.literal("")),
  notes: z.string().optional(),
});

function useReverseGeocode() {
  const [geoLoading, setGeoLoading] = useState(false);

  const getAddressFromLocation = useCallback(async (): Promise<string | null> => {
    if (!navigator.geolocation) return null;
    setGeoLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      const { latitude, longitude } = pos.coords;
      const resp = await fetch("/api/maps/reverse-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lat: latitude, lng: longitude }),
      });
      if (!resp.ok) return null;
      const data = (await resp.json()) as { formattedAddress?: string };
      return data.formattedAddress ?? null;
    } catch {
      return null;
    } finally {
      setGeoLoading(false);
    }
  }, []);

  return { getAddressFromLocation, geoLoading };
}

export default function NewRequestPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createRequest = useCreateRequest();
  const { getAddressFromLocation, geoLoading } = useReverseGeocode();

  const handleUseMyLocation = async () => {
    const addr = await getAddressFromLocation();
    if (addr) {
      form.setValue("pickupAddress", addr, { shouldValidate: true });
      toast({ title: "Location detected", description: addr });
    } else {
      toast({
        title: "Could not detect location",
        description: "Please allow location access or type the address manually.",
        variant: "destructive",
      });
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      materialType: undefined,
      truckType: undefined,
      quantityTons: "" as any,
      pickupAddress: "",
      deliveryAddress: "",
      startTime: "07:00",
      estimatedHours: "" as any,
      trucksNeeded: 1,
      budgetPerHour: "" as any,
      notes: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const payload = {
      ...values,
      scheduledDate: values.scheduledDate.toISOString(),
      budgetPerHour: values.budgetPerHour === "" ? undefined : Number(values.budgetPerHour),
    };

    createRequest.mutate(
      { data: payload },
      {
        onSuccess: (data) => {
          toast({ title: "Job request posted successfully" });
          setLocation(`/requests/${data.id}`);
        },
        onError: (err) => {
          toast({
            title: "Failed to post request",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive"
          });
        }
      }
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 page-enter pb-12">
      <div>
        <Button variant="ghost" className="mb-2 -ml-4" onClick={() => setLocation("/requests")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Requests
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Post Job Request</h1>
        <p className="text-muted-foreground">
          Detail the haul requirements so truck fleets can place accurate bids.
        </p>
      </div>

      <div className="bg-card border border-border/60 shadow-sm p-6 md:p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Cargo & Schedule */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-bold border-b-2 border-border pb-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Cargo & Schedule
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="truckType"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Truck Type <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 border-2 rounded-xl focus:ring-primary">
                              <SelectValue placeholder="Select truck type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="border-2 rounded-xl max-h-[240px]">
                            {Object.values(JobRequestInputTruckType).map((type) => (
                              <SelectItem key={type} value={type} className="capitalize">
                                {type.replace(/_/g, " ")}
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
                    name="materialType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Material <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 border-2 rounded-xl focus:ring-primary">
                              <SelectValue placeholder="Select material" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="border-2 rounded-xl">
                            {Object.values(JobRequestInputMaterialType).map(type => (
                              <SelectItem key={type} value={type} className="capitalize">
                                {type.replace('_', ' ')}
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
                    name="quantityTons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity (Tons) <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="1000" {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="time" {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary" />
                        </FormControl>
                        <FormDescription>Local time trucks should arrive on site.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estimatedHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Hours <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="number" min="0.5" step="0.5" placeholder="8" {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end">
                        <FormLabel className="mb-2">Date Needed <span className="text-destructive">*</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "h-12 border-2 rounded-xl pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 border-2 rounded-xl" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="trucksNeeded"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trucks Needed <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} className="h-12 border-2 rounded-xl focus-visible:ring-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="budgetPerHour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Rate ($/Hour)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input type="number" placeholder="120" {...field} className="h-12 pl-8 border-2 rounded-xl focus-visible:ring-primary" />
                        </div>
                      </FormControl>
                      <FormDescription>Leave blank to accept open bids.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right Column: Routing & Details */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-lg font-bold border-b-2 border-border pb-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Routing & Details
                </div>

                {/* Pickup Address */}
                <FormField
                  control={form.control}
                  name="pickupAddress"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                        <FormLabel>
                          Pickup Address <span className="text-destructive">*</span>
                        </FormLabel>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs rounded-xl border-2 border-blue-500/50 text-blue-600 hover:bg-blue-50 gap-1.5"
                            onClick={handleUseMyLocation}
                            disabled={geoLoading}
                          >
                            {geoLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Navigation className="h-3.5 w-3.5" />
                            )}
                            {geoLoading ? "Detecting…" : "Use My Location"}
                          </Button>
                          <DumpSitePicker
                            label="Pickup"
                            onSelect={(addr) => form.setValue("pickupAddress", addr, { shouldValidate: true })}
                          />
                        </div>
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Acme Quarry, 123 Main St, Houston, TX 77001"
                          className="min-h-[80px] border-2 rounded-xl focus-visible:ring-primary resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Delivery Address */}
                <FormField
                  control={form.control}
                  name="deliveryAddress"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between mb-1">
                        <FormLabel>
                          Delivery Address <span className="text-destructive">*</span>
                        </FormLabel>
                        <DumpSitePicker
                          label="Delivery"
                          onSelect={(addr) => form.setValue("deliveryAddress", addr, { shouldValidate: true })}
                        />
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. Apex Landfill, 4250 Losee Rd, North Las Vegas, NV 89030"
                          className="min-h-[80px] border-2 rounded-xl focus-visible:ring-primary resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Instructions</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Site access codes, specific truck types needed, etc."
                          className="min-h-[80px] border-2 rounded-xl focus-visible:ring-primary resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="pt-6 border-t-2 border-border flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                className="h-12 px-6 font-bold rounded-xl border-2"
                onClick={() => setLocation("/requests")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-12 px-8 font-bold rounded-xl"
                disabled={createRequest.isPending}
                data-testid="btn-submit-request"
              >
                {createRequest.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting...</>
                ) : (
                  "Post Job Request"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
