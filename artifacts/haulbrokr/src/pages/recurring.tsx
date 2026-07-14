import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, Plus, Pause, Play, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Schedule = {
  id: number;
  name: string;
  status: string;
  recurrenceType: string;
  timezone: string;
  pickupAddress: string;
  deliveryAddress: string;
  startDate: string;
  endDate?: string | null;
  lastGeneratedForDate?: string | null;
  lastError?: string | null;
};

export default function RecurringPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    recurrenceType: "weekly",
    timezone: "America/Chicago",
    materialType: "dirt",
    truckType: "dump_truck",
    quantityTons: "20",
    pickupAddress: "",
    deliveryAddress: "",
    startDate: new Date().toISOString().slice(0, 10),
    startTime: "08:00",
  });

  async function refresh() {
    setLoading(true);
    try {
      const data = await apiFetch<Schedule[]>("/recurring-schedules");
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({
        title: "Failed to load schedules",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createSchedule() {
    setCreating(true);
    try {
      await apiFetch("/recurring-schedules", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          daysOfWeek: form.recurrenceType === "weekly" ? [1, 2, 3, 4, 5] : [],
          holidayBehavior: "skip",
          generateHorizonDays: 14,
        }),
      });
      toast({ title: "Recurring schedule created" });
      setForm((f) => ({
        ...f,
        name: "",
        pickupAddress: "",
        deliveryAddress: "",
      }));
      await refresh();
    } catch (err: any) {
      toast({
        title: "Could not create schedule",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: number, action: "pause" | "resume" | "cancel") {
    try {
      await apiFetch(`/recurring-schedules/${id}/${action}`, {
        method: "POST",
        body: "{}",
      });
      await refresh();
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto page-enter">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recurring Hauls</h1>
        <p className="text-muted-foreground">
          Configure repeating haul requests. The worker creates future open
          requests without copying driver assignment, tickets, POD, invoice, or
          payment state.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New recurring schedule</CardTitle>
          <CardDescription>
            Timezone-aware generation with holiday skip and duplicate
            prevention.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Weekday dirt haul"
            />
          </div>
          <div className="space-y-2">
            <Label>Recurrence</Label>
            <Select
              value={form.recurrenceType}
              onValueChange={(v) => setForm({ ...form, recurrenceType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly (weekdays)</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pickup address</Label>
            <Input
              value={form.pickupAddress}
              onChange={(e) =>
                setForm({ ...form, pickupAddress: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Delivery address</Label>
            <Input
              value={form.deliveryAddress}
              onChange={(e) =>
                setForm({ ...form, deliveryAddress: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Quantity (tons)</Label>
            <Input
              value={form.quantityTons}
              onChange={(e) =>
                setForm({ ...form, quantityTons: e.target.value })
              }
            />
          </div>
          <div className="md:col-span-2">
            <Button
              onClick={() => void createSchedule()}
              disabled={
                creating ||
                !form.name ||
                !form.pickupAddress ||
                !form.deliveryAddress
              }
            >
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create schedule
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your schedules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No recurring schedules yet. Create one above or start from{" "}
              <Link href="/requests/new" className="underline">
                New Request
              </Link>
              .
            </p>
          )}
          {rows.map((s) => (
            <div
              key={s.id}
              className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-sm text-muted-foreground">
                  {s.recurrenceType} · {s.status} · {s.timezone}
                  {s.lastGeneratedForDate
                    ? ` · last generated ${s.lastGeneratedForDate}`
                    : ""}
                </div>
                <div className="text-sm text-muted-foreground">
                  {s.pickupAddress} → {s.deliveryAddress}
                </div>
                {s.lastError && (
                  <div className="text-sm text-destructive mt-1">
                    {s.lastError}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {s.status === "active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setStatus(s.id, "pause")}
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                ) : s.status === "paused" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setStatus(s.id, "resume")}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </Button>
                ) : null}
                {s.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void setStatus(s.id, "cancel")}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
