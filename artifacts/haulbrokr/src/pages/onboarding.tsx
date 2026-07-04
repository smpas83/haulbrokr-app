import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Building2, Truck, Loader2, User } from "lucide-react";
import { buildCreateProfilePayload } from "@/lib/onboardingPayload";
import { useCreateProfile, useGetMyProfile } from "@workspace/api-client-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const emailOptional = z
  .string()
  .email("Enter a valid email address.")
  .optional()
  .or(z.literal(""));

const formSchema = z
  .object({
    role: z.enum(["customer", "provider", "driver"], {
      required_error: "Please select a role.",
    }),
    inviteCode: z.string().optional(),
    companyName: z.string().optional(),
    contactName: z.string().optional(),
    phone: z.string().optional(),
    email: emailOptional,
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    // Carrier / provider
    dba: z.string().optional(),
    website: z.string().optional(),
    mcNumber: z.string().optional(),
    capacityTons: z.string().optional(),
    capacityYards: z.string().optional(),
    countiesServed: z.string().optional(),
    hourlyRate: z.string().optional(),
    minimumHours: z.string().optional(),
    equipmentTypes: z.array(z.string()).optional(),
    // Customer
    billingEinLast4: z.string().optional(),
    apContactName: z.string().optional(),
    apEmail: emailOptional,
    paymentTerms: z
      .enum(["due_on_receipt", "net_15", "net_30", "prepaid"])
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "driver") {
      if (!data.inviteCode?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter the invite code your manager shared with you.",
          path: ["inviteCode"],
        });
      }
    } else if (!data.companyName || data.companyName.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Company name must be at least 2 characters.",
        path: ["companyName"],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;

const EQUIPMENT_TYPES: { value: string; label: string }[] = [
  { value: "standard", label: "Standard Dump" },
  { value: "super_10", label: "Super 10" },
  { value: "end_dump", label: "End Dump" },
  { value: "belly_dump", label: "Belly Dump" },
  { value: "side_dump", label: "Side Dump" },
  { value: "bottom_dump", label: "Bottom Dump" },
  { value: "transfer", label: "Transfer" },
  { value: "articulated", label: "Articulated" },
  { value: "dump_truck", label: "Dump Truck" },
  { value: "lowboy", label: "Lowboy" },
  { value: "water_truck", label: "Water Truck" },
  { value: "excavator", label: "Excavator" },
  { value: "dozer", label: "Dozer" },
  { value: "skid_steer", label: "Skid Steer" },
];

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createProfile = useCreateProfile();

  const { data: profile, isLoading } = useGetMyProfile();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: undefined,
      inviteCode: "",
      companyName: "",
      contactName: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      dba: "",
      website: "",
      mcNumber: "",
      capacityTons: "",
      capacityYards: "",
      countiesServed: "",
      hourlyRate: "",
      minimumHours: "",
      equipmentTypes: [],
      billingEinLast4: "",
      apContactName: "",
      apEmail: "",
      paymentTerms: undefined,
    },
  });

  // Redirect if already onboarded
  if (!isLoading && profile) {
    setLocation("/dashboard");
    return null;
  }

  function onSubmit(values: FormValues) {
    createProfile.mutate(
      { data: buildCreateProfilePayload(values) as never },
      {
        onSuccess: () => {
          toast({ title: "Profile created successfully" });
          setLocation("/dashboard");
        },
        onError: (err) => {
          toast({
            title: "Error creating profile",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        },
      },
    );
  }

  const selectedRole = form.watch("role");
  const isProvider = selectedRole === "provider";
  const isDriver = selectedRole === "driver";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="surface-panel rounded-2xl w-full max-w-2xl overflow-hidden">
        <Card className="w-full border-0 shadow-none bg-transparent rounded-none">
          <div className="h-1 bg-primary w-full" />
          <CardHeader className="space-y-1 pb-8 text-center pt-10">
            <div className="mx-auto bg-primary/10 w-16 h-16 flex items-center justify-center rounded-2xl mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              Complete your profile
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Select your role to configure mission control for your workflow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div
                          className={`border-2 p-6 rounded-xl cursor-pointer transition-all duration-200 ${
                            field.value === "customer"
                              ? "border-primary bg-primary/5 shadow-md"
                              : "border-border hover:border-primary/30 hover:bg-muted"
                          }`}
                          onClick={() => field.onChange("customer")}
                        >
                          <Building2
                            className={`w-8 h-8 mb-4 ${field.value === "customer" ? "text-primary" : "text-muted-foreground"}`}
                          />
                          <h3 className="font-bold text-lg mb-2">
                            I need trucks
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            I manage construction sites and need to hire dump
                            trucks for hauling material.
                          </p>
                        </div>

                        <div
                          className={`border-2 p-6 rounded-xl cursor-pointer transition-all duration-200 ${
                            field.value === "provider"
                              ? "border-primary bg-primary/5 shadow-md"
                              : "border-border hover:border-primary/30 hover:bg-muted"
                          }`}
                          onClick={() => field.onChange("provider")}
                        >
                          <Truck
                            className={`w-8 h-8 mb-4 ${field.value === "provider" ? "text-primary" : "text-muted-foreground"}`}
                          />
                          <h3 className="font-bold text-lg mb-2">
                            I have trucks
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            I operate a fleet of dump trucks and want to find
                            active hauling jobs.
                          </p>
                        </div>

                        <div
                          className={`border-2 p-6 rounded-xl cursor-pointer transition-all duration-200 ${
                            field.value === "driver"
                              ? "border-primary bg-primary/5 shadow-md"
                              : "border-border hover:border-primary/30 hover:bg-muted"
                          }`}
                          onClick={() => field.onChange("driver")}
                        >
                          <User
                            className={`w-8 h-8 mb-4 ${field.value === "driver" ? "text-primary" : "text-muted-foreground"}`}
                          />
                          <h3 className="font-bold text-lg mb-2">
                            I&apos;m a driver
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            I drive for a hauling company and need to check in,
                            upload tickets, and report status.
                          </p>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedRole && (
                  <div className="space-y-8 pt-4 border-t border-border animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {isDriver ? (
                      <div className="space-y-4">
                        <h3 className="font-semibold text-lg">
                          Join Your Team
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Enter the invite code from your dispatcher or fleet
                          manager. You&apos;ll be linked to their company
                          automatically.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="inviteCode"
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>
                                  Invite Code{" "}
                                  <span className="text-destructive">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="ABC123"
                                    {...field}
                                    className="h-12 bg-background font-mono uppercase tracking-widest"
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value.toUpperCase(),
                                      )
                                    }
                                  />
                                </FormControl>
                                <FormDescription>
                                  Ask your manager for the 6-character code from
                                  the Company page.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="contactName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Your Name</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Jane Doe"
                                    {...field}
                                    className="h-12 bg-background"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="(555) 123-4567"
                                    {...field}
                                    className="h-12 bg-background"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Company details (shared) */}
                        <div className="space-y-4">
                          <h3 className="font-semibold text-lg">
                            Company Details
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="companyName"
                              render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                  <FormLabel>
                                    {isProvider
                                      ? "Trucking Company"
                                      : "Company Name"}{" "}
                                    <span className="text-destructive">*</span>
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder={
                                        isProvider
                                          ? "MW Hauling LLC"
                                          : "Acme Construction"
                                      }
                                      {...field}
                                      className="h-12 bg-background"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {isProvider && (
                              <>
                                <FormField
                                  control={form.control}
                                  name="dba"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>DBA (optional)</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="Doing business as…"
                                          {...field}
                                          className="h-12 bg-background"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="website"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Website</FormLabel>
                                      <FormControl>
                                        <Input
                                          placeholder="https://…"
                                          {...field}
                                          className="h-12 bg-background"
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </>
                            )}

                            <FormField
                              control={form.control}
                              name="contactName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Contact Name</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Jane Doe"
                                      {...field}
                                      className="h-12 bg-background"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone Number</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="(555) 123-4567"
                                      {...field}
                                      className="h-12 bg-background"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="ops@company.com"
                                      {...field}
                                      className="h-12 bg-background"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="address"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Street Address</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="123 Main St"
                                      {...field}
                                      className="h-12 bg-background"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder="Austin"
                                      {...field}
                                      className="h-12 bg-background"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="state"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>State</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="TX"
                                        {...field}
                                        className="h-12 bg-background"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="zip"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>ZIP</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="78701"
                                        {...field}
                                        className="h-12 bg-background"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Carrier-specific */}
                        {isProvider && (
                          <div className="space-y-4">
                            <h3 className="font-semibold text-lg">
                              Carrier & Equipment
                            </h3>
                            <p className="text-sm text-muted-foreground -mt-2">
                              Authority and capacity help us match you to the
                              right loads.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="mcNumber"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>MC Number</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="MC-123456"
                                        {...field}
                                        className="h-12 bg-background font-mono"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="countiesServed"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Counties Served</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Travis, Williamson, Hays"
                                        {...field}
                                        className="h-12 bg-background"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="capacityTons"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Capacity (tons)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="20"
                                        {...field}
                                        className="h-12 bg-background"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="capacityYards"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Capacity (cubic yards)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="16"
                                        {...field}
                                        className="h-12 bg-background"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="hourlyRate"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Hourly Rate ($/hr)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="125"
                                        {...field}
                                        className="h-12 bg-background"
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Your full work value. HaulBrokr's fee is
                                      added on top for customers.
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="minimumHours"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Minimum Hours</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        inputMode="numeric"
                                        placeholder="4"
                                        {...field}
                                        className="h-12 bg-background"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={form.control}
                              name="equipmentTypes"
                              render={({ field }) => {
                                const selected = field.value ?? [];
                                const toggle = (val: string) =>
                                  field.onChange(
                                    selected.includes(val)
                                      ? selected.filter((v) => v !== val)
                                      : [...selected, val],
                                  );
                                return (
                                  <FormItem>
                                    <FormLabel>Equipment Operated</FormLabel>
                                    <FormDescription>
                                      Select every truck and machine type you
                                      run. We use this to match you to
                                      compatible loads.
                                    </FormDescription>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      {EQUIPMENT_TYPES.map((eq) => {
                                        const active = selected.includes(
                                          eq.value,
                                        );
                                        return (
                                          <button
                                            type="button"
                                            key={eq.value}
                                            onClick={() => toggle(eq.value)}
                                            className={`px-3 py-2 rounded-full border-2 text-sm font-medium transition-colors ${
                                              active
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-border bg-background text-muted-foreground hover:border-primary/40"
                                            }`}
                                          >
                                            {eq.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />
                          </div>
                        )}

                        {/* Customer-specific billing */}
                        {!isProvider && (
                          <div className="space-y-4">
                            <h3 className="font-semibold text-lg">
                              Billing & Accounts Payable
                            </h3>
                            <p className="text-sm text-muted-foreground -mt-2">
                              Used for invoicing. Net terms require an approved
                              credit application.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="billingEinLast4"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>EIN (last 4)</FormLabel>
                                    <FormControl>
                                      <Input
                                        maxLength={4}
                                        placeholder="1234"
                                        {...field}
                                        className="h-12 bg-background font-mono"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="paymentTerms"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      Preferred Payment Terms
                                    </FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="h-12 bg-background">
                                          <SelectValue placeholder="Select terms" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="prepaid">
                                          Prepaid
                                        </SelectItem>
                                        <SelectItem value="due_on_receipt">
                                          Due on receipt
                                        </SelectItem>
                                        <SelectItem value="net_15">
                                          Net 15
                                        </SelectItem>
                                        <SelectItem value="net_30">
                                          Net 30
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="apContactName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>A/P Contact Name</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Accounts Payable"
                                        {...field}
                                        className="h-12 bg-background"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="apEmail"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>A/P Email</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="ap@company.com"
                                        {...field}
                                        className="h-12 bg-background"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-bold"
                  disabled={!selectedRole || createProfile.isPending}
                >
                  {createProfile.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Complete Setup"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
