import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Shield,
  Truck,
  Upload,
} from "lucide-react";
import {
  useClockInTicket,
  useCreateJobEvidence,
  useCreateJobMessage,
  useCreateJobStatusUpdate,
  useGetDashboardActivity,
  useGetJob,
  useGetMyProfile,
  useListDumpSites,
  useListJobEvidence,
  useListJobStatusUpdates,
  useListJobTickets,
  useListOrgMembers,
  useListTrucks,
} from "@workspace/api-client-react";

import {
  ActivityFeed,
  AppLoader,
  EmptyState,
  OfflineBanner,
  PageHeader,
  ProgressBar,
  StatCard,
  StatusBadge,
} from "@/components/shared";
import { formatJobEta } from "@/components/driver/DriverLoadCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useDriverOnline } from "@/hooks/useDriverOnline";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import {
  buildDriverDocumentCards,
  computeDriverEarningsBreakdown,
  computeRemainingTime,
  DRIVER_LIVE_PROGRESS_STEPS,
  filterActivityForJob,
  formatDeadline,
  formatDriverPay,
  liveProgressPercent,
  matchDumpSiteForAddress,
  navigationUrl,
  redactJobForDriver,
  resolveDriverProgress,
  type DriverDocumentCard,
} from "@/lib/driverJobView";
import { storagePublicUrl, uploadFileToStorage } from "@/lib/storageUpload";

const LazyMapContainer = lazy(() =>
  import("@/components/shared/MapContainer").then((m) => ({ default: m.MapContainer })),
);

function SectionCard({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <Card id={id} className="rounded-none border-2">
      <CardHeader className="border-b border-border/50 bg-muted/10">
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-snug">{value}</p>
    </div>
  );
}

function DocumentCardRow({
  doc,
  onUpload,
  uploading,
}: {
  doc: DriverDocumentCard;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-bold">{doc.title}</p>
        <p className="text-xs text-muted-foreground">{doc.verificationStatus}</p>
        <StatusBadge status={doc.status === "verified" ? "completed" : doc.status === "uploaded" ? "in_progress" : doc.status === "placeholder" ? "pending" : "pending"} className="mt-2" />
      </div>
      <div className="flex flex-wrap gap-2">
        {doc.previewUrl ? (
          <Button variant="outline" size="sm" className="rounded-none border-2 font-bold" asChild>
            <a href={doc.previewUrl} target="_blank" rel="noopener noreferrer">
              Preview
            </a>
          </Button>
        ) : null}
        {doc.status !== "placeholder" ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              className="rounded-none font-bold"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
              {doc.previewUrl ? "Replace" : "Upload"}
            </Button>
          </>
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">Placeholder — design pending</span>
        )}
      </div>
    </div>
  );
}

export default function DriverJobDetail({ jobId }: { jobId: number }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: profile } = useGetMyProfile();

  const jobQuery = useGetJob(jobId, { query: { enabled: !!jobId } as any });
  const ticketsQuery = useListJobTickets(jobId, { query: { enabled: !!jobId } as any });
  const evidenceQuery = useListJobEvidence(jobId, { query: { enabled: !!jobId } as any });
  const updatesQuery = useListJobStatusUpdates(jobId, { query: { enabled: !!jobId } as any });
  const activityQuery = useGetDashboardActivity();
  const dumpSitesQuery = useListDumpSites();
  const orgQuery = useListOrgMembers();
  const trucksQuery = useListTrucks();

  const clockIn = useClockInTicket();
  const createEvidence = useCreateJobEvidence();
  const createStatusUpdate = useCreateJobStatusUpdate();
  const sendMessage = useCreateJobMessage();

  const [messageBody, setMessageBody] = useState("");
  const [uploadBusy, setUploadBusy] = useState<string | null>(null);
  const [showMessageForm, setShowMessageForm] = useState(false);

  const job = jobQuery.data;
  const safeJob = useMemo(() => (job ? redactJobForDriver(job) : null), [job]);

  const tickets = useMemo(() => {
    const raw = ticketsQuery.data as { tickets?: unknown[] } | undefined;
    return (raw?.tickets ?? []) as Array<{
      id: number;
      driverProfileId: number;
      truckId?: number | null;
      loadNumber: number;
      clockedInAt?: string | null;
      clockedOutAt?: string | null;
      photoUrl?: string | null;
      verifiedAt?: string | null;
      weightTons?: number | null;
    }>;
  }, [ticketsQuery.data]);

  const evidence = useMemo(() => {
    const raw = evidenceQuery.data as unknown[] | undefined;
    return (raw ?? []) as Array<{ id: number; photoUrl?: string | null; photoCaption?: string | null; siteNotes?: string | null }>;
  }, [evidenceQuery.data]);

  const statusUpdates = updatesQuery.data ?? [];
  const myTicket = tickets.find((t) => t.driverProfileId === profile?.id) ?? null;

  const assignedTruck = useMemo(() => {
    if (!myTicket?.truckId) return null;
    return trucksQuery.data?.find((t) => t.id === myTicket.truckId) ?? null;
  }, [myTicket, trucksQuery.data]);

  const facility = useMemo(() => {
    if (!safeJob) return null;
    return matchDumpSiteForAddress(safeJob.deliveryAddress, dumpSitesQuery.data ?? []);
  }, [safeJob, dumpSitesQuery.data]);

  const dispatcher = useMemo(() => {
    const members = orgQuery.data?.members ?? [];
    return (
      members.find((m) => m.role === "provider" && m.phone) ??
      members.find((m) => m.orgRole === "admin" && m.phone) ??
      members.find((m) => m.role === "provider") ??
      members[0]
    );
  }, [orgQuery.data]);

  const progress = useMemo(() => {
    if (!job) {
      return resolveDriverProgress({ status: "accepted" }, [], null, []);
    }
    return resolveDriverProgress(job, statusUpdates, myTicket, evidence);
  }, [job, statusUpdates, myTicket, evidence]);

  const earnings = useMemo(() => (job ? computeDriverEarningsBreakdown(job) : null), [job]);
  const documentCards = useMemo(() => buildDriverDocumentCards(tickets, evidence), [tickets, evidence]);
  const jobActivities = useMemo(
    () => filterActivityForJob(activityQuery.data, jobId).slice(0, 12),
    [activityQuery.data, jobId],
  );

  const hasActiveLoad = job?.status === "in_progress";
  const { presence } = useDriverOnline(hasActiveLoad);
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  const refetchAll = useCallback(() => {
    jobQuery.refetch();
    ticketsQuery.refetch();
    evidenceQuery.refetch();
    updatesQuery.refetch();
    activityQuery.refetch();
  }, [jobQuery, ticketsQuery, evidenceQuery, updatesQuery, activityQuery]);

  const handleUploadEvidence = async (file: File, caption: string) => {
    setUploadBusy(caption);
    try {
      const { objectPath } = await uploadFileToStorage(file);
      await createEvidence.mutateAsync({
        jobId,
        data: { photoUrl: storagePublicUrl(objectPath), photoCaption: caption },
      });
      await createStatusUpdate.mutateAsync({ id: jobId, data: { status: "photo_uploaded" } });
      toast({ title: "Upload complete" });
      refetchAll();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setUploadBusy(null);
    }
  };

  const handleUploadTicket = async (file: File) => {
    setUploadBusy("ticket");
    try {
      const { objectPath } = await uploadFileToStorage(file);
      await apiFetch(`/jobs/${jobId}/tickets`, {
        method: "POST",
        body: JSON.stringify({ photoUrl: storagePublicUrl(objectPath) }),
      });
      await createStatusUpdate.mutateAsync({ id: jobId, data: { status: "ticket_uploaded" } });
      toast({ title: "Ticket uploaded" });
      refetchAll();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setUploadBusy(null);
    }
  };

  const handleSendMessage = () => {
    if (!messageBody.trim()) return;
    sendMessage.mutate(
      { id: jobId, data: { body: messageBody.trim() } },
      {
        onSuccess: () => {
          toast({ title: "Message sent to dispatcher" });
          setMessageBody("");
          setShowMessageForm(false);
        },
        onError: (err) =>
          toast({
            title: "Message failed",
            description: err instanceof Error ? err.message : "Try again",
            variant: "destructive",
          }),
      },
    );
  };

  const handleReportDelay = () => {
    createStatusUpdate.mutate(
      { id: jobId, data: { status: "en_route", note: "Driver reported delay" } },
      {
        onSuccess: () => {
          toast({ title: "Delay reported" });
          refetchAll();
        },
        onError: (err) =>
          toast({
            title: "Could not report delay",
            description: err instanceof Error ? err.message : "Try again",
            variant: "destructive",
          }),
      },
    );
  };

  if (jobQuery.isLoading) {
    return <AppLoader label="Loading job detail…" />;
  }

  if (jobQuery.isError || !job || !safeJob) {
    return (
      <EmptyState
        icon={<Truck className="h-10 w-10 opacity-40" aria-hidden />}
        title="Job not found"
        description="This load may have been removed or you are not assigned."
        action={
          <Button className="rounded-none font-bold" onClick={() => setLocation("/jobs")}>
            Back to Load Board
          </Button>
        }
        className="mx-auto max-w-lg"
      />
    );
  }

  const etaLabel = formatJobEta(safeJob) ?? "—";
  const remaining = computeRemainingTime(job.scheduledDate, job.startTime);
  const progressPct = liveProgressPercent(progress.completedKeys);

  return (
    <div className="animate-in fade-in space-y-6 pb-32 duration-500 motion-reduce:animate-none md:pb-12">
      {(isOffline || jobQuery.isError) && <OfflineBanner onRetry={refetchAll} />}

      <Button variant="ghost" className="-ml-4 rounded-none" onClick={() => setLocation("/jobs")}>
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
        Back to Load Board
      </Button>

      {/* HEADER */}
      <PageHeader
        title={`Job #${job.id.toString().padStart(4, "0")}`}
        description={
          <span className="capitalize">{safeJob.materialType} haul · {safeJob.providerCompany}</span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={presence} />
            <StatusBadge status={job.status} className="text-xs" />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Driver Pay" value={formatDriverPay(safeJob.driverPay)} icon={DollarSign} accent />
        <StatCard title="Material" value={safeJob.materialType} icon={Truck} />
        <StatCard title="Current ETA" value={etaLabel} icon={Clock} />
        <StatCard title="Remaining" value={remaining} icon={Clock} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={job.status} className="px-4 py-2 text-sm" />
        <span className="text-sm font-semibold text-muted-foreground">
          {presence === "online" ? "Online — receiving dispatch" : presence === "busy" ? "Busy — on active haul" : "Offline"}
        </span>
      </div>

      {/* PRIMARY ACTION CARD */}
      <SectionCard title="Current Assignment" description="Pickup through deadline — your operational summary">
        {!myTicket ? (
          <Alert className="rounded-none border-2 border-amber-500/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Assignment required</AlertTitle>
            <AlertDescription>
              Your dispatcher must assign you and create a load ticket before field check-in. Contact your fleet manager.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoBlock label="Pickup Location" value={safeJob.pickupAddress} />
          <InfoBlock label="Dropoff Facility" value={safeJob.deliveryAddress} />
          <InfoBlock label="Material" value={safeJob.materialType} />
          <InfoBlock
            label="Quantity"
            value={`${safeJob.trucksAssigned} truck${safeJob.trucksAssigned === 1 ? "" : "s"} · est. ${safeJob.estimatedHours}h`}
          />
          <InfoBlock
            label="Truck Assigned"
            value={
              assignedTruck
                ? `${assignedTruck.make ?? ""} ${assignedTruck.model ?? ""} ${assignedTruck.licensePlate ?? ""}`.trim() ||
                  `Truck #${assignedTruck.id}`
                : myTicket ? `Load #${myTicket.loadNumber}` : "—"
            }
          />
          <InfoBlock label="Scheduled Time" value={formatDeadline(safeJob)} />
          <InfoBlock label="Remaining Time" value={remaining} />
          <InfoBlock label="Deadline" value={formatDeadline(safeJob)} />
        </div>

        <ProgressBar value={progressPct} label="Haul progress" className="mt-6" />

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button className="h-12 flex-1 rounded-none font-bold" asChild>
            <a href={navigationUrl(safeJob.pickupAddress)} target="_blank" rel="noopener noreferrer">
              <Navigation className="mr-2 h-4 w-4" aria-hidden />
              Navigate
            </a>
          </Button>
          {dispatcher?.phone ? (
            <Button variant="outline" className="h-12 flex-1 rounded-none border-2 font-bold" asChild>
              <a href={`tel:${dispatcher.phone}`}>
                <Phone className="mr-2 h-4 w-4" aria-hidden />
                Call Dispatcher
              </a>
            </Button>
          ) : (
            <Button variant="outline" className="h-12 flex-1 rounded-none border-2 font-bold" disabled>
              <Phone className="mr-2 h-4 w-4" aria-hidden />
              Call Dispatcher
            </Button>
          )}
          <Button
            variant="outline"
            className="h-12 flex-1 rounded-none border-2 font-bold"
            onClick={() => setShowMessageForm((s) => !s)}
          >
            <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
            Message Dispatcher
          </Button>
          {facility ? (
            <Button variant="secondary" className="h-12 flex-1 rounded-none border-2 font-bold" asChild>
              <a href={navigationUrl(facility.fullAddress ?? safeJob.deliveryAddress)} target="_blank" rel="noopener noreferrer">
                <MapPin className="mr-2 h-4 w-4" aria-hidden />
                View Facility
              </a>
            </Button>
          ) : null}
        </div>

        {showMessageForm ? (
          <div className="mt-4 space-y-3 border border-border p-4">
            <Label htmlFor="dispatcher-message">Message to dispatcher</Label>
            <Textarea
              id="dispatcher-message"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Traffic delay, gate issue, etc."
              className="rounded-none border-2"
            />
            <Button
              className="rounded-none font-bold"
              disabled={sendMessage.isPending || !messageBody.trim()}
              onClick={handleSendMessage}
            >
              Send Message
            </Button>
          </div>
        ) : null}

        {myTicket && !myTicket.clockedInAt ? (
          <Button
            className="mt-4 h-12 w-full rounded-none font-bold sm:w-auto"
            disabled={clockIn.isPending}
            onClick={() =>
              clockIn.mutate(
                { id: myTicket.id },
                {
                  onSuccess: () => {
                    toast({ title: "Checked in" });
                    refetchAll();
                  },
                  onError: (err) =>
                    toast({
                      title: "Check-in failed",
                      description: err instanceof Error ? err.message : "Try again",
                      variant: "destructive",
                    }),
                },
              )
            }
          >
            {clockIn.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Check In at Pickup
          </Button>
        ) : null}
      </SectionCard>

      {/* LIVE PROGRESS */}
      <SectionCard title="Live Progress" description="Timeline from acceptance through payment">
        {updatesQuery.isLoading ? (
          <Skeleton className="h-48 w-full rounded-none" aria-busy="true" />
        ) : (
          <ol className="space-y-3" aria-label="Haul progress timeline">
            {DRIVER_LIVE_PROGRESS_STEPS.map((step) => {
              const done = progress.completedKeys.has(step.key);
              const current = progress.currentKey === step.key;
              return (
                <li
                  key={step.key}
                  className={`flex items-center gap-3 border-l-4 py-2 pl-4 ${
                    current ? "border-primary bg-primary/5" : done ? "border-green-600/60" : "border-border"
                  }`}
                  aria-current={current ? "step" : undefined}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      done ? "border-green-600 bg-green-600 text-white" : current ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <span className="text-xs font-bold">{step.label[0]}</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${current ? "text-primary" : ""}`}>{step.label}</p>
                    {current ? <p className="text-xs font-semibold text-primary">Current step</p> : null}
                  </div>
                  {current ? <StatusBadge status="in_progress" /> : done ? <StatusBadge status="completed" /> : null}
                </li>
              );
            })}
          </ol>
        )}
      </SectionCard>

      {/* FACILITY INFORMATION */}
      <SectionCard title="Facility Information" description="Dropoff site details from directory">
        {dumpSitesQuery.isLoading ? (
          <Skeleton className="h-32 w-full rounded-none" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoBlock label="Facility Name" value={facility?.name ?? safeJob.deliveryAddress.split(",")[0] ?? "—"} />
            <InfoBlock label="Address" value={facility?.fullAddress ?? safeJob.deliveryAddress} />
            <InfoBlock label="Phone" value={facility?.phone ?? "—"} />
            <InfoBlock label="Hours" value="Placeholder — facility hours API pending design" />
            <InfoBlock label="Gate Instructions" value="Placeholder — gate instructions pending design" />
            <InfoBlock label="Scale Instructions" value="Placeholder — scale instructions pending design" />
            <InfoBlock label="Unload Instructions" value="Placeholder — unload instructions pending design" />
            <InfoBlock label="Safety Notes" value="Placeholder — safety notes pending design" />
            <InfoBlock label="Accepted Material" value={safeJob.materialType} />
            <InfoBlock label="Facility Status" value="Placeholder — open/busy/closed pending design" />
            <InfoBlock label="Wait Time" value="Placeholder — live wait time pending design" />
          </div>
        )}
      </SectionCard>

      {/* DOCUMENTS */}
      <SectionCard title="Documents" description="Upload progress for tickets and proof">
        {evidenceQuery.isLoading || ticketsQuery.isLoading ? (
          <Skeleton className="h-40 w-full rounded-none" />
        ) : (
          <div className="space-y-3">
            {documentCards.map((doc) => (
              <div key={doc.kind} id={doc.uploadAnchor.replace("#", "")}>
                <DocumentCardRow
                  doc={doc}
                  uploading={uploadBusy === doc.kind || uploadBusy === "ticket"}
                  onUpload={(file) => {
                    if (doc.kind === "load_ticket") void handleUploadTicket(file);
                    else void handleUploadEvidence(file, doc.title);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* MAP */}
      <SectionCard title="Route Map" description="Pickup, facility, and route preview">
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-none" />}>
          <LazyMapContainer className="min-h-[200px] rounded-none border-0" placeholder="Route · pickup · facility · traffic placeholder">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
              <MapPin className="h-8 w-8 text-primary opacity-60" aria-hidden />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Route preview placeholder</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Pickup: {safeJob.pickupAddress}
                <br />
                Facility: {safeJob.deliveryAddress}
                <br />
                ETA: {etaLabel} · Traffic: placeholder
              </p>
            </div>
          </LazyMapContainer>
        </Suspense>
      </SectionCard>

      {/* EARNINGS */}
      <SectionCard title="Earnings" description="Driver pay only — customer pricing hidden">
        {earnings ? (
          <div className="space-y-3">
            <div className="flex justify-between border-b border-border py-2">
              <span className="text-sm text-muted-foreground">Driver Pay</span>
              <span className="font-bold tabular-nums">{formatDriverPay(earnings.driverPay)}</span>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <span className="text-sm text-muted-foreground">Bonus</span>
              <span className="font-bold tabular-nums">{formatDriverPay(earnings.bonus)}</span>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <span className="text-sm text-muted-foreground">Waiting Time</span>
              <span className="font-bold tabular-nums">{formatDriverPay(earnings.waitingTime)}</span>
            </div>
            <div className="flex justify-between border-b border-border py-2">
              <span className="text-sm text-muted-foreground">Fuel Adjustment</span>
              <span className="font-bold tabular-nums">{formatDriverPay(earnings.fuelAdjustment)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-base font-bold">Current Total</span>
              <span className="text-2xl font-black tabular-nums text-primary">{formatDriverPay(earnings.currentTotal)}</span>
            </div>
          </div>
        ) : (
          <Skeleton className="h-24 w-full rounded-none" />
        )}
      </SectionCard>

      {/* JOB NOTES */}
      <SectionCard title="Job Notes" description="Driver and site instructions only">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoBlock label="Driver Instructions" value="Follow dispatcher assignments and upload tickets at each stop." />
          <InfoBlock label="Facility Instructions" value={facility ? `${facility.name}${facility.type ? ` — ${facility.type.replace(/_/g, " ")}` : ""}` : safeJob.deliveryAddress} />
          <InfoBlock label="Safety Notes" value="Placeholder — required safety notes pending design package" />
          <InfoBlock label="Required PPE" value="Placeholder — PPE requirements pending design package" />
          <InfoBlock label="Special Requirements" value={`${formatTruckType(safeJob.truckType)} · ${safeJob.estimatedHours}h estimated`} />
        </div>
      </SectionCard>

      {/* ACTIVITY */}
      <ActivityFeed
        activities={jobActivities.map((a) => ({
          id: a.id,
          type: a.type,
          description: a.description,
          createdAt: a.createdAt,
          relatedId: a.relatedId,
          relatedBinOrderId: a.relatedBinOrderId,
          href: a.relatedId === jobId ? `/jobs/${jobId}` : undefined,
        }))}
        isLoading={activityQuery.isLoading}
        title="Activity"
        description="Notifications, uploads, timeline events, and verification updates for this load"
        limit={10}
      />

      {/* STICKY QUICK ACTIONS (mobile-first) */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
        role="region"
        aria-label="Quick actions"
      >
        <p className="mb-2 hidden text-xs font-bold uppercase tracking-wider text-muted-foreground md:block">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Button className="h-12 rounded-none font-bold" asChild>
            <a href={navigationUrl(safeJob.pickupAddress)} target="_blank" rel="noopener noreferrer">
              <Navigation className="mr-1 h-4 w-4" aria-hidden />
              Navigate
            </a>
          </Button>
          <Button variant="outline" className="h-12 rounded-none border-2 font-bold" asChild>
            <Link href={`#load-ticket-upload`}>
              <Upload className="mr-1 h-4 w-4" aria-hidden />
              Upload Ticket
            </Link>
          </Button>
          <Button variant="outline" className="h-12 rounded-none border-2 font-bold" asChild>
            <Link href="#scale-ticket-upload">
              <FileText className="mr-1 h-4 w-4" aria-hidden />
              Upload Scale
            </Link>
          </Button>
          <Button variant="outline" className="h-12 rounded-none border-2 font-bold" asChild>
            <Link href="#pod-upload">
              <Camera className="mr-1 h-4 w-4" aria-hidden />
              Upload POD
            </Link>
          </Button>
          <Button variant="outline" className="h-12 rounded-none border-2 font-bold" asChild>
            <Link href="#photos-upload">
              <Camera className="mr-1 h-4 w-4" aria-hidden />
              Upload Photos
            </Link>
          </Button>
          {dispatcher?.phone ? (
            <Button variant="outline" className="h-12 rounded-none border-2 font-bold" asChild>
              <a href={`tel:${dispatcher.phone}`}>
                <Phone className="mr-1 h-4 w-4" aria-hidden />
                Call
              </a>
            </Button>
          ) : null}
          <Button variant="outline" className="h-12 rounded-none border-2 font-bold" onClick={() => setShowMessageForm(true)}>
            <MessageSquare className="mr-1 h-4 w-4" aria-hidden />
            Message
          </Button>
          <Button variant="outline" className="h-12 rounded-none border-2 font-bold" onClick={handleReportDelay}>
            <Clock className="mr-1 h-4 w-4" aria-hidden />
            Report Delay
          </Button>
          <Button variant="destructive" className="h-12 rounded-none border-2 font-bold" asChild>
            <a href="tel:911">
              <Shield className="mr-1 h-4 w-4" aria-hidden />
              Emergency
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatTruckType(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
