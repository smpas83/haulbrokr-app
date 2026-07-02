import { useState, type ReactNode } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, AlertCircle, Clock, ShieldAlert,
  ShieldCheck, CreditCard, Truck, Building2, X, Banknote, ArrowRight, RotateCcw,
  Users, UserCog, Package, MapPin, Calendar, PackageCheck,
  LayoutDashboard, DollarSign, TrendingUp, Briefcase, Activity, UserPlus, Lock,
} from "lucide-react";
import { AdminInsights } from "@/components/admin-insights";
import {
  useGetAdminAccess,
  useGetAdminOverview, getGetAdminOverviewQueryKey,
  useListAdminCompliance, useReviewCompliance, getListAdminComplianceQueryKey,
  useReviewProviderW9, useReviewProviderInsurance, useReviewProviderComplianceDocument,
  useListAdminCreditApplications, useReviewCreditApplication, getListAdminCreditApplicationsQueryKey,
  useListStuckPayouts, useRetryStuckPayout, useResetStuckPayoutFailures, getListStuckPayoutsQueryKey,
  useListAdminStaff, useUpdateStaffRole, getListAdminStaffQueryKey,
  useListAdminBinOrders, useAdvanceBinOrderStatus, getListAdminBinOrdersQueryKey,
  type AdminProviderCompliance, type AdminUploadedComplianceDocument,
  type AdminCreditApplicationItem, type StuckPayoutItem,
  type StaffMember, type BinOrder, type AdvanceBinOrderInput, type AdminOverview,
  type UpdateStaffRoleInput,
} from "@workspace/api-client-react";

import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState as DesignEmptyState,
  LoadingSpinner,
  MetricCard,
  PrimaryButton as Button,
  Skeleton,
  StatusPill,
} from "@/components/design-system";
import { AdminDashboardLayout } from "@/components/design-system/layouts";
import { PageTransition } from "@/components/design-system/animation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Approve / reject controls shared by the carrier and credit cards. Rejecting
 * reveals a reason box so the admin can explain why â that note is stored and
 * sent to the applicant. Any previously saved review note is shown above.
 */
function ReviewActions({
  approveLabel,
  approveDisabled,
  rejectDisabled,
  isPending,
  reviewNote,
  status,
  approveIcon,
  onSubmit,
}: {
  approveLabel: string;
  approveDisabled: boolean;
  rejectDisabled: boolean;
  isPending: boolean;
  reviewNote?: string | null;
  status: string;
  approveIcon: React.ReactNode;
  onSubmit: (action: "approve" | "reject", note?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3 pt-2 border-t">
      {reviewNote && status === "rejected" && (
        <div className="text-xs bg-destructive/10 text-destructive border border-destructive/30 px-3 py-2">
          <span className="font-semibold">Rejection reason: </span>{reviewNote}
        </div>
      )}
      {rejecting ? (
        <div className="space-y-2">
          <Textarea
            autoFocus
            placeholder="Reason for rejection (shared with the applicant)â¦"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-none border-2 min-h-[72px]"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-none border-2 text-destructive hover:bg-destructive/10"
              disabled={isPending || !note.trim()}
              onClick={() => onSubmit("reject", note.trim())}
            >
              {isPending ? <LoadingSpinner className="w-4 h-4 mr-1" /> : <AlertCircle className="w-4 h-4 mr-1" />}
              Confirm Rejection
            </Button>
            <Button
              variant="ghost"
              className="rounded-none"
              disabled={isPending}
              onClick={() => { setRejecting(false); setNote(""); }}
            >
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            className="rounded-none"
            disabled={isPending || approveDisabled}
            onClick={() => onSubmit("approve")}
          >
            {isPending ? <LoadingSpinner className="w-4 h-4 mr-1" /> : approveIcon}
            {approveLabel}
          </Button>
          <Button
            variant="outline"
            className="rounded-none border-2 text-destructive hover:bg-destructive/10"
            disabled={isPending || rejectDisabled}
            onClick={() => setRejecting(true)}
          >
            <AlertCircle className="w-4 h-4 mr-1" /> Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function ReviewBadge({ status }: { status: string }) {
  if (status === "verified" || status === "approved") {
    return <StatusPill intent="success"><CheckCircle2 className="w-3 h-3 mr-1" /> {status === "verified" ? "Verified" : "Approved"}</StatusPill>;
  }
  if (status === "pending") {
    return <StatusPill intent="warning"><Clock className="w-3 h-3 mr-1" /> Pending Review</StatusPill>;
  }
  if (status === "rejected") {
    return <StatusPill intent="danger"><AlertCircle className="w-3 h-3 mr-1" /> Rejected</StatusPill>;
  }
  return <StatusPill intent="secondary">{status.replace(/_/g, " ")}</StatusPill>;
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value === null || value === undefined || value === "" ? "â" : value}</div>
    </div>
  );
}

function docTypeLabel(docType: string) {
  return docType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const W9_UPLOAD_DOC_TYPES = new Set(["w9"]);
const COI_UPLOAD_DOC_TYPES = new Set(["coi"]);
const DOT_UPLOAD_DOC_TYPES = new Set(["dot_authority", "dot_medical_card", "mc_authority"]);
const CDL_UPLOAD_DOC_TYPES = new Set(["cdl_front", "cdl_back"]);
const GROUPED_UPLOAD_DOC_TYPES = new Set([
  ...W9_UPLOAD_DOC_TYPES, ...COI_UPLOAD_DOC_TYPES, ...DOT_UPLOAD_DOC_TYPES, ...CDL_UPLOAD_DOC_TYPES,
]);

function normalizeUploadStatus(status: string) {
  return status === "uploaded" ? "pending" : status;
}

function UploadedDocReview({
  doc,
  makeAct,
  anyPending,
}: {
  doc: AdminUploadedComplianceDocument;
  makeAct: (kind: "doc", docType: string) => (action: "approve" | "reject", note?: string) => void;
  anyPending: boolean;
}) {
  return (
    <DocumentReviewSection
      title={docTypeLabel(doc.docType)}
      status={normalizeUploadStatus(doc.status)}
      reviewNote={doc.reviewNote}
      approveDisabled={doc.status === "verified"}
      rejectDisabled={doc.status === "rejected"}
      isPending={anyPending}
      onSubmit={makeAct("doc", doc.docType)}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="File" value={doc.fileName} />
        {doc.objectPath && (
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">View</div>
            <a
              href={`/api/storage${doc.objectPath}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              Open document
            </a>
          </div>
        )}
      </div>
    </DocumentReviewSection>
  );
}

function DocumentReviewSection({
  title,
  status,
  reviewNote,
  approveDisabled,
  rejectDisabled,
  isPending,
  onSubmit,
  children,
}: {
  title: string;
  status: string;
  reviewNote?: string | null;
  approveDisabled: boolean;
  rejectDisabled: boolean;
  isPending: boolean;
  onSubmit: (action: "approve" | "reject", note?: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-semibold text-sm">{title}</h4>
        <ReviewBadge status={status} />
      </div>
      {children}
      <ReviewActions
        approveLabel="Approve"
        approveIcon={<ShieldCheck className="w-4 h-4 mr-1" />}
        approveDisabled={approveDisabled}
        rejectDisabled={rejectDisabled}
        isPending={isPending}
        reviewNote={reviewNote}
        status={status}
        onSubmit={onSubmit}
      />
    </div>
  );
}

function ProviderComplianceCard({ item }: { item: AdminProviderCompliance }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reviewDotCdl = useReviewCompliance();
  const reviewW9 = useReviewProviderW9();
  const reviewInsurance = useReviewProviderInsurance();
  const reviewDoc = useReviewProviderComplianceDocument();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAdminComplianceQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
  };

  const makeAct = (
    kind: "w9" | "insurance" | "dotCdl" | "doc",
    docType?: string,
  ) => (action: "approve" | "reject", note?: string) => {
    const data = { action, ...(note ? { note } : {}) };
    const onSuccess = () => {
      invalidate();
      const labels = { w9: "W-9", insurance: "Insurance", dotCdl: "DOT/CDL", doc: docTypeLabel(docType ?? "document") };
      toast({ title: action === "approve" ? `${labels[kind]} approved` : `${labels[kind]} rejected` });
    };
    const onError = () => toast({ title: "Action failed", variant: "destructive" });
    if (kind === "w9") reviewW9.mutate({ profileId: item.profileId, data }, { onSuccess, onError });
    else if (kind === "insurance") reviewInsurance.mutate({ profileId: item.profileId, data }, { onSuccess, onError });
    else if (kind === "doc") reviewDoc.mutate({ profileId: item.profileId, docType: docType!, data }, { onSuccess, onError });
    else reviewDotCdl.mutate({ profileId: item.profileId, data }, { onSuccess, onError });
  };

  const anyPending = reviewDotCdl.isPending || reviewW9.isPending || reviewInsurance.isPending || reviewDoc.isPending;

  const w9Uploads = item.uploadedDocuments.filter((d) => W9_UPLOAD_DOC_TYPES.has(d.docType));
  const coiUploads = item.uploadedDocuments.filter((d) => COI_UPLOAD_DOC_TYPES.has(d.docType));
  const dotUploads = item.uploadedDocuments.filter((d) => DOT_UPLOAD_DOC_TYPES.has(d.docType));
  const cdlUploads = item.uploadedDocuments.filter((d) => CDL_UPLOAD_DOC_TYPES.has(d.docType));
  const otherUploads = item.uploadedDocuments.filter((d) => !GROUPED_UPLOAD_DOC_TYPES.has(d.docType));

  return (
    <Card className="rounded-none border-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="w-4 h-4 text-primary" /> {item.profile.companyName}
          </CardTitle>
          <CardDescription>
            {item.profile.contactName || "â"}
            {item.profile.email ? ` Â· ${item.profile.email}` : ""}
            {item.profile.city ? ` Â· ${item.profile.city}, ${item.profile.state ?? ""}` : ""}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-2">
          {item.canBid ? (
            <StatusPill intent="success"><CheckCircle2 className="w-3 h-3 mr-1" /> Can bid</StatusPill>
          ) : (
            <Badge variant="secondary" className="rounded-none">Not eligible to bid</Badge>
          )}
          {item.hasPendingReview && (
            <StatusPill intent="warning"><Clock className="w-3 h-3 mr-1" /> Review needed</StatusPill>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(item.w9 || w9Uploads.length > 0) && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">W-9 Documents</h4>
            {item.w9 && (
              <DocumentReviewSection
                title="W-9 (tax form)"
                status={item.w9.status}
                reviewNote={item.w9.reviewNote}
                approveDisabled={item.w9.status === "verified"}
                rejectDisabled={item.w9.status === "rejected"}
                isPending={anyPending}
                onSubmit={makeAct("w9")}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="Legal name" value={item.w9.legalName} />
                  <Field label="Business name" value={item.w9.businessName} />
                  <Field label="Tax ID" value={`${item.w9.taxIdType?.toUpperCase() ?? "?"} Â·Â·Â·Â·${item.w9.taxIdLast4 ?? "????"}`} />
                </div>
              </DocumentReviewSection>
            )}
            {w9Uploads.map((doc) => (
              <UploadedDocReview key={doc.docType} doc={doc} makeAct={makeAct} anyPending={anyPending} />
            ))}
          </div>
        )}

        {(item.insurance || coiUploads.length > 0) && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Insurance / COI Documents</h4>
            {item.insurance && (
              <DocumentReviewSection
                title="Insurance / bonding (form)"
                status={item.insurance.status}
                reviewNote={item.insurance.reviewNote}
                approveDisabled={item.insurance.status === "verified"}
                rejectDisabled={item.insurance.status === "rejected"}
                isPending={anyPending}
                onSubmit={makeAct("insurance")}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="GL carrier" value={item.insurance.glCarrier} />
                  <Field label="Policy #" value={item.insurance.glPolicyNumber} />
                  <Field label="Coverage" value={`$${item.insurance.glCoverageAmount.toLocaleString()}`} />
                  <Field label="Expires" value={item.insurance.glExpirationDate ? new Date(item.insurance.glExpirationDate).toLocaleDateString() : null} />
                </div>
              </DocumentReviewSection>
            )}
            {coiUploads.map((doc) => (
              <UploadedDocReview key={doc.docType} doc={doc} makeAct={makeAct} anyPending={anyPending} />
            ))}
          </div>
        )}

        {(item.dotCdl || dotUploads.length > 0) && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">DOT Documents</h4>
            {item.dotCdl && (
              <DocumentReviewSection
                title="DOT registration & authority"
                status={item.dotCdl.status}
                reviewNote={item.dotCdl.reviewNote}
                approveDisabled={item.dotCdl.status === "verified"}
                rejectDisabled={item.dotCdl.status === "rejected"}
                isPending={anyPending}
                onSubmit={makeAct("dotCdl")}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="DOT #" value={item.dotCdl.dotNumber} />
                  <Field label="MC #" value={item.dotCdl.mcNumber} />
                  <Field label="FMCSA authority" value={item.dotCdl.fmcsaAuthority} />
                  <Field label="Operating status" value={item.dotCdl.dotOperatingStatus} />
                </div>
              </DocumentReviewSection>
            )}
            {dotUploads.map((doc) => (
              <UploadedDocReview key={doc.docType} doc={doc} makeAct={makeAct} anyPending={anyPending} />
            ))}
          </div>
        )}

        {(item.dotCdl || cdlUploads.length > 0) && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CDL Documents</h4>
            {item.dotCdl && (
              <div className="border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-sm">CDL credentials</h4>
                  <ReviewBadge status={item.dotCdl.status} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="CDL #" value={item.dotCdl.cdlNumber} />
                  <Field label="CDL state / class" value={[item.dotCdl.cdlState, item.dotCdl.cdlClass].filter(Boolean).join(" Â· ") || null} />
                  <Field label="CDL expiry" value={item.dotCdl.cdlExpiry ? new Date(item.dotCdl.cdlExpiry).toLocaleDateString() : null} />
                </div>
                {item.dotCdl.reviewNote && item.dotCdl.status === "rejected" && (
                  <p className="text-sm text-destructive">Rejection reason: {item.dotCdl.reviewNote}</p>
                )}
              </div>
            )}
            {cdlUploads.map((doc) => (
              <UploadedDocReview key={doc.docType} doc={doc} makeAct={makeAct} anyPending={anyPending} />
            ))}
          </div>
        )}

        {otherUploads.map((doc: AdminUploadedComplianceDocument) => (
          <UploadedDocReview key={doc.docType} doc={doc} makeAct={makeAct} anyPending={anyPending} />
        ))}
      </CardContent>
    </Card>
  );
}

function CreditCard_({ item }: { item: AdminCreditApplicationItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const review = useReviewCreditApplication();

  function act(action: "approve" | "reject", note?: string) {
    review.mutate(
      { profileId: item.profileId, data: { action, ...(note ? { note } : {}) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminCreditApplicationsQueryKey() });
          toast({ title: action === "approve" ? "Credit approved" : "Credit rejected" });
        },
        onError: () => toast({ title: "Action failed", variant: "destructive" }),
      },
    );
  }

  return (
    <Card className="rounded-none border-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-4 h-4 text-primary" /> {item.profile.companyName}
          </CardTitle>
          <CardDescription>
            {item.profile.contactName || "â"}
            {item.profile.email ? ` Â· ${item.profile.email}` : ""}
          </CardDescription>
        </div>
        <ReviewBadge status={item.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Wants Invoicing" value={item.wantsInvoicing ? "Yes" : "No"} />
          <Field
            label="Est. Monthly Spend"
            value={item.estimatedMonthlySpend != null ? `$${item.estimatedMonthlySpend.toLocaleString()}` : null}
          />
          <Field label="Bank Reference" value={item.bankReference} />
          <div className="col-span-2 md:col-span-3">
            <Field label="Trade References" value={item.tradeReferences} />
          </div>
        </div>
        <ReviewActions
          approveLabel="Approve"
          approveIcon={<CheckCircle2 className="w-4 h-4 mr-1" />}
          approveDisabled={item.status === "approved"}
          rejectDisabled={item.status === "rejected"}
          isPending={review.isPending}
          reviewNote={item.reviewNote}
          status={item.status}
          onSubmit={act}
        />
      </CardContent>
    </Card>
  );
}

function StuckPayoutCard({ item }: { item: StuckPayoutItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const retry = useRetryStuckPayout();
  const reset = useResetStuckPayoutFailures();

  function release() {
    retry.mutate(
      { id: item.id },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getListStuckPayoutsQueryKey() });
          if (result.outcome === "released") {
            toast({ title: "Payout released", description: `Job #${item.id} â ${item.providerCompany} has been paid.` });
          } else {
            toast({ title: "Payout not released", description: result.message });
          }
        },
        onError: () =>
          toast({ title: "Retry failed", description: "The transfer couldn't be completed. Try again shortly.", variant: "destructive" }),
      },
    );
  }

  function acknowledge() {
    reset.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStuckPayoutsQueryKey() });
          toast({ title: "Failures reset", description: `Job #${item.id} â failure count and alert cleared.` });
        },
        onError: () =>
          toast({ title: "Reset failed", description: "Couldn't clear the failure count. Try again shortly.", variant: "destructive" }),
      },
    );
  }

  return (
    <Card className="rounded-none border-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Banknote className="w-4 h-4 text-primary" /> Job #{item.id} Â· {item.materialType}
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            {item.customerCompany} <ArrowRight className="w-3 h-3" /> {item.providerCompany}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill intent="warning">
            <Clock className="w-3 h-3 mr-1" /> Stuck
          </StatusPill>
          {item.payoutAlertSentAt != null && (
            <StatusPill intent="danger">
              <ShieldAlert className="w-3 h-3 mr-1" /> Alerted
            </StatusPill>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field
            label="Provider Net"
            value={item.providerNetAmount != null ? `$${item.providerNetAmount.toLocaleString()}` : null}
          />
          <Field
            label="Customer Paid"
            value={item.customerTotalAmount != null ? `$${item.customerTotalAmount.toLocaleString()}` : null}
          />
          <Field label="Attempts" value={item.paymentAttempts} />
          <Field
            label="Retry Failures"
            value={
              <span className={item.payoutRetryFailures > 0 ? "text-destructive font-semibold" : undefined}>
                {item.payoutRetryFailures}
              </span>
            }
          />
        </div>
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-3">
            The customer's payment already went through â only the provider transfer is pending. Releasing
            retries the transfer; the customer is never re-charged.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-none" disabled={retry.isPending} onClick={release}>
              {retry.isPending ? <LoadingSpinner className="w-4 h-4 mr-1" /> : <Banknote className="w-4 h-4 mr-1" />}
              Release Payout
            </Button>
            <Button
              variant="outline"
              className="rounded-none"
              disabled={reset.isPending}
              onClick={acknowledge}
              title="Clear the failure count and alert after resolving the underlying issue"
            >
              {reset.isPending ? <LoadingSpinner className="w-4 h-4 mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
              Reset Failures
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Human-readable labels for every staff role value. The legacy `ap`/`ar` records
// resolve to the Accounting scope on the server, so we surface them as Accounting
// here too (suffixed so it's clear they predate the named-role system).
const STAFF_ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  president: "President",
  cto: "CTO",
  cfo: "CFO",
  accounting: "Accounting",
  it: "IT",
  programmer: "Programmer",
  ap: "Accounting (legacy AP)",
  ar: "Accounting (legacy AR)",
};

const STAFF_ROLE_OPTIONS = ["ceo", "president", "cfo", "cto", "accounting", "it", "programmer"] as const;

function roleLabel(role?: string | null): string {
  if (!role) return "\u2014";
  return STAFF_ROLE_LABELS[role] ?? role.toUpperCase();
}

function StaffRow({ member, canManage }: { member: StaffMember; canManage: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const update = useUpdateStaffRole();

  function setRole(staffRole: string | null) {
    if (staffRole === (member.staffRole ?? null)) return;
    update.mutate(
      { profileId: member.id, data: { staffRole: staffRole as UpdateStaffRoleInput["staffRole"] } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminStaffQueryKey() });
          toast({
            title: staffRole ? "Role updated" : "Staff access removed",
            description: `${member.companyName}${staffRole ? ` is now ${roleLabel(staffRole)}` : ""}.`,
          });
        },
        onError: () => toast({ title: "Couldn't update role", variant: "destructive" }),
      },
    );
  }

  return (
    <Card className="rounded-none border-2">
      <CardContent className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-6">
        <div>
          <div className="font-semibold flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" /> {member.companyName}
          </div>
          <div className="text-sm text-muted-foreground">
            {member.contactName || "\u2014"}
            {member.email ? ` \u00b7 ${member.email}` : ""}
          </div>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            {STAFF_ROLE_OPTIONS.map((role) => (
              <Button
                key={role}
                size="sm"
                variant={member.staffRole === role ? "default" : "outline"}
                className="rounded-none border-2"
                disabled={update.isPending}
                onClick={() => setRole(role)}
              >
                {STAFF_ROLE_LABELS[role]}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="rounded-none text-destructive hover:bg-destructive/10"
              disabled={update.isPending}
              onClick={() => setRole(null)}
              title="Remove staff access"
            >
              {update.isPending ? <LoadingSpinner className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </Button>
          </div>
        ) : (
          <Badge variant="secondary" className="rounded-none border-2 text-sm">
            {roleLabel(member.staffRole)}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

interface StaffSearchResult {
  id: number; role: string | null; staffRole: string | null;
  companyName: string | null; contactName: string | null; email: string | null;
  city: string | null; state: string | null;
}

// Search any user and grant them a staff role. Only rendered for manage_staff users.
function AddStaffPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const update = useUpdateStaffRole();

  const search = useQuery({
    queryKey: ["admin-staff-search", term],
    queryFn: () => apiFetch<StaffSearchResult[]>(`/admin/staff/search?q=${encodeURIComponent(term)}`),
    enabled: term.trim().length >= 2,
  });

  function assign(member: StaffSearchResult, staffRole: string) {
    update.mutate(
      { profileId: member.id, data: { staffRole: staffRole as UpdateStaffRoleInput["staffRole"] } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminStaffQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["admin-staff-search"] });
          toast({ title: "Staff added", description: `${member.companyName ?? member.contactName ?? "User"} is now ${roleLabel(staffRole)}.` });
        },
        onError: () => toast({ title: "Couldn't assign role", variant: "destructive" }),
      },
    );
  }

  const results = search.data ?? [];
  return (
    <Card className="rounded-none border-2 border-dashed">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4 text-primary" /> Add a staff member</CardTitle>
        <CardDescription>Search any registered user by name, company, or email, then assign them a staff role.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={"Search by name, company, or email\u2026"}
          className="w-full border-2 rounded-none bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {term.trim().length < 2 ? (
          <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
        ) : search.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users match “{term}”.</p>
        ) : (
          <div className="space-y-2">
            {results.map((m) => (
              <div key={m.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-2 p-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{m.companyName || m.contactName || "Unnamed"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.contactName && m.companyName ? `${m.contactName} \u00b7 ` : ""}{m.email || ""}
                    {m.staffRole ? ` \u00b7 currently ${roleLabel(m.staffRole)}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {STAFF_ROLE_OPTIONS.map((role) => (
                    <Button key={role} size="sm" variant={m.staffRole === role ? "default" : "outline"} className="rounded-none border-2" disabled={update.isPending} onClick={() => assign(m, role)}>
                      {STAFF_ROLE_LABELS[role]}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StaffPanel({ enabled, canManage }: { enabled: boolean; canManage: boolean }) {
  const staff = useListAdminStaff({ query: { enabled, queryKey: getListAdminStaffQueryKey() } });
  const members = staff.data ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {canManage ? (
          <>
            Assign each HaulBrokr staff member a role. <strong>Accounting</strong> reviews payouts,
            credit, and carrier compliance; <strong>CFO</strong> adds team management;{" "}
            <strong>CTO</strong> and <strong>IT</strong> have full superadmin access; and{" "}
            <strong>CEO</strong> sees everything but can't edit roles.
          </>
        ) : (
          <>You can view the HaulBrokr team roster. Editing staff roles is reserved for CFO, CTO, and IT.</>
        )}
      </p>
      {canManage && <AddStaffPanel />}
      {staff.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : members.length === 0 ? (
        <EmptyState label="No staff members yet. Staff appear here once assigned a role." />
      ) : (
        members.map((m) => <StaffRow key={m.id} member={m} canManage={canManage} />)
      )}
    </div>
  );
}

// Bin-order fulfilment lifecycle. Each non-terminal status exposes exactly one
// forward move; this mirrors the server's ADVANCE_TRANSITIONS so the UI only ever
// offers a valid next step (picked_up and cancelled are terminal â no action).
const BIN_NEXT_ACTION: Record<
  string,
  { status: AdvanceBinOrderInput["status"]; label: string }
> = {
  pending: { status: "confirmed", label: "Confirm Order" },
  confirmed: { status: "delivered", label: "Mark Delivered" },
  delivered: { status: "picked_up", label: "Mark Picked Up" },
};

// Badge styling keyed off the enriched displayStatus the API returns.
function BinStatusBadge({ displayStatus }: { displayStatus: string }) {
  switch (displayStatus) {
    case "pending":
      return <StatusPill intent="warning"><Clock className="w-3 h-3 mr-1" /> Pending</StatusPill>;
    case "confirmed":
      return <StatusPill intent="primary"><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmed</StatusPill>;
    case "active":
      return <StatusPill intent="success"><Truck className="w-3 h-3 mr-1" /> Delivered</StatusPill>;
    case "completed":
      return <StatusPill intent="secondary"><PackageCheck className="w-3 h-3 mr-1" /> Picked Up</StatusPill>;
    case "cancelled":
      return <StatusPill intent="danger"><X className="w-3 h-3 mr-1" /> Cancelled</StatusPill>;
    default:
      return <StatusPill intent="secondary">{displayStatus.replace(/_/g, " ")}</StatusPill>;
  }
}

function formatBinDate(value?: string | null): string {
  if (!value) return "â";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "â"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function BinOrderCard({ order }: { order: BinOrder }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const advance = useAdvanceBinOrderStatus();
  const next = BIN_NEXT_ACTION[order.status];

  function move() {
    if (!next) return;
    advance.mutate(
      { id: order.id, data: { status: next.status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminBinOrdersQueryKey() });
          toast({ title: next.label.replace(/^Mark /, "Marked ").replace(/^Confirm /, "Confirmed ") });
        },
        onError: () => toast({ title: "Couldn't update the order", variant: "destructive" }),
      },
    );
  }

  return (
    <Card className="rounded-none border-2">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-4 h-4 text-primary" />
            {order.quantity > 1 ? `${order.quantity}Ã ` : ""}{order.binSizeLabel} {order.binTypeLabel}
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3" /> {order.customerCompany || "Customer"} Â· {order.serviceType === "temporary" ? "Temporary" : "Permanent"}
          </CardDescription>
        </div>
        <BinStatusBadge displayStatus={order.displayStatus} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Delivery Address</div>
            <div className="text-sm font-medium">{order.deliveryAddress}</div>
          </div>
          <Field label="Waste Type" value={order.wasteType.replace(/_/g, " ")} />
          <Field label="Est. Cost" value={order.estimatedCost} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Delivery</div>
            <div className="text-sm font-medium">{formatBinDate(order.deliveryDate)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Pickup</div>
            <div className="text-sm font-medium">{formatBinDate(order.pickupDate)}</div>
          </div>
          <Field label="Preferred Hauler" value={order.preferredProvider && order.preferredProvider !== "any" ? order.preferredProvider.replace(/_/g, " ") : "Any"} />
          {order.notes && <div className="col-span-2 md:col-span-4"><Field label="Notes" value={order.notes} /></div>}
        </div>
        <div className="pt-2 border-t">
          {next ? (
            <Button className="rounded-none" disabled={advance.isPending} onClick={move}>
              {advance.isPending ? <LoadingSpinner className="w-4 h-4 mr-1" /> : <ArrowRight className="w-4 h-4 mr-1" />}
              {next.label}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {order.status === "picked_up"
                ? "This order is complete â the bin has been hauled away."
                : "This order was cancelled. No further action."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BinOrdersPanel({ enabled }: { enabled: boolean }) {
  const orders = useListAdminBinOrders({ query: { enabled, queryKey: getListAdminBinOrdersQueryKey() } });
  const items = orders.data ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Track incoming bin orders and move each one forward as it's dropped off and hauled away.
        Only the valid next step is offered per order.
      </p>
      {orders.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <EmptyState label="No bin orders yet. New orders appear here as customers place them." />
      ) : (
        items.map((order) => <BinOrderCard key={order.id} order={order} />)
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <DesignEmptyState
      className="py-16"
      icon={<CheckCircle2 className="w-8 h-8 opacity-40" />}
      title={label}
    />
  );
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function StatCard({
  icon, label, value, hint, accent,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return <MetricCard icon={icon} label={label} value={value} hint={hint} accent={accent} />;
}

// A pending-review tile that doubles as a jump link into the relevant tab.
function ReviewQueueTile({
  icon, label, count, onClick,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left border-2 rounded-none p-4 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon} {label}
        </div>
        {count > 0 ? (
          <StatusPill intent="warning">{count}</StatusPill>
        ) : (
          <StatusPill intent="secondary">0</StatusPill>
        )}
      </div>
      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
        {count > 0 ? "Needs review" : "All clear"} <ArrowRight className="w-3 h-3" />
      </div>
    </button>
  );
}

function OverviewPanel({
  enabled, onJump, canBins,
}: {
  enabled: boolean;
  onJump: (tab: string) => void;
  canBins: boolean;
}) {
  const overview = useGetAdminOverview({
    query: { enabled, queryKey: getGetAdminOverviewQueryKey() },
  });
  const data: AdminOverview | undefined = overview.data;

  if (overview.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  if (!data) {
    return <EmptyState label="Couldn't load platform stats. Try refreshing." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Business at a glance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<DollarSign className="w-3.5 h-3.5" />}
            label="GMV"
            value={money(data.gmv)}
            hint="Total customer-billed"
            accent
          />
          <StatCard
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="Broker Fees"
            value={money(data.brokerFees)}
            hint="Platform revenue earned"
            accent
          />
          <StatCard
            icon={<Briefcase className="w-3.5 h-3.5" />}
            label="Total Jobs"
            value={data.totalJobs.toLocaleString()}
            hint="All hauls brokered"
          />
          <StatCard
            icon={<Activity className="w-3.5 h-3.5" />}
            label="Active Jobs"
            value={data.activeJobs.toLocaleString()}
            hint="In progress now"
          />
          <StatCard
            icon={<PackageCheck className="w-3.5 h-3.5" />}
            label="Completed Hauls"
            value={data.completedJobs.toLocaleString()}
          />
          <StatCard
            icon={<Truck className="w-3.5 h-3.5" />}
            label="Carriers"
            value={data.newCarriers.toLocaleString()}
            hint="Provider accounts"
          />
          <StatCard
            icon={<UserPlus className="w-3.5 h-3.5" />}
            label="Customers"
            value={data.newCustomers.toLocaleString()}
            hint="Customer accounts"
          />
          <StatCard
            icon={<Banknote className="w-3.5 h-3.5" />}
            label="Stuck Payouts"
            value={
              <span className={data.stuckPayouts > 0 ? "text-destructive" : undefined}>
                {data.stuckPayouts.toLocaleString()}
              </span>
            }
            hint="Awaiting transfer"
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Review queues
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ReviewQueueTile
            icon={<Truck className="w-4 h-4 text-primary" />}
            label="Carriers"
            count={data.pendingCompliance}
            onClick={() => onJump("compliance")}
          />
          <ReviewQueueTile
            icon={<CreditCard className="w-4 h-4 text-primary" />}
            label="Credit"
            count={data.pendingCredit}
            onClick={() => onJump("credit")}
          />
          <ReviewQueueTile
            icon={<Banknote className="w-4 h-4 text-primary" />}
            label="Payouts"
            count={data.stuckPayouts}
            onClick={() => onJump("payouts")}
          />
          {canBins && (
            <ReviewQueueTile
              icon={<Package className="w-4 h-4 text-primary" />}
              label="Bin Orders"
              count={data.openBinOrders}
              onClick={() => onJump("bins")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: access, isLoading: accessLoading } = useGetAdminAccess();
  const isAdmin = !!access?.isAdmin;
  const perms = (access?.permissions ?? []) as string[];
  const canOverview = perms.includes("overview");
  const canCompliance = perms.includes("compliance");
  const canCredit = perms.includes("credit");
  const canPayouts = perms.includes("payouts");
  const canBins = perms.includes("bins");
  const canManageStaff = perms.includes("manage_staff");
  const canViewStaff = perms.includes("view_staff") || canManageStaff;
  const [tab, setTab] = useState<string | null>(null);

  const compliance = useListAdminCompliance({
    query: { enabled: canCompliance, queryKey: getListAdminComplianceQueryKey() },
  });
  const credit = useListAdminCreditApplications({
    query: { enabled: canCredit, queryKey: getListAdminCreditApplicationsQueryKey() },
  });
  const payouts = useListStuckPayouts({
    query: { enabled: canPayouts, queryKey: getListStuckPayoutsQueryKey() },
  });
  const binOrders = useListAdminBinOrders({
    query: { enabled: canBins, queryKey: getListAdminBinOrdersQueryKey() },
  });

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-4">
        <Alert variant="destructive" className="rounded-none border-2">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access restricted</AlertTitle>
          <AlertDescription>
            This area is for HaulBrokr staff only. Sign in with your staff credentials or use a Clerk account with an assigned staff role.
          </AlertDescription>
        </Alert>
        <Button className="rounded-none" onClick={() => window.location.assign("/admin/login")}>
          <Lock className="h-4 w-4 mr-2" /> Staff login
        </Button>
      </div>
    );
  }

  const complianceItems = compliance.data ?? [];
  const creditItems = credit.data ?? [];
  const payoutItems = payouts.data ?? [];
  const binItems = binOrders.data ?? [];
  const pendingCompliance = complianceItems.filter((i) => i.hasPendingReview).length;
  const pendingCredit = creditItems.filter((i) => i.status === "pending").length;
  // Orders still needing a staff action (anything not yet terminal).
  const openBins = binItems.filter((o) => o.status !== "picked_up" && o.status !== "cancelled").length;
  // Overview is the default landing tab for every role; fall back to the first
  // tab the role can access if (somehow) it lacks the overview permission.
  const defaultTab = canOverview
    ? "overview"
    : canCompliance ? "compliance"
    : canCredit ? "credit"
    : canPayouts ? "payouts"
    : canBins ? "bins"
    : "staff";
  const activeTab = tab ?? defaultTab;

  return (
    <AdminDashboardLayout>
      <PageTransition className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary" /> Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Platform overview, carrier &amp; credit review, payouts, bin orders, and team management.
            {(access as { staffDisplayName?: string | null }).staffDisplayName
              ? ` Â· Signed in as ${(access as { staffDisplayName?: string | null }).staffDisplayName}`
              : ""}
          </p>
        </div>
        {(access as { authMethod?: string | null }).authMethod === "staff" && (
          <Button
            variant="outline"
            className="rounded-none border-2 shrink-0"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
              window.location.assign("/admin/login");
            }}
          >
            Sign out
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList className="rounded-none">
          {canOverview && (
            <TabsTrigger value="overview" className="rounded-none gap-2">
              <LayoutDashboard className="w-4 h-4" /> Overview
            </TabsTrigger>
          )}
          {canCompliance && (
            <TabsTrigger value="compliance" className="rounded-none gap-2">
              <Truck className="w-4 h-4" /> Carriers
              {pendingCompliance > 0 && (
                <StatusPill intent="warning" className="ml-1">{pendingCompliance}</StatusPill>
              )}
            </TabsTrigger>
          )}
          {canCredit && (
            <TabsTrigger value="credit" className="rounded-none gap-2">
              <CreditCard className="w-4 h-4" /> Credit
              {pendingCredit > 0 && (
                <StatusPill intent="warning" className="ml-1">{pendingCredit}</StatusPill>
              )}
            </TabsTrigger>
          )}
          {canPayouts && (
            <TabsTrigger value="payouts" className="rounded-none gap-2">
              <Banknote className="w-4 h-4" /> Payouts
              {payoutItems.length > 0 && (
                <StatusPill intent="warning" className="ml-1">{payoutItems.length}</StatusPill>
              )}
            </TabsTrigger>
          )}
          {canBins && (
            <TabsTrigger value="bins" className="rounded-none gap-2">
              <Package className="w-4 h-4" /> Bin Orders
              {openBins > 0 && (
                <StatusPill intent="warning" className="ml-1">{openBins}</StatusPill>
              )}
            </TabsTrigger>
          )}
          {canViewStaff && (
            <TabsTrigger value="staff" className="rounded-none gap-2">
              {canManageStaff ? <Users className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Team
            </TabsTrigger>
          )}
        </TabsList>

        {canOverview && (
          <TabsContent value="overview" className="space-y-4 mt-4">
            <AdminInsights enabled={canOverview && activeTab === "overview"} />
          </TabsContent>
        )}

        {canCompliance && (
          <TabsContent value="compliance" className="space-y-4 mt-4">
            {compliance.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : complianceItems.length === 0 ? (
              <EmptyState label="No carrier compliance records submitted yet." />
            ) : (
              complianceItems.map((item) => <ProviderComplianceCard key={item.profileId} item={item} />)
            )}
          </TabsContent>
        )}

        {canCredit && (
          <TabsContent value="credit" className="space-y-4 mt-4">
            {credit.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : creditItems.length === 0 ? (
              <EmptyState label="No credit applications submitted yet." />
            ) : (
              creditItems.map((item) => <CreditCard_ key={item.id} item={item} />)
            )}
          </TabsContent>
        )}

        {canPayouts && (
          <TabsContent value="payouts" className="space-y-4 mt-4">
            {payouts.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : payoutItems.length === 0 ? (
              <EmptyState label="No stuck payouts â all provider transfers are settled." />
            ) : (
              payoutItems.map((item) => <StuckPayoutCard key={item.id} item={item} />)
            )}
          </TabsContent>
        )}

        {canBins && (
          <TabsContent value="bins" className="space-y-4 mt-4">
            <BinOrdersPanel enabled={canBins} />
          </TabsContent>
        )}

        {canViewStaff && (
          <TabsContent value="staff" className="space-y-4 mt-4">
            <StaffPanel enabled={canViewStaff} canManage={canManageStaff} />
          </TabsContent>
        )}
      </Tabs>
      </PageTransition>
    </AdminDashboardLayout>
  );
}
