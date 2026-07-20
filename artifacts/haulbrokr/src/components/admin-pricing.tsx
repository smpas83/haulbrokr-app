import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Percent, Fuel, Save, Plus, Trash2 } from "lucide-react";
import {
  useGetAdminPricing,
  useUpdateAdminPricingSettings,
  useUpsertFuelSurchargeWeek,
  useDeleteFuelSurchargeWeek,
  getGetAdminPricingQueryKey,
  type PricingSetting,
  type FuelSurchargeWeek,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const SETTING_LABELS: Record<string, string> = {
  marketplace_fee_rate: "Customer marketplace fee",
  marketplace_fee_basis: "Fee basis (0 = base haul only, 1 = base + surcharges)",
  fuel_surcharge_rate: "Fallback fuel surcharge rate",
  emergency_dispatch_rate: "Emergency surcharge rate",
  holiday_surcharge_rate: "Holiday surcharge rate",
  wait_time_rate_per_hour: "Wait-time rate ($/hr)",
  wait_time_grace_period_minutes: "Wait-time grace period (minutes)",
  tax_rate: "Default tax rate",
  tax_enabled: "Taxes enabled (1 = yes, 0 = no)",
};

function formatRateDisplay(key: string, value: number): string {
  if (key === "wait_time_rate_per_hour") return `$${value.toFixed(2)}/hr`;
  if (key === "wait_time_grace_period_minutes") return `${value} min`;
  if (key === "tax_enabled") return value >= 1 ? "Enabled" : "Disabled";
  if (key === "marketplace_fee_basis") {
    return value >= 1 ? "Base haul + surcharges" : "Base haul only";
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function AdminPricing({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const pricing = useGetAdminPricing({
    query: { enabled, queryKey: getGetAdminPricingQueryKey() },
  });
  const updateSettings = useUpdateAdminPricingSettings();
  const upsertFuel = useUpsertFuelSurchargeWeek();
  const deleteFuel = useDeleteFuelSurchargeWeek();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [weekStart, setWeekStart] = useState("");
  const [weekRate, setWeekRate] = useState("");
  const [weekDiesel, setWeekDiesel] = useState("");
  const [weekNotes, setWeekNotes] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetAdminPricingQueryKey() });

  if (!enabled) return null;
  if (pricing.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (pricing.isError || !pricing.data) {
    return (
      <Card className="rounded-xl border-2">
        <CardHeader>
          <CardTitle>Pricing unavailable</CardTitle>
          <CardDescription>Could not load marketplace pricing settings.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const settings = pricing.data.settings;
  const weeks = pricing.data.fuelSurchargeWeeks;
  const active = pricing.data.activeRates;

  const draftValue = (s: PricingSetting) =>
    drafts[s.key] !== undefined ? drafts[s.key] : String(s.value);

  const saveSettings = () => {
    const payload = settings
      .map((s) => {
        const raw = drafts[s.key];
        if (raw === undefined) return null;
        const value = parseFloat(raw);
        if (!Number.isFinite(value)) return null;
        if (value === s.value) return null;
        return { key: s.key, value };
      })
      .filter(Boolean) as Array<{ key: string; value: number }>;

    if (payload.length === 0) {
      toast({ title: "No changes to save" });
      return;
    }

    updateSettings.mutate(
      { data: { settings: payload } },
      {
        onSuccess: () => {
          setDrafts({});
          invalidate();
          toast({ title: "Pricing settings updated" });
        },
        onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  const addFuelWeek = () => {
    const surchargeRate = parseFloat(weekRate);
    if (!weekStart || !Number.isFinite(surchargeRate)) {
      toast({ title: "Week start date and surcharge rate are required", variant: "destructive" });
      return;
    }
    upsertFuel.mutate(
      {
        data: {
          weekStartDate: weekStart,
          surchargeRate,
          ...(weekDiesel ? { nationalDieselPrice: parseFloat(weekDiesel) } : {}),
          ...(weekNotes ? { notes: weekNotes } : {}),
          isActive: true,
        },
      },
      {
        onSuccess: () => {
          setWeekStart("");
          setWeekRate("");
          setWeekDiesel("");
          setWeekNotes("");
          invalidate();
          toast({ title: "Fuel surcharge week saved" });
        },
        onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  const removeWeek = (week: FuelSurchargeWeek) => {
    deleteFuel.mutate(
      { id: week.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Fuel surcharge week removed" });
        },
        onError: (err: Error) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" /> Active customer marketplace rates
          </CardTitle>
          <CardDescription>
            The customer marketplace fee is charged to the customer only. Carrier payouts are never reduced by this fee.
            Percentages are loaded from the database — not hardcoded in checkout or settlement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Customer marketplace fee</p>
            <p className="text-lg font-bold tabular-nums mt-1">{(Number(active.marketplaceFeeRate) * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Fee basis</p>
            <p className="text-lg font-bold mt-1">
              {(active as { marketplaceFeeBasis?: string }).marketplaceFeeBasis === "base_plus_surcharges"
                ? "Base + surcharges"
                : "Base haul only"}
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Fuel surcharge</p>
            <p className="text-lg font-bold tabular-nums mt-1">{(Number(active.fuelSurchargeRate) * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Emergency surcharge</p>
            <p className="text-lg font-bold tabular-nums mt-1">{(Number(active.emergencyDispatchRate) * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Holiday surcharge</p>
            <p className="text-lg font-bold tabular-nums mt-1">{(Number(active.holidaySurchargeRate) * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Wait time $/hr</p>
            <p className="text-lg font-bold tabular-nums mt-1">${Number(active.waitTimeRatePerHour).toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Wait grace (min)</p>
            <p className="text-lg font-bold tabular-nums mt-1">
              {Number((active as { waitTimeGracePeriodMinutes?: number }).waitTimeGracePeriodMinutes ?? 15)}
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Tax rate</p>
            <p className="text-lg font-bold tabular-nums mt-1">{(Number(active.taxRate) * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Taxes</p>
            <p className="text-lg font-bold mt-1">{active.taxesEnabled ? "Enabled" : "Disabled"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-2">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Configurable pricing variables</CardTitle>
            <CardDescription>
              Label the marketplace percentage as a customer fee only — never as a carrier, vendor, fleet, or provider commission.
            </CardDescription>
          </div>
          <Button className="rounded-xl font-bold shrink-0" onClick={saveSettings} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save changes
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.map((s) => (
            <div key={s.key} className="grid sm:grid-cols-[1fr_160px_140px] gap-3 items-end border-b border-border/60 pb-4 last:border-0 last:pb-0">
              <div>
                <Label className="font-medium">{SETTING_LABELS[s.key] ?? s.key}</Label>
                <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Value</Label>
                <Input
                  className="rounded-xl mt-1 tabular-nums"
                  value={draftValue(s)}
                  onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                />
              </div>
              <div className="pb-2">
                <Badge variant="outline" className="rounded-xl">{formatRateDisplay(s.key, s.value)}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5 text-primary" /> Weekly national diesel fuel surcharge
          </CardTitle>
          <CardDescription>
            Publish a surcharge rate and optional national diesel $/gal reference for each week.
            The rate in effect at booking/completion is frozen onto the job so historical invoices do not change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <Label>Week start (YYYY-MM-DD)</Label>
              <Input className="rounded-xl mt-1" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
            <div>
              <Label>Surcharge rate (decimal)</Label>
              <Input className="rounded-xl mt-1" placeholder="0.05" value={weekRate} onChange={(e) => setWeekRate(e.target.value)} />
            </div>
            <div>
              <Label>National diesel ($/gal)</Label>
              <Input className="rounded-xl mt-1" placeholder="3.850" value={weekDiesel} onChange={(e) => setWeekDiesel(e.target.value)} />
            </div>
            <div>
              <Label>Notes / source</Label>
              <Input className="rounded-xl mt-1" placeholder="EIA weekly" value={weekNotes} onChange={(e) => setWeekNotes(e.target.value)} />
            </div>
            <Button className="rounded-xl font-bold" onClick={addFuelWeek} disabled={upsertFuel.isPending}>
              {upsertFuel.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add / update
            </Button>
          </div>

          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {weeks.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No weekly fuel surcharge rows yet. Add one above.</p>
            )}
            {weeks.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium tabular-nums">
                    Week of {w.weekStartDate} · {(w.surchargeRate * 100).toFixed(2)}%
                    {w.nationalDieselPrice != null ? ` · diesel $${w.nationalDieselPrice.toFixed(3)}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {w.isActive ? "Active" : "Inactive"}
                    {w.notes ? ` · ${w.notes}` : ""}
                    {w.updatedAt ? ` · updated ${new Date(w.updatedAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => removeWeek(w)}
                  disabled={deleteFuel.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-2">
        <CardHeader>
          <CardTitle>Enterprise overrides, promotions &amp; audit</CardTitle>
          <CardDescription>
            Platform defaults apply unless an enterprise or promotional override is configured by operations.
            Each setting and fuel-week row stores an updatedAt timestamp for audit. Job completion freezes the
            rates used so historical invoices and carrier settlements do not change when defaults are edited later.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <span className="font-medium text-foreground">Enterprise / custom volume pricing:</span>{" "}
            negotiated outside the public site; account managers apply overrides via pricing settings or
            contract-specific job amounts before confirmation.
          </p>
          <p>
            <span className="font-medium text-foreground">Promotional overrides:</span>{" "}
            temporary fee or surcharge changes are made by updating the Customer marketplace fee / surcharge
            settings with an effective window communicated to customers in quote/checkout.
          </p>
          <p>
            <span className="font-medium text-foreground">Effective dates:</span>{" "}
            weekly fuel surcharge rows are date-keyed; marketplace fee changes take effect for new completions
            after save (existing jobs keep frozen amounts).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
