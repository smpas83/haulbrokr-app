import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import { uploadFileToStorage } from "@/lib/storageUpload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, ShieldCheck, Loader2, Eye, Trash2, AlertTriangle, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { useGetMyProfile } from "@workspace/api-client-react";

// ── Shared document model ────────────────────────────────────────────────────
export interface DriverDoc {
  id?: number;
  docType: string;
  status: string;
  fileName: string | null;
  objectPath: string | null;
  docNumber?: string | null;
  reviewNote?: string | null;
  expiry: string | null;
  uploadedAt?: string | null;
  updatedAt?: string | null;
}

// Provider-facing document catalog (mirrors the mobile app). Shared docs first.
interface DocSpec { id: string; label: string; description: string; required: boolean; expires?: boolean; }
const PROVIDER_DOC_SPECS: DocSpec[] = [
  { id: "coi", label: "Certificate of Insurance (COI)", description: "Auto liability & cargo proof", required: true, expires: true },
  { id: "w9", label: "W-9 Tax Form", description: "Signed W-9 for payments", required: true },
  { id: "dot_authority", label: "DOT Authority Letter", description: "USDOT / MC authority on file", required: false },
  { id: "business_license", label: "Business License", description: "State / city business registration", required: true },
  { id: "mc_authority", label: "MC Authority", description: "FMCSA operating authority letter", required: true },
  { id: "vehicle_registration", label: "Vehicle Registration", description: "Registration for trucks in your fleet", required: true, expires: true },
  { id: "equipment_list", label: "Equipment List", description: "Itemized list of trucks & machines", required: true },
  { id: "signed_carrier_agreement", label: "Signed Carrier Agreement", description: "HaulBrokr carrier contract", required: true },
  { id: "voided_check", label: "Voided Check", description: "For ACH payout setup", required: true },
  { id: "ach_authorization", label: "ACH Authorization", description: "Signed direct-deposit authorization", required: false },
  { id: "safety_rating", label: "Safety Rating", description: "FMCSA safety rating documentation", required: false },
  { id: "bond", label: "Surety Bond", description: "Broker / carrier bond, if applicable", required: false },
];

const CUSTOMER_DOC_SPECS: DocSpec[] = [
  { id: "w9", label: "W-9 Tax Form", description: "Signed W-9 for billing & payments", required: true },
  { id: "cos", label: "Certificate of Status (COS)", description: "State certificate of good standing", required: false },
];

const DOC_LABELS: Record<string, string> = Object.fromEntries(PROVIDER_DOC_SPECS.map((s) => [s.id, s.label]));
const docLabel = (t: string) => DOC_LABELS[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function storageHref(objectPath: string | null): string | null {
  if (!objectPath) return null;
  // objectPath is stored as "/objects/<...>"; served at /api/storage/objects/<...>.
  return `/api/storage${objectPath.startsWith("/") ? objectPath : "/" + objectPath}`;
}
const isExpired = (e: string | null) => !!e && new Date(e).getTime() < Date.now();

function StatusBadge({ status, expiry }: { status: string; expiry?: string | null }) {
  if (status === "verified" && isExpired(expiry ?? null)) {
    return <Badge variant="outline" className="rounded-none border-amber-500 text-amber-600">Expired</Badge>;
  }
  const map: Record<string, string> = {
    verified: "border-green-600 text-green-700",
    uploaded: "border-blue-500 text-blue-600",
    rejected: "border-red-500 text-red-600",
    missing: "border-muted-foreground/40 text-muted-foreground",
  };
  const labels: Record<string, string> = {
    verified: "Approved",
    uploaded: "Pending review",
    rejected: "Rejected",
    missing: "Missing",
    pending: "Pending review",
  };
  const label = labels[status] ?? (status || "missing").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant="outline" className={`rounded-none ${map[status] ?? map.missing}`}>{label}</Badge>;
}

// ── Vendor self-service upload list (Account page) ───────────────────────────
export function AccountDocuments() {
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const specs = (profile as any)?.role === "customer" ? CUSTOMER_DOC_SPECS : PROVIDER_DOC_SPECS;
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const docsQuery = useQuery({
    queryKey: ["driver-docs"],
    queryFn: () => apiFetch<DriverDoc[]>("/driver-docs"),
  });

  const byType: Record<string, DriverDoc> = {};
  for (const d of docsQuery.data ?? []) byType[d.docType] = d;

  const remove = useMutation({
    mutationFn: (docType: string) => apiFetch(`/driver-docs/${docType}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver-docs"] }),
  });

  async function handleFile(docType: string, file: File) {
    setBusy(docType);
    try {
      const { objectPath, storageToken } = await uploadFileToStorage(file);
      await apiFetch(`/driver-docs/${docType}`, {
        method: "PUT",
        body: JSON.stringify({ objectPath, storageToken, fileName: file.name, mimeType: file.type || "application/octet-stream" }),
      });
      await qc.invalidateQueries({ queryKey: ["driver-docs"] });
      toast({ title: "Document uploaded", description: `${docLabel(docType)} saved. Our team will review it.` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  if (docsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-none" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-none" />)}
      </div>
    );
  }

  const requiredSpecs = specs.filter((s) => s.required);
  const verifiedCount = requiredSpecs.filter((s) => byType[s.id]?.status === "verified").length;
  const pct = requiredSpecs.length ? Math.round((verifiedCount / requiredSpecs.length) * 100) : 100;
  const allDone = verifiedCount === requiredSpecs.length;
  const isCustomer = (profile as any)?.role === "customer";

  function onDrop(e: React.DragEvent, docType: string) {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(docType, file);
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-none border-2 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-11 h-11 border-2 ${allDone ? "border-green-600 text-green-700" : "border-primary text-primary"}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Documents</h2>
              <p className="text-sm text-muted-foreground">
                {isCustomer
                  ? "Keep your account in good standing by uploading the required forms."
                  : "Verified documents unlock bidding and faster payouts."}
              </p>
            </div>
          </div>
          <div className={`px-3 py-1 border-2 text-sm font-semibold whitespace-nowrap ${allDone ? "border-green-600 text-green-700 bg-green-50" : "border-primary/40 text-foreground"}`}>
            {verifiedCount} / {requiredSpecs.length} verified
          </div>
        </div>
        <div className="mt-4">
          <Progress value={pct} className="h-2 rounded-none" />
        </div>
      </Card>

      <div className="grid gap-3">
        {specs.map((spec) => {
          const doc = byType[spec.id];
          const href = storageHref(doc?.objectPath ?? null);
          const uploading = busy === spec.id;
          const status = doc?.status ?? "missing";
          const hasFile = !!doc?.objectPath;
          const rejected = status === "rejected";
          return (
            <Card
              key={spec.id}
              className={`rounded-none border-2 p-4 transition-colors ${dragOver === spec.id ? "border-primary bg-primary/5" : rejected ? "border-red-300" : "hover:border-primary/40"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(spec.id); }}
              onDragLeave={() => setDragOver((d) => (d === spec.id ? null : d))}
              onDrop={(e) => onDrop(e, spec.id)}
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-11 h-11 border-2 border-muted-foreground/20 text-muted-foreground shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{spec.label}</span>
                    {spec.required
                      ? <span className="text-[10px] uppercase tracking-wider text-muted-foreground border px-1.5 py-0.5">Required</span>
                      : <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 border px-1.5 py-0.5">Optional</span>}
                    <StatusBadge status={status} expiry={doc?.expiry ?? null} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {hasFile ? doc?.fileName : spec.description}
                    {doc?.expiry ? ` · expires ${new Date(doc.expiry).toLocaleDateString()}` : ""}
                  </div>
                  {rejected && doc?.reviewNote && (
                    <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{doc.reviewNote}</span>
                    </div>
                  )}
                  {!hasFile && (
                    <div className="mt-3 border-2 border-dashed border-muted-foreground/25 p-3 text-center text-xs text-muted-foreground">
                      <UploadCloud className="w-5 h-5 mx-auto mb-1 opacity-60" />
                      Drag and drop a file here, or use the button. PDF, JPG, or PNG.
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <input
                    ref={(el) => { inputs.current[spec.id] = el; }}
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={(e) => { const fl = e.target.files?.[0]; if (fl) handleFile(spec.id, fl); e.target.value = ""; }}
                  />
                  <Button size="sm" variant={hasFile ? "outline" : "default"} className="rounded-none w-28 justify-center" disabled={uploading} onClick={() => inputs.current[spec.id]?.click()}>
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span className="ml-1">{hasFile ? "Replace" : "Upload"}</span>
                  </Button>
                  {href && (
                    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                      <Eye className="w-3.5 h-3.5" /> View file
                    </a>
                  )}
                  {hasFile && (
                    <button
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-600 text-xs disabled:opacity-50"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(spec.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Customer view of the awarded carrier's documents (job-detail page) ───────
interface CarrierDocsResp {
  providerId: number | null;
  providerCompany: string | null;
  documents: DriverDoc[];
}
export function CarrierDocuments({ jobId }: { jobId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["carrier-documents", jobId],
    queryFn: () => apiFetch<CarrierDocsResp>(`/jobs/${jobId}/carrier-documents`),
    enabled: Number.isFinite(jobId),
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-none" />;
  if (!data || !data.providerId) return null;

  const docs = data.documents ?? [];
  return (
    <div className="border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Carrier Documents</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Compliance documents for {data.providerCompany ?? "your assigned carrier"}.
      </p>
      {docs.length === 0 ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" /> Your carrier has not uploaded these documents yet.
        </div>
      ) : (
        <div className="border divide-y">
          {docs.map((d) => {
            const href = storageHref(d.objectPath);
            return (
              <div key={d.docType} className="flex items-center gap-3 p-3">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{docLabel(d.docType)}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.expiry ? `Expires ${new Date(d.expiry).toLocaleDateString()}` : "On file"}
                  </div>
                </div>
                <StatusBadge status={d.status} expiry={d.expiry} />
                {href && d.status !== "missing" && (
                  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                    <Eye className="w-3.5 h-3.5" /> View
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ── App-wide gate banner ─────────────────────────────────────────────────────
interface DocStatusResp {
  profileId: number;
  role: string;
  complete: boolean;
  gated: boolean;
  missing: string[];
  items: { key: string; label: string; satisfied: boolean; status: string }[];
}

/**
 * Persistent banner shown until the signed-in user's required documents are
 * complete. Carriers see a hard-gate tone; customers see a softer reminder.
 * Rendered app-wide from the main layout.
 */
export function DocumentGateBanner() {
  const { data } = useQuery({
    queryKey: ["my-document-status"],
    queryFn: () => apiFetch<DocStatusResp>("/profiles/me/document-status"),
    retry: false,
    staleTime: 60_000,
  });

  if (!data || data.complete || data.missing.length === 0) return null;

  const hard = data.gated; // carriers
  return (
    <div className={`mb-4 border-2 rounded-none p-3 flex flex-col sm:flex-row sm:items-center gap-2 ${hard ? "border-red-500 bg-red-50" : "border-amber-400 bg-amber-50"}`}>
      <AlertTriangle className={`w-5 h-5 shrink-0 ${hard ? "text-red-600" : "text-amber-600"}`} />
      <div className="flex-1 min-w-0 text-sm">
        <span className="font-semibold">
          {hard ? "Action required: " : "Reminder: "}
        </span>
        {hard
          ? "Upload and verify your documents to start bidding and accepting jobs. "
          : "Please upload your documents to keep your account active. "}
        <span className="text-muted-foreground">Outstanding: {data.missing.join(", ")}.</span>
      </div>
      <Link href="/account?tab=documents">
        <Button size="sm" className="rounded-none shrink-0">Upload documents</Button>
      </Link>
    </div>
  );
}


export const VendorDocuments = AccountDocuments;
