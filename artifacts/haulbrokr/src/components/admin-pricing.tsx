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
  marketplace_fee_rate: "Marketplace fee rate",
  fuel_surcharge_rate: "Fallback fuel surcharge rate",
  emergency_dispatch_rate: "Emergency dispatch rate",
  holiday_surcharge_rate: "Holiday surcharge rate",
  wait_time_rate_per_hour: "Wait time rate ($/hr)",
  tax_rate: "Default tax rate",
  tax_enabled: "Taxes enabled (1 = yes, 0 = no)",
};

function formatRateDisplay(key: string, value: number): string {
  if (key === "wait_time_rate_per_hour") return `$${value.toFixed(2)}/hr`;
  if (key === "tax_enabled") return value >= 1 ? "Enabled" : "Disabled";
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
            <Percent className="h-5 w-5 text-primary" /> Active marketplace rates
          </CardTitle>
          <CardDescription>
            Resolved from configurable settings and the current weekly diesel schedule. No pricing percentages are hardcoded in checkout or settlement.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            ["Marketplace fee", active.marketplaceFeeRate],
            ["Fuel surcharge", active.fuelSurchargeRate],
            ["Emergency dispatch", active.emergencyDispatchRate],
            ["Holiday surcharge", active.holidaySurchargeRate],
            ["Wait time $/hr", active.waitTimeRatePerHour],
            ["Tax rate", active.taxRate],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-lg font-bold tabular-nums mt-1">
                {label === "Wait time $/hr"
                  ? `$${Number(value).toFixed(2)}`
                  : `${(Number(value) * 100).toFixed(2)}%`}
              </p>
            </div>
          ))}
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
            <CardDescription>Rates are stored in the database and applied by the centralized pricing engine.</CardDescription>
          </div>
          <Button className="rounded-xl font-bold shrink-0" onClick={saveSettings} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save changes
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.map((s) => (
            <div key={s.key} className="grid sm:grid-cols-[1fr_160px_120px] gap-3 items-end border-b border-border/60 pb-4 last:border-0 last:pb-0">
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
            Publish a surcharge rate for each week. The pricing engine uses the most recent active week on or before today.
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
              <Label>Notes</Label>
              <Input className="rounded-xl mt-1" value={weekNotes} onChange={(e) => setWeekNotes(e.target.value)} />
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
    </div>
  );
}
