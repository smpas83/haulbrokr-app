import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2, CheckCircle2, AlertCircle, Clock, ShieldAlert,
  ShieldCheck, CreditCard, Truck, Building2, X, Banknote, ArrowRight, RotateCcw,
  Users, UserCog, Package, MapPin, Calendar, PackageCheck,
  LayoutDashboard, DollarSign, TrendingUp, Briefcase, Activity, UserPlus, Lock,
} from "lucide-react";
import {
  useGetAdminAccess,
  useGetAdminOverview, getGetAdminOverviewQueryKey,
  useListAdminCompliance, useReviewCompliance, getListAdminComplianceQueryKey,
  useListAdminCreditApplications, useReviewCreditApplication, getListAdminCreditApplicationsQueryKey,
  useListStuckPayouts, useRetryStuckPayout, useResetStuckPayoutFailures, getListStuckPayoutsQueryKey,
  useListAdminStaff, useUpdateStaffRole, getListAdminStaffQueryKey,
  useListAdminBinOrders, useAdvanceBinOrderStatus, getListAdminBinOrdersQueryKey,
  type AdminComplianceItem, type AdminCreditApplicationItem, type StuckPayoutItem,
  type StaffMember, type BinOrder, type AdvanceBinOrderInput, type AdminOverview,
  type UpdateStaffRoleInput,
} from "@workspace/api-client-react";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Approve / reject controls shared by the carrier and credit cards. Rejecting
 * reveals a reason box so the admin can explain why — that note is stored and
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
            placeholder="Reason for rejection (shared with the applicant)…"
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
              {isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <AlertCircle className="w-4 h-4 mr-1" />}
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
            {isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : approveIcon}
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
    return <Badge className="bg-green-500 hover:bg-green-600 rounded-none"><CheckCircle2 className="w-3 h-3 mr-1" /> {status === "verified" ? "Verified" : "Approved"}</Badge>;
  }
  if (status === "pending") {
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-none"><Clock className="w-3 h-3 mr-1" /> Pending Review</Badge>;
  }
  if (status === "rejected") {
    return <Badge variant="destructive" className="rounded-none"><AlertCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
  }
  return <Badge variant="secondary" className="rounded-none text-muted-foreground">{status.replace(/_/g, " ")}</Badge>;
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value === null || value === undefined || value === "" ? "—" : value}</div>
    </div>
  );
}

function ComplianceCard({ item }: { item: AdminComplianceItem }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const review = useReviewCompliance();

  function act(action: "approve" | "reject", note?: string) {
    review.mutate(
      { profileId: item.profileId, data: { action, ...(note ? { note } : {}) } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminComplianceQueryKey() });
          toast({ title: action === "approve" ? "Carrier approved" : "Carrier rejected" });
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
            <Truck className="w-4 h-4 text-primary" /> {item.profile.companyName}
          </CardTitle>
          <CardDescription>
            {item.profile.contactName || "—"}
            {item.profile.city ? ` · ${item.profile.city}, ${item.profile.state ?? ""}` : ""}
          </CardDescription>
        </div>
        <ReviewBadge status={item.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="DOT #" value={item.dotNumber} />
          <Field label="MC #" value={item.mcNumber} />
          <Field label="CDL #" value={item.cdlNumber} />
          <Field label="CDL State / Class" value={[item.cdlState, item.cdlClass].filter(Boolean).join(" · ") || null} />
          <Field label="FMCSA Authority" value={item.fmcsaAuthority} />
          <Field label="Insurance" value={item.insuranceActive} />
          <Field label="Operating Status" value={item.dotOperatingStatus} />
          <Field label="Not Suspended" value={item.notSuspended} />
        </div>
        <ReviewActions
          approveLabel="Approve"
          approveIcon={<ShieldCheck className="w-4 h-4 mr-1" />}
          approveDisabled={item.status === "verified"}
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
            {item.profile.contactName || "—"}
            {item.profile.email ? ` · ${item.profile.email}` : ""}
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
            toast({ title: "Payout released", description: `Job #${item.id} — ${item.providerCompany} has been paid.` });
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
          toast({ title: "Failures reset", description: `Job #${item.id} — failure count and alert cleared.` });
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
            <Banknote className="w-4 h-4 text-primary" /> Job #{item.id} · {item.materialType}
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            {item.customerCompany} <ArrowRight className="w-3 h-3" /> {item.providerCompany}
          </CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-none">
            <Clock className="w-3 h-3 mr-1" /> Stuck
          </Badge>
          {item.payoutAlertSentAt != null && (
            <Badge className="bg-red-600 hover:bg-red-700 text-white rounded-none">
              <ShieldAlert className="w-3 h-3 mr-1" /> Alerted
            </Badge>
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
              <span className={item.payoutRetryFailures > 0 ? "text-red-600 font-semibold" : undefined}>
                {item.payoutRetryFailures}
              </span>
            }
          />
        </div>
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-3">
            The customer's payment already went through — only the provider transfer is pending. Releasing
            retries the transfer; the customer is never re-charged.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-none" disabled={retry.isPending} onClick={release}>
              {retry.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Banknote className="w-4 h-4 mr-1" />}
              Release Payout
            </Button>
            <Button
              variant="outline"
              className="rounded-none"
              disabled={reset.isPending}
              onClick={acknowledge}
              title="Clear the failure count and alert after resolving the underlying issue"
            >
              {reset.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1" />}
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
  cto: "CTO",
  cfo: "CFO",
  accounting: "Accounting",
  it: "IT",
  ap: "Accounting (legacy AP)",
  ar: "Accounting (legacy AR)",
};

// The roles a manager may assign — must mirror ASSIGNABLE_ROLES on the server.
const STAFF_ROLE_OPTIONS = ["ceo", "cfo", "cto", "accounting", "it"] as const;

function roleLabel(role?: string | null): string {
  if (!role) return "—";
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
            {member.contactName || "—"}
            {member.email ? ` · ${member.email}` : ""}
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
              {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
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
// offers a valid next step (picked_up and cancelled are terminal → no action).
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
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-none"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    case "confirmed":
      return <Badge className="bg-blue-500 hover:bg-blue-600 rounded-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmed</Badge>;
    case "active":
      return <Badge className="bg-green-500 hover:bg-green-600 rounded-none"><Truck className="w-3 h-3 mr-1" /> Delivered</Badge>;
    case "completed":
      return <Badge variant="secondary" className="rounded-none"><PackageCheck className="w-3 h-3 mr-1" /> Picked Up</Badge>;
    case "cancelled":
      return <Badge variant="destructive" className="rounded-none"><X className="w-3 h-3 mr-1" /> Cancelled</Badge>;
    default:
      return <Badge variant="secondary" className="rounded-none">{displayStatus.replace(/_/g, " ")}</Badge>;
  }
}

function formatBinDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
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
            {order.quantity > 1 ? `${order.quantity}× ` : ""}{order.binSizeLabel} {order.binTypeLabel}
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3" /> {order.customerCompany || "Customer"} · {order.serviceType === "temporary" ? "Temporary" : "Permanent"}
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
              {advance.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1" />}
              {next.label}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {order.status === "picked_up"
                ? "This order is complete — the bin has been hauled away."
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
    <div className="text-center py-16 text-muted-foreground border-2 border-dashed">
      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{label}</p>
    </div>
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
  return (
    <Card className="rounded-none border-2">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </div>
        <div className={`mt-2 text-2xl font-bold tracking-tight ${accent ? "text-primary" : ""}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
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
          <Badge className="bg-amber-500 text-amber-950 rounded-none">{count}</Badge>
        ) : (
          <Badge variant="secondary" className="rounded-none text-muted-foreground">0</Badge>
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
              <span className={data.stuckPayouts > 0 ? "text-red-600" : undefined}>
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Alert variant="destructive" className="rounded-none border-2">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Access restricted</AlertTitle>
          <AlertDescription>
            This area is for HaulBrokr staff only. You don't have admin access.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const complianceItems = compliance.data ?? [];
  const creditItems = credit.data ?? [];
  const payoutItems = payouts.data ?? [];
  const binItems = binOrders.data ?? [];
  const pendingCompliance = complianceItems.filter((i) => i.status === "pending" || i.status === "not_submitted").length;
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-primary" /> Command Center
        </h1>
        <p className="text-muted-foreground mt-1">
          Platform overview, carrier &amp; credit review, payouts, bin orders, and team management.
        </p>
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
                <Badge className="bg-amber-500 text-amber-950 rounded-none ml-1">{pendingCompliance}</Badge>
              )}
            </TabsTrigger>
          )}
          {canCredit && (
            <TabsTrigger value="credit" className="rounded-none gap-2">
              <CreditCard className="w-4 h-4" /> Credit
              {pendingCredit > 0 && (
                <Badge className="bg-amber-500 text-amber-950 rounded-none ml-1">{pendingCredit}</Badge>
              )}
            </TabsTrigger>
          )}
          {canPayouts && (
            <TabsTrigger value="payouts" className="rounded-none gap-2">
              <Banknote className="w-4 h-4" /> Payouts
              {payoutItems.length > 0 && (
                <Badge className="bg-amber-500 text-amber-950 rounded-none ml-1">{payoutItems.length}</Badge>
              )}
            </TabsTrigger>
          )}
          {canBins && (
            <TabsTrigger value="bins" className="rounded-none gap-2">
              <Package className="w-4 h-4" /> Bin Orders
              {openBins > 0 && (
                <Badge className="bg-amber-500 text-amber-950 rounded-none ml-1">{openBins}</Badge>
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
            <OverviewPanel enabled={canOverview && activeTab === "overview"} onJump={setTab} canBins={canBins} />
          </TabsContent>
        )}

        {canCompliance && (
          <TabsContent value="compliance" className="space-y-4 mt-4">
            {compliance.isLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : complianceItems.length === 0 ? (
              <EmptyState label="No carrier compliance records submitted yet." />
            ) : (
              complianceItems.map((item) => <ComplianceCard key={item.id} item={item} />)
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
              <EmptyState label="No stuck payouts — all provider transfers are settled." />
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
    </div>
  );
}
