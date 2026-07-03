import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { useGetMyProfile, useListJobs, getListJobsQueryKey } from "@workspace/api-client-react";

import { DriverLoadCard } from "@/components/driver/DriverLoadCard";
import {
  AppLoader,
  EmptyState,
  OfflineBanner,
  PageHeader,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useDriverAssignedJobIds } from "@/hooks/useDriverAssignedJobs";
import {
  applyDriverJobFilters,
  categorizeDriverJob,
  redactJobForDriver,
  type DriverJobFilters,
  type DriverLoadSection,
  uniqueFilterValues,
} from "@/lib/driverJobView";
import { apiFetch } from "@/lib/apiFetch";

const SECTIONS: { key: DriverLoadSection; label: string; description: string }[] = [
  { key: "available", label: "Available Loads", description: "Fleet loads you can pick up" },
  { key: "accepted", label: "Accepted Loads", description: "Assigned and ready to start" },
  { key: "in_progress", label: "In Progress", description: "Loads you're hauling now" },
  { key: "completed", label: "Completed", description: "Finished loads" },
];

export default function DriverJobsBoard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const {
    data: jobs,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useListJobs();
  const { data: assignedJobIds, isLoading: ticketsLoading } = useDriverAssignedJobIds(jobs, profile?.id);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<DriverJobFilters>({
    material: "all",
    truckType: "all",
    facility: "all",
    status: "all",
    minPay: undefined,
    maxPay: undefined,
    maxDeadlineDays: undefined,
  });

  const safeJobs = useMemo(() => (jobs ?? []).map(redactJobForDriver), [jobs]);
  const assignedIds = assignedJobIds ?? new Set<number>();
  const filterOptions = useMemo(() => uniqueFilterValues(safeJobs), [safeJobs]);

  const sectionJobs = useMemo(() => {
    const grouped: Record<DriverLoadSection, typeof safeJobs> = {
      available: [],
      accepted: [],
      in_progress: [],
      completed: [],
    };

    for (const job of safeJobs) {
      const section = categorizeDriverJob(job, assignedIds);
      if (section) grouped[section].push(job);
    }

    for (const key of SECTIONS.map((s) => s.key)) {
      grouped[key] = applyDriverJobFilters(grouped[key], filters);
    }

    return grouped;
  }, [safeJobs, assignedIds, filters]);

  const handleAccept = async (jobId: number) => {
    setAcceptingId(jobId);
    try {
      await apiFetch(`/jobs/${jobId}/tickets`, { method: "POST", body: JSON.stringify({}) });
      toast({ title: "Load accepted", description: "You're assigned to this load. Head to job details to check in." });
      await qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
      await qc.invalidateQueries({ queryKey: ["driver-assigned-jobs"] });
    } catch (err) {
      toast({
        title: "Couldn't accept load",
        description: err instanceof Error ? err.message : "Contact your dispatcher for assignment.",
        variant: "destructive",
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (isLoading || ticketsLoading) {
    return <AppLoader label="Loading load board…" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-in fade-in duration-500 motion-reduce:animate-none">
      {(isOffline || isError) && <OfflineBanner onRetry={() => refetch()} />}

      <PageHeader
        title="Load Board"
        description="Browse assigned and available loads. Pay shown is driver pay only."
      />

      <FiltersBar filters={filters} onChange={setFilters} options={filterOptions} />

      <Tabs defaultValue="available" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-none border-2 border-border bg-muted/30 p-2 md:grid-cols-4">
          {SECTIONS.map((section) => (
            <TabsTrigger
              key={section.key}
              value={section.key}
              className="h-12 rounded-none font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {section.label}
              <span className="ml-2 text-xs opacity-80">({sectionJobs[section.key].length})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {SECTIONS.map((section) => (
          <TabsContent key={section.key} value={section.key} className="space-y-4">
            <p className="text-sm text-muted-foreground">{section.description}</p>
            {isFetching ? (
              <div className="grid gap-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-56 w-full rounded-none" />
                ))}
              </div>
            ) : sectionJobs[section.key].length ? (
              <div className="grid gap-4">
                {sectionJobs[section.key].map((job) => (
                  <DriverLoadCard
                    key={job.id}
                    job={job}
                    section={section.key}
                    onAccept={section.key === "available" ? () => handleAccept(job.id) : undefined}
                    acceptPending={acceptingId === job.id}
                    facilityInstructions={
                      job.deliveryAddress
                        ? `Deliver to ${job.deliveryAddress}. Follow site check-in procedures.`
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Briefcase className="h-12 w-12 opacity-40" aria-hidden />}
                title={`No ${section.label.toLowerCase()}`}
                description={
                  section.key === "available"
                    ? "When dispatch posts new fleet loads, they'll appear here."
                    : "Loads in this stage will show up once assigned or updated."
                }
                action={
                  isError ? (
                    <Button className="rounded-none font-bold" onClick={() => refetch()}>
                      Retry
                    </Button>
                  ) : undefined
                }
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <div className="sticky bottom-20 z-30 md:hidden">
        <Button className="h-14 w-full rounded-none font-bold shadow-lg" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? "Refreshing…" : "Refresh Load Board"}
        </Button>
      </div>
    </div>
  );
}

function FiltersBar({
  filters,
  onChange,
  options,
}: {
  filters: DriverJobFilters;
  onChange: (next: DriverJobFilters) => void;
  options: ReturnType<typeof uniqueFilterValues>;
}) {
  return (
    <div className="grid gap-3 rounded-none border-2 border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <FilterSelect
        label="Material"
        value={filters.material ?? "all"}
        onValueChange={(material) => onChange({ ...filters, material })}
        options={[{ value: "all", label: "All materials" }, ...options.materials.map((m) => ({ value: m, label: m }))]}
      />
      <FilterSelect
        label="Truck type"
        value={filters.truckType ?? "all"}
        onValueChange={(truckType) => onChange({ ...filters, truckType })}
        options={[
          { value: "all", label: "All types" },
          ...options.truckTypes.map((t) => ({ value: t, label: t.replace(/_/g, " ") })),
        ]}
      />
      <FilterSelect
        label="Facility"
        value={filters.facility ?? "all"}
        onValueChange={(facility) => onChange({ ...filters, facility })}
        options={[
          { value: "all", label: "All facilities" },
          ...options.facilities.slice(0, 8).map((f) => ({
            value: f,
            label: f.length > 28 ? `${f.slice(0, 28)}…` : f,
          })),
        ]}
      />
      <FilterSelect
        label="Deadline"
        value={filters.maxDeadlineDays?.toString() ?? "all"}
        onValueChange={(v) =>
          onChange({ ...filters, maxDeadlineDays: v === "all" ? undefined : Number(v) })
        }
        options={[
          { value: "all", label: "Any deadline" },
          { value: "1", label: "Within 24 hours" },
          { value: "3", label: "Within 3 days" },
          { value: "7", label: "Within 7 days" },
        ]}
      />
      <FilterSelect
        label="Pay range"
        value={filters.minPay === 500 ? "500+" : filters.maxPay === 500 ? "under-500" : "all"}
        onValueChange={(v) => {
          if (v === "all") onChange({ ...filters, minPay: undefined, maxPay: undefined });
          else if (v === "500+") onChange({ ...filters, minPay: 500, maxPay: undefined });
          else onChange({ ...filters, minPay: undefined, maxPay: 500 });
        }}
        options={[
          { value: "all", label: "Any pay" },
          { value: "under-500", label: "Under $500" },
          { value: "500+", label: "$500+" },
        ]}
      />
      <FilterSelect
        label="Status"
        value={filters.status ?? "all"}
        onValueChange={(status) => onChange({ ...filters, status })}
        options={[
          { value: "all", label: "All statuses" },
          { value: "awarded", label: "Awarded" },
          { value: "accepted", label: "Accepted" },
          { value: "active", label: "Active" },
          { value: "in_progress", label: "In progress" },
          { value: "completed", label: "Completed" },
        ]}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-11 rounded-none border-2 font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
