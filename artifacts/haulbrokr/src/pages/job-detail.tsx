import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, MapPin, Calendar, Truck, HardHat, DollarSign, 
  Clock, Flag, CheckCircle2, Navigation, Loader2, Camera, MessageSquare, Plus,
  Receipt, Wallet, ArrowRight, UserCheck, AlertTriangle, ShieldCheck, ListChecks, AlertCircle, CreditCard
} from "lucide-react";
import { 
  useGetJob, useUpdateJob, useAcceptJob, useDeclineJob, useGetMyProfile, getGetJobQueryKey,
  useChargeJob, useReleaseJobPayment, useConfirmJobPayment, getJobPaymentConfirmation,
  useCreateJobCheckoutSession, useVerifyJobCheckout,
  useGetPaymentMethod, useSetPaymentMethod, useUpdatePaymentMethod, getGetPaymentMethodQueryKey,
  useAssignJob, useApproveJobCompletion, useFlagJobCompletion,
  useListJobStatusUpdates, useListOrgMembers, useListTrucks, getListJobStatusUpdatesQueryKey,
  type Job
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CarrierDocuments } from "@/components/documents";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { StripeCardForm } from "@/components/stripe-card-form";
import { loadStripe } from "@stripe/stripe-js";
import { StripeBankForm } from "@/components/stripe-bank-form";
import { MicrodepositVerify } from "@/components/microdeposit-verify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { storagePublicUrl, uploadFileToStorage } from "@/lib/storageUpload";
import DriverJobDetail from "@/pages/driver/DriverJobDetail";

async function apiFetch(path: string, options?: RequestInit) {
  const url = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Request failed"); }
  return res.json();
}

function PhotoFileInput({
  id,
  label,
  file,
  onFileChange,
  disabled,
}: {
  id: string;
  label: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <Input
          id={id}
          type="file"
          accept="image/*"
          className="rounded-none"
          disabled={disabled}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        {file && <span className="text-xs text-muted-foreground truncate">{file.name}</span>}
      </div>
    </div>
  );
}

function formatTruckType(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStartTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h)) return value;
  const d = new Date();
  d.setHours(h, m ?? 0, 0, 0);
  return format(d, "h:mm a");
}

function EvidencePanel({ jobId, canUpload }: { jobId: number; canUpload: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ photoCaption: "", siteNotes: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: evidence = [], isLoading } = useQuery({
    queryKey: ["evidence", jobId],
    queryFn: () => apiFetch(`/jobs/${jobId}/evidence`),
    enabled: !!jobId,
  });

  const submit = useMutation({
    mutationFn: async () => {
      let photoUrl: string | undefined;
      if (photoFile) {
        const { objectPath } = await uploadFileToStorage(photoFile);
        photoUrl = storagePublicUrl(objectPath);
      }
      return apiFetch(`/jobs/${jobId}/evidence`, {
        method: "POST",
        body: JSON.stringify({ ...form, photoUrl }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence", jobId] });
      toast({ title: "Evidence submitted" });
      setForm({ photoCaption: "", siteNotes: "" });
      setPhotoFile(null);
      setShowForm(false);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="border-t-2 border-border p-6 md:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Camera className="h-5 w-5 text-muted-foreground" /> Proof of Delivery &amp; Site Notes
        </h3>
        {canUpload && (
          <Button size="sm" variant="outline" className="rounded-none border-2 font-bold text-xs" onClick={() => setShowForm(s => !s)}>
            <Plus className="h-3 w-3 mr-1" />{showForm ? "Cancel" : "Add Evidence"}
          </Button>
        )}
      </div>

      {showForm && canUpload && (
        <div className="bg-muted/30 border-2 border-border p-4 space-y-3">
          <PhotoFileInput
            id={`evidence-photo-${jobId}`}
            label="Delivery Photo"
            file={photoFile}
            onFileChange={setPhotoFile}
            disabled={submit.isPending}
          />
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Photo Caption</Label>
            <Input className="rounded-none mt-1" value={form.photoCaption} onChange={e => setForm(f => ({ ...f, photoCaption: e.target.value }))} placeholder="Load dumped at designated zone" />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Site Notes (visible to customer)</Label>
            <Input className="rounded-none mt-1" value={form.siteNotes} onChange={e => setForm(f => ({ ...f, siteNotes: e.target.value }))} placeholder="Gate code is 1234. Foreman on site." />
          </div>
          <Button size="sm" className="rounded-none font-bold w-full" disabled={submit.isPending || !photoFile} onClick={() => submit.mutate()}>
            {submit.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Submit Evidence
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      ) : (evidence as any[]).length === 0 ? (
        <div className="border-2 border-dashed border-border p-8 text-center">
          <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No delivery photos or site notes yet</p>
          {canUpload && <p className="text-xs text-muted-foreground mt-1">Add proof of delivery once you've completed the drop-off</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {(evidence as any[]).map((e: any) => (
            <div key={e.id} className="bg-muted/20 border border-border p-4 space-y-2">
              {e.photoUrl && (
                <div>
                  <img src={e.photoUrl} alt={e.photoCaption || "Delivery photo"} className="max-h-48 object-cover border border-border w-full" onError={(ev) => (ev.currentTarget.style.display = "none")} />
                  {e.photoCaption && <p className="text-xs text-muted-foreground mt-1 italic">{e.photoCaption}</p>}
                </div>
              )}
              {e.siteNotes && (
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{e.siteNotes}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Submitted {e.uploadedAt ? format(new Date(e.uploadedAt), "MMM d, yyyy h:mm a") : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const fmtMoney = (n?: number | null) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "Awaiting Payment",
  invoiced: "Invoiced (Net Terms)",
  paid: "Customer Paid",
  released: "Paid Out to Provider",
  requires_action: "Confirmation Needed",
  failed: "Payment Failed",
};

function paymentBadgeClass(status?: string) {
  switch (status) {
    case "released": return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300";
    case "paid": return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "invoiced": return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300";
    case "failed": return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300";
    case "requires_action": return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300";
    default: return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300";
  }
}

const PM_METHOD_LABEL: Record<string, string> = {
  credit_card: "Credit / Debit Card",
  ach: "ACH Bank Transfer",
  net_15: "Net 15 Terms",
  net_30: "Net 30 Terms",
  net_45: "Net 45 Terms",
};

function describePaymentMethod(pm: any): string {
  if (!pm) return "No payment method on file";
  if (pm.methodType === "credit_card") {
    const brand = pm.cardBrand || "Card";
    return pm.cardLast4 ? `${brand} ending ${pm.cardLast4}` : brand;
  }
  if (pm.methodType === "ach") {
    const bank = pm.bankName || "Bank account";
    const label = pm.accountLast4 ? `${bank} ending ${pm.accountLast4}` : bank;
    return pm.verificationStatus === "pending" ? `${label} (verification pending)` : label;
  }
  return PM_METHOD_LABEL[pm.methodType] ?? pm.methodType;
}

type PaymentForm = {
  methodType: string;
  cardholderName: string;
  cardBrand: string;
  cardLast4: string;
  cardExpMonth: string;
  cardExpYear: string;
  bankName: string;
  routingLast4: string;
  accountLast4: string;
};

const EMPTY_PAYMENT_FORM: PaymentForm = {
  methodType: "credit_card",
  cardholderName: "",
  cardBrand: "",
  cardLast4: "",
  cardExpMonth: "",
  cardExpYear: "",
  bankName: "",
  routingLast4: "",
  accountLast4: "",
};

/**
 * Lets a customer switch to a different card/bank (or update the saved one)
 * directly from a failed job before retrying. Retrying re-reads the saved
 * method server-side, so the new instrument is used on the next attempt.
 */
function ChangePaymentMethod() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pm, error, isLoading } = useGetPaymentMethod();
  const { data: profile } = useGetMyProfile();
  const isNotFound = !!error && (error as any).status === 404;
  const hasMethod = !!pm && !isNotFound;

  const setPm = useSetPaymentMethod();
  const updatePm = useUpdatePaymentMethod();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PaymentForm>(EMPTY_PAYMENT_FORM);

  const openEditor = () => {
    setForm({
      ...EMPTY_PAYMENT_FORM,
      methodType: (pm?.methodType as string) || "credit_card",
      cardholderName: pm?.cardholderName || "",
      cardBrand: pm?.cardBrand || "",
      cardLast4: pm?.cardLast4 || "",
      cardExpMonth: pm?.cardExpMonth || "",
      cardExpYear: pm?.cardExpYear || "",
      bankName: pm?.bankName || "",
      routingLast4: pm?.routingLast4 || "",
      accountLast4: pm?.accountLast4 || "",
    });
    setEditing(true);
  };

  const set = (k: keyof PaymentForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isPending = setPm.isPending || updatePm.isPending;

  const save = () => {
    const data: Record<string, any> = { methodType: form.methodType };
    if (form.methodType === "credit_card") {
      Object.assign(data, {
        cardholderName: form.cardholderName,
        cardBrand: form.cardBrand,
        cardLast4: form.cardLast4,
        cardExpMonth: form.cardExpMonth,
        cardExpYear: form.cardExpYear,
      });
    } else if (form.methodType === "ach") {
      Object.assign(data, {
        bankName: form.bankName,
        routingLast4: form.routingLast4,
        accountLast4: form.accountLast4,
      });
    }
    persist(data);
  };

  const persist = (data: Record<string, any>) => {
    const action = hasMethod ? updatePm.mutate : setPm.mutate;
    action({ data } as any, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPaymentMethodQueryKey() });
        toast({ title: "Payment method updated", description: "Your next retry will use this method." });
        setEditing(false);
      },
      onError: (err: unknown) =>
        toast({ title: "Couldn't update payment method", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
    });
  };

  // Stripe confirmed the card → persist the PaymentMethod id (server derives
  // brand/last4/exp). Retrying the job re-reads this, so the new card is charged.
  const onCardSaved = (paymentMethodId: string) => {
    persist({ methodType: "credit_card", stripePaymentMethodId: paymentMethodId, cardholderName: form.cardholderName });
  };

  // Stripe verified the bank account → persist the us_bank_account PaymentMethod id
  // (server derives bank name / last4). The SetupIntent id lets the server flag
  // whether micro-deposit verification is still pending. Retrying re-reads this.
  const onBankSaved = (paymentMethodId: string, setupIntentId: string) => {
    persist({ methodType: "ach", stripePaymentMethodId: paymentMethodId, stripeSetupIntentId: setupIntentId });
  };

  return (
    <div className="border-2 border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Payment method
          </p>
          <p className="text-sm font-medium truncate">{isLoading ? "Loading…" : describePaymentMethod(hasMethod ? pm : null)}</p>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" className="rounded-none border-2 font-bold text-xs flex-shrink-0" onClick={openEditor}>
            {hasMethod ? "Use a different card" : "Add payment method"}
          </Button>
        )}
      </div>

      {!editing && hasMethod && pm?.methodType === "ach" && pm?.verificationStatus === "pending" && (
        <MicrodepositVerify
          onVerified={() => queryClient.invalidateQueries({ queryKey: getGetPaymentMethodQueryKey() })}
        />
      )}

      {editing && (
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Payment type</Label>
            <Select value={form.methodType} onValueChange={(v) => setForm(f => ({ ...f, methodType: v }))}>
              <SelectTrigger className="rounded-none border-2 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-none border-2">
                {Object.entries(PM_METHOD_LABEL).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.methodType === "credit_card" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cardholder name</Label>
                <Input className="rounded-none mt-1" value={form.cardholderName} onChange={set("cardholderName")} placeholder="Jane Doe" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Card</Label>
                <div className="mt-1">
                  <StripeCardForm
                    onSaved={onCardSaved}
                    saving={isPending}
                    saveLabel={hasMethod ? "Replace card" : "Save card"}
                    onCancel={() => setEditing(false)}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Entered securely with Stripe — card details never touch our servers.</p>
              </div>
            </div>
          )}

          {form.methodType === "ach" && (
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bank account</Label>
              <StripeBankForm
                onSaved={onBankSaved}
                saving={isPending}
                saveLabel={hasMethod ? "Replace bank account" : "Connect bank account"}
                onCancel={() => setEditing(false)}
                accountHolderName={profile?.companyName || profile?.contactName || ""}
                email={profile?.email || undefined}
              />
              <p className="text-xs text-muted-foreground">Connected securely with Stripe — bank credentials never touch our servers.</p>
            </div>
          )}

          {form.methodType.startsWith("net_") && (
            <p className="text-xs text-muted-foreground">Net terms are subject to credit approval.</p>
          )}

          {form.methodType.startsWith("net_") && (
            <div className="flex gap-2">
              <Button size="sm" className="rounded-none font-bold" disabled={isPending} onClick={save}>
                {isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Save payment method
              </Button>
              <Button size="sm" variant="ghost" className="rounded-none" disabled={isPending} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lets a customer complete bank authentication (3-D Secure) for a job parked in
 * `requires_action`. We fetch the PaymentIntent's client secret, run
 * confirmCardPayment on-session (no card re-entry — the card is already on the
 * intent), then finalize server-side to release the provider's payout.
 */
function ConfirmCardPayment({ jobId }: { jobId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirm = useConfirmJobPayment();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setWorking(true);
    setError(null);
    try {
      const { clientSecret, publishableKey } = await getJobPaymentConfirmation(jobId);
      const stripe = await loadStripe(publishableKey);
      if (!stripe) throw new Error("Couldn't load the payment form. Please refresh and try again.");
      // No payment_method passed — Stripe re-uses the card already on the intent
      // and surfaces the bank's authentication challenge.
      const result = await stripe.confirmCardPayment(clientSecret);
      if (result.error) {
        setError(result.error.message ?? "We couldn't confirm the payment. Please try again.");
        return;
      }
      await confirm.mutateAsync({ id: jobId });
      queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
      toast({ title: "Payment confirmed", description: "Thanks — your payment is complete." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't confirm the payment. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </p>
      )}
      <Button className="rounded-none font-bold w-full" disabled={working} onClick={handleConfirm}>
        {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
        Confirm Payment
      </Button>
    </div>
  );
}

function PaymentPanel({ job, isCustomer, isProvider }: { job: Job; isCustomer: boolean; isProvider: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const onSettled = {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(job.id) }),
    onError: (err: unknown) =>
      toast({ title: "Payment action failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
  };

  // When the bank requires re-authentication the server returns the job in
  // `requires_action` rather than a success — toast accordingly instead of
  // claiming the payment went through.
  const charge = useChargeJob({ mutation: { ...onSettled, onSuccess: (data) => { onSettled.onSuccess(); toast(data.paymentStatus === "requires_action" ? { title: "Confirmation needed", description: "Your bank needs you to verify this card below." } : { title: "Payment processed" }); } } });
  const release = useReleaseJobPayment({ mutation: { ...onSettled, onSuccess: (data) => { onSettled.onSuccess(); toast(data.paymentStatus === "requires_action" ? { title: "Confirmation needed", description: "Your bank needs you to verify this card below." } : { title: "Payout released to provider" }); } } });

  const checkoutSession = useCreateJobCheckoutSession({
    mutation: {
      onSuccess: (data) => { window.location.href = data.url; },
      onError: (err: unknown) =>
        toast({ title: "Couldn't start Checkout", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
    },
  });
  const verifyCheckout = useVerifyJobCheckout({
    mutation: {
      onSuccess: () => { onSettled.onSuccess(); toast({ title: "Payment received", description: "Your Checkout payment was confirmed and the provider has been paid." }); },
      onError: (err: unknown) =>
        toast({ title: "Checkout verification failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" }),
    },
  });

  // On return from Stripe-hosted Checkout the bouncer appends ?checkout=done&
  // session_id=... (or checkout=cancel). Verify synchronously, then strip the
  // params so a refresh can't re-trigger. The ref guards React StrictMode's
  // double-invoke from firing two verifies for the same session.
  const handledCheckoutRef = useRef(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const outcome = sp.get("checkout");
    if (!outcome) return;
    if (handledCheckoutRef.current) return;
    handledCheckoutRef.current = true;

    const sessionId = sp.get("session_id");
    if (outcome === "done" && sessionId) {
      verifyCheckout.mutate({ id: job.id, data: { sessionId } });
    } else if (outcome === "cancel") {
      toast({ title: "Checkout cancelled", description: "No payment was taken. You can try again whenever you're ready." });
    }
    sp.delete("checkout");
    sp.delete("session_id");
    const clean = window.location.pathname + (sp.toString() ? `?${sp.toString()}` : "");
    window.history.replaceState(null, "", clean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = job.paymentStatus ?? "unpaid";
  const feeRate = job.platformFeeRate ?? 0.15;
  const base = job.providerNetAmount ?? job.totalAmount;
  const pending = charge.isPending || release.isPending;

  // A failed job that already carries an invoice failed on payout release, so it
  // is retried via /release; an instant-terms failure (no invoice) via /charge.
  const failedWithInvoice = status === "failed" && job.invoicedAt != null;
  const showCharge = status === "unpaid" || (status === "failed" && !failedWithInvoice);
  const showRelease = status === "invoiced" || status === "paid" || failedWithInvoice;

  return (
    <div className="border-t-2 border-border p-6 md:p-8 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Receipt className="h-5 w-5 text-muted-foreground" /> Payment &amp; Broker Fee
        </h3>
        <Badge className={`rounded-none border-2 font-bold uppercase text-xs px-3 py-1 ${paymentBadgeClass(status)}`}>
          {PAYMENT_LABEL[status] ?? status}
        </Badge>
      </div>

      <div className="border-2 border-border divide-y divide-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">Work value (provider rate × hours)</p>
            <p className="text-xs text-muted-foreground">{job.totalHours ? `${job.totalHours} hrs @ $${job.ratePerHour}/hr` : "Driver's full earnings"}</p>
          </div>
          <p className="font-bold tabular-nums">{fmtMoney(base)}</p>
        </div>
        <div className="flex items-center justify-between p-4 bg-muted/30">
          <div>
            <p className="text-sm font-medium">HaulBrokr broker fee</p>
            <p className="text-xs text-muted-foreground">{Math.round(feeRate * 100)}% — deducted before the driver is paid</p>
          </div>
          <p className="font-bold tabular-nums text-primary">+ {fmtMoney(job.platformFeeAmount)}</p>
        </div>
        <div className="flex items-center justify-between p-4 bg-secondary text-secondary-foreground">
          <p className="text-sm font-black uppercase tracking-wider">Customer total</p>
          <p className="text-xl font-black tabular-nums">{fmtMoney(job.customerTotalAmount)}</p>
        </div>
        <div className="flex items-center justify-between p-4">
          <p className="text-sm font-medium flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" /> Provider net payout</p>
          <p className="font-bold tabular-nums text-green-700 dark:text-green-400">{fmtMoney(job.providerNetAmount)}</p>
        </div>
      </div>

      {status === "invoiced" && job.paymentDueDate && (
        <p className="text-sm text-muted-foreground">
          Invoice issued{job.invoicedAt ? ` ${format(new Date(job.invoicedAt), "MMM d, yyyy")}` : ""} · Due {format(new Date(job.paymentDueDate), "MMM d, yyyy")}.
          The provider is paid once this invoice is settled.
        </p>
      )}
      {status === "released" && (
        <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Provider received {fmtMoney(job.providerNetAmount)}. HaulBrokr retained {fmtMoney(job.platformFeeAmount)}.
        </p>
      )}

      {status === "failed" && (
        <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> The last payment attempt didn&apos;t go through. Update or switch your payment method below, then try again.
        </p>
      )}

      {/* Recoverable: the bank wants the customer to authenticate this same card.
          No hard decline — they confirm on-session and the job settles without
          re-entering card details. */}
      {status === "requires_action" && (
        <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" /> Your bank needs you to confirm this payment. Your card is fine — just verify it to finish.
        </p>
      )}
      {isCustomer && status === "requires_action" && <ConfirmCardPayment jobId={job.id} />}

      {/* On a failed payment, let the customer switch/update their card before retrying. */}
      {isCustomer && status === "failed" && <ChangePaymentMethod />}

      {/* Customer actions */}
      {isCustomer && showCharge && (
        <Button className="rounded-none font-bold w-full" disabled={pending} onClick={() => charge.mutate({ id: job.id })}>
          {charge.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
          {status === "failed" ? `Retry Payment ${fmtMoney(job.customerTotalAmount)}` : `Pay ${fmtMoney(job.customerTotalAmount)}`}
        </Button>
      )}
      {isCustomer && showRelease && (
        <Button className="rounded-none font-bold w-full" disabled={pending} onClick={() => release.mutate({ id: job.id })}>
          {release.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
          {failedWithInvoice ? "Retry Payout to Provider" : status === "invoiced" ? "Settle Invoice & Release Payout" : "Release Payout to Provider"}
        </Button>
      )}

      {/* Additive second payment path: a Stripe-hosted Checkout page (destination
          charge). Offered for the same payable states as the off-session flow. */}
      {isCustomer && (showCharge || showRelease) && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            variant="outline"
            className="rounded-none font-bold w-full"
            disabled={pending || checkoutSession.isPending || verifyCheckout.isPending}
            onClick={() => checkoutSession.mutate({ id: job.id, data: { returnTo: window.location.origin + window.location.pathname } })}
          >
            {checkoutSession.isPending || verifyCheckout.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            {verifyCheckout.isPending ? "Confirming payment…" : `Pay with Stripe Checkout ${fmtMoney(job.customerTotalAmount)}`}
          </Button>
          <p className="text-xs text-muted-foreground text-center">Pay securely on Stripe&apos;s hosted page with any card.</p>
        </div>
      )}

      {/* Provider read-only context */}
      {isProvider && (status === "unpaid" || status === "invoiced") && (
        <p className="text-sm text-muted-foreground">
          {status === "invoiced"
            ? "Customer is on Net terms — your net payout is released once they settle the invoice."
            : "Awaiting customer payment. Your net payout is transferred automatically once they pay."}
        </p>
      )}
    </div>
  );
}

const STATUS_UPDATE_LABEL: Record<string, string> = {
  checked_in: "Checked In",
  started: "Work Started",
  ticket_uploaded: "Haul Ticket Uploaded",
  photo_uploaded: "Job Photo Uploaded",
  en_route: "En Route",
  arrived: "Arrived On Site",
  loading: "Loading",
  loaded: "Loaded",
  dumping: "Dumping",
  completed: "Completed",
};

function HaulTicketsPanel({ jobId }: { jobId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["tickets", jobId],
    queryFn: () => apiFetch(`/jobs/${jobId}/tickets`),
    enabled: !!jobId,
  });
  const tickets = (data?.tickets ?? []) as any[];

  if (isLoading) {
    return <div className="border-t-2 border-border p-6 md:p-8"><Skeleton className="h-24 w-full" /></div>;
  }
  if (tickets.length === 0) return null;

  return (
    <div className="border-t-2 border-border p-6 md:p-8 space-y-4">
      <h3 className="font-bold text-lg flex items-center gap-2">
        <Receipt className="h-5 w-5 text-muted-foreground" /> Haul Tickets
      </h3>
      <div className="space-y-3">
        {tickets.map((t) => (
          <div key={t.id} className="bg-muted/20 border border-border p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-sm">Load #{t.loadNumber}</span>
              <Badge variant="outline" className="rounded-none text-xs uppercase">{t.status.replace("_", " ")}</Badge>
            </div>
            {t.weightTons != null && <p className="text-sm">Weight: {t.weightTons} tons</p>}
            {t.notes && <p className="text-sm text-muted-foreground">{t.notes}</p>}
            {t.photoUrl && (
              <img src={t.photoUrl} alt={`Load #${t.loadNumber} ticket`} className="max-h-48 object-cover border border-border w-full" onError={(ev) => (ev.currentTarget.style.display = "none")} />
            )}
            {t.clockedInAt && (
              <p className="text-xs text-muted-foreground">Checked in {format(new Date(t.clockedInAt), "MMM d, h:mm a")}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DriverFieldOpsPanel({ job }: { job: Job }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const updateJob = useUpdateJob();
  const [ticketForm, setTicketForm] = useState({ weightTons: "", notes: "" });
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [photoForm, setPhotoForm] = useState({ photoCaption: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const { data: ticketData } = useQuery({
    queryKey: ["tickets", job.id],
    queryFn: () => apiFetch(`/jobs/${job.id}/tickets`),
    enabled: !!job.id,
  });
  const myTicket = ((ticketData?.tickets ?? []) as any[]).find((t) => t.driverProfileId === profile?.id);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetJobQueryKey(job.id) });
    qc.invalidateQueries({ queryKey: ["tickets", job.id] });
    qc.invalidateQueries({ queryKey: ["evidence", job.id] });
    qc.invalidateQueries({ queryKey: getListJobStatusUpdatesQueryKey(job.id) });
  };

  const checkIn = useMutation({
    mutationFn: () => apiFetch(`/tickets/${myTicket.id}/clock-in`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Checked in" }); refresh(); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const uploadTicket = useMutation({
    mutationFn: async () => {
      let photoUrl: string | undefined;
      if (ticketFile) {
        const { objectPath } = await uploadFileToStorage(ticketFile);
        photoUrl = storagePublicUrl(objectPath);
      }
      return apiFetch(`/jobs/${job.id}/tickets`, {
        method: "POST",
        body: JSON.stringify({
          weightTons: ticketForm.weightTons ? Number(ticketForm.weightTons) : undefined,
          photoUrl,
          notes: ticketForm.notes || undefined,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Haul ticket uploaded" });
      setTicketForm({ weightTons: "", notes: "" });
      setTicketFile(null);
      refresh();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const uploadPhoto = useMutation({
    mutationFn: async () => {
      if (!photoFile) throw new Error("Choose a photo to upload");
      const { objectPath } = await uploadFileToStorage(photoFile);
      return apiFetch(`/jobs/${job.id}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          photoUrl: storagePublicUrl(objectPath),
          photoCaption: photoForm.photoCaption || undefined,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Photo uploaded" });
      setPhotoForm({ photoCaption: "" });
      setPhotoFile(null);
      refresh();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const handleStart = () => {
    updateJob.mutate({ id: job.id, data: { status: "in_progress" } }, {
      onSuccess: () => { toast({ title: "Work started" }); refresh(); },
      onError: (e) => toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" }),
    });
  };

  const handleComplete = () => {
    updateJob.mutate({ id: job.id, data: { status: "completed" } }, {
      onSuccess: () => { toast({ title: "Job completed" }); refresh(); },
      onError: (e) => toast({ title: e instanceof Error ? e.message : "Failed", variant: "destructive" }),
    });
  };

  if (!myTicket) {
    return (
      <div className="border-t-2 border-border p-6 md:p-8">
        <Alert className="border-amber-500/80 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Driver assignment required before check-in</AlertTitle>
          <AlertDescription>
            Your dispatcher must assign you to this job and create a load ticket before you can check in,
            upload haul tickets, or submit field photos. Contact your fleet manager if you expected to be on this load.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeStatuses = ["accepted", "active", "in_progress"];
  if (!activeStatuses.includes(job.status)) return null;

  return (
    <div className="border-t-2 border-border p-6 md:p-8 space-y-6">
      <h3 className="font-bold text-lg flex items-center gap-2">
        <Truck className="h-5 w-5 text-muted-foreground" /> Field Operations
      </h3>
      <div className="flex flex-wrap gap-3">
        {!myTicket.clockedInAt && (
          <Button className="rounded-none font-bold" onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>
            {checkIn.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Check In
          </Button>
        )}
        {(job.status === "accepted" || job.status === "active") && (
          <Button className="rounded-none font-bold bg-purple-600 hover:bg-purple-700 text-white" onClick={handleStart} disabled={updateJob.isPending}>
            {updateJob.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flag className="mr-2 h-4 w-4" />}
            Start Work
          </Button>
        )}
        {job.status === "in_progress" && (
          <Button className="rounded-none font-bold bg-green-600 hover:bg-green-700 text-white" onClick={handleComplete} disabled={updateJob.isPending}>
            {updateJob.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Complete Job
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-muted/30 border-2 border-border p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Upload Haul Ticket</p>
          <Input className="rounded-none" placeholder="Weight (tons)" value={ticketForm.weightTons} onChange={(e) => setTicketForm((f) => ({ ...f, weightTons: e.target.value }))} />
          <PhotoFileInput
            id={`ticket-photo-${job.id}`}
            label="Ticket Photo"
            file={ticketFile}
            onFileChange={setTicketFile}
            disabled={uploadTicket.isPending}
          />
          <Input className="rounded-none" placeholder="Notes" value={ticketForm.notes} onChange={(e) => setTicketForm((f) => ({ ...f, notes: e.target.value }))} />
          <Button size="sm" className="rounded-none font-bold w-full" disabled={uploadTicket.isPending || !ticketFile} onClick={() => uploadTicket.mutate()}>
            {uploadTicket.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Submit Ticket
          </Button>
        </div>
        <div className="bg-muted/30 border-2 border-border p-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Upload Job Photo</p>
          <PhotoFileInput
            id={`job-photo-${job.id}`}
            label="Job Photo"
            file={photoFile}
            onFileChange={setPhotoFile}
            disabled={uploadPhoto.isPending}
          />
          <Input className="rounded-none" placeholder="Caption" value={photoForm.photoCaption} onChange={(e) => setPhotoForm((f) => ({ ...f, photoCaption: e.target.value }))} />
          <Button size="sm" className="rounded-none font-bold w-full" disabled={uploadPhoto.isPending || !photoFile} onClick={() => uploadPhoto.mutate()}>
            {uploadPhoto.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Submit Photo
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusTimeline({ jobId }: { jobId: number }) {
  const { data: updates, isLoading } = useListJobStatusUpdates(jobId);
  const items = updates ?? [];

  if (isLoading) {
    return <div className="border-t-2 border-border p-6 md:p-8"><Skeleton className="h-24 w-full" /></div>;
  }
  if (items.length === 0) return null;

  return (
    <div className="border-t-2 border-border p-6 md:p-8 space-y-4">
      <h3 className="font-bold text-lg flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-muted-foreground" /> Driver Status Updates
      </h3>
      <div className="space-y-3">
        {items.map((u) => (
          <div key={u.id} className="flex items-start gap-3">
            <div className="mt-1 w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">{STATUS_UPDATE_LABEL[u.status] ?? u.status}</span>
                {u.actorName && <span className="text-xs text-muted-foreground">by {u.actorName}</span>}
                <span className="text-xs text-muted-foreground">· {format(new Date(u.createdAt), "MMM d, h:mm a")}</span>
              </div>
              {u.note && <p className="text-sm text-muted-foreground mt-0.5">{u.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignDriverPanel({ job }: { job: Job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [driverId, setDriverId] = useState<string>("");
  const [truckId, setTruckId] = useState<string>("");

  const { data: membersResp } = useListOrgMembers();
  const { data: trucks } = useListTrucks();
  const { data: ticketData } = useQuery({
    queryKey: ["tickets", job.id],
    queryFn: () => apiFetch(`/jobs/${job.id}/tickets`),
    enabled: !!job.id,
  });
  const assignedTickets = (ticketData?.tickets ?? []) as any[];
  const drivers = (membersResp?.members ?? []).filter(m => m.role === "driver");
  const needsAssignment = assignedTickets.length === 0;

  const assign = useAssignJob({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(job.id) });
        queryClient.invalidateQueries({ queryKey: ["tickets", job.id] });
        toast({ title: "Driver assigned", description: "A load ticket has been created." });
        setDriverId("");
        setTruckId("");
      },
      onError: (e: any) => toast({ title: "Failed to assign driver", description: e.message, variant: "destructive" }),
    },
  });

  const handleAssign = () => {
    if (!driverId) return;
    assign.mutate({
      id: job.id,
      data: {
        driverProfileId: Number(driverId),
        ...(truckId ? { truckId: Number(truckId) } : {}),
      },
    });
  };

  return (
    <div className="border-t-2 border-border p-6 md:p-8 space-y-4">
      {needsAssignment ? (
        <Alert className="border-amber-500/80 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Assign a driver before field check-in</AlertTitle>
          <AlertDescription>
            Drivers cannot check in or upload tickets until you assign them here and a load ticket is created.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-600/40 bg-green-50 text-green-950 dark:bg-green-950/30 dark:text-green-100">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>{assignedTickets.length} driver{assignedTickets.length === 1 ? "" : "s"} assigned</AlertTitle>
          <AlertDescription>Assigned drivers can check in and upload haul tickets from the field.</AlertDescription>
        </Alert>
      )}
      <h3 className="font-bold text-lg flex items-center gap-2">
        <UserCheck className="h-5 w-5 text-muted-foreground" /> Dispatch Driver & Truck
      </h3>
      <p className="text-sm text-muted-foreground">
        Assign one of your drivers (and optionally a specific truck) to this job. This creates a load ticket the driver can act on.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Driver <span className="text-destructive">*</span>
          </Label>
          <Select value={driverId} onValueChange={setDriverId}>
            <SelectTrigger className="rounded-none border-2 mt-1">
              <SelectValue placeholder={drivers.length === 0 ? "No drivers available" : "Select driver..."} />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2">
              {drivers.map(d => (
                <SelectItem key={d.id} value={String(d.id)}>{d.contactName || d.companyName || `Driver #${d.id}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Truck (optional)</Label>
          <Select value={truckId} onValueChange={setTruckId}>
            <SelectTrigger className="rounded-none border-2 mt-1">
              <SelectValue placeholder="Select truck..." />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2">
              {(trucks ?? []).map(t => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.truckNumber ? `#${t.truckNumber} — ` : ""}{t.truckType.replace("_", " ")} ({t.capacityTons}t)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button className="rounded-none font-bold" onClick={handleAssign} disabled={!driverId || assign.isPending}>
        {assign.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
        Assign & Create Load Ticket
      </Button>
      {drivers.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No drivers in your company yet. Invite them from the Company page.</p>
      )}
    </div>
  );
}

function CompletionReviewPanel({ job }: { job: Job }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [showFlag, setShowFlag] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(job.id) });

  const approve = useApproveJobCompletion({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Job completion approved" }); },
      onError: (e: any) => toast({ title: "Failed to approve", description: e.message, variant: "destructive" }),
    },
  });

  const flag = useFlagJobCompletion({
    mutation: {
      onSuccess: () => { invalidate(); setShowFlag(false); setReason(""); toast({ title: "Completion flagged", description: "The provider has been notified." }); },
      onError: (e: any) => toast({ title: "Failed to flag", description: e.message, variant: "destructive" }),
    },
  });

  const approval = job.completionApproval ?? "pending";

  return (
    <div className="border-t-2 border-border p-6 md:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" /> Completion Review
        </h3>
        <Badge className={`rounded-none border-2 font-bold uppercase text-xs px-3 py-1 ${
          approval === "approved" ? "bg-green-100 text-green-800 border-green-300"
          : approval === "flagged" ? "bg-red-100 text-red-800 border-red-300"
          : "bg-amber-100 text-amber-800 border-amber-300"
        }`}>
          {approval}
        </Badge>
      </div>

      {approval === "approved" ? (
        <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Completion approved{job.completionApprovedAt ? ` on ${format(new Date(job.completionApprovedAt), "MMM d, yyyy h:mm a")}` : ""}.
        </p>
      ) : approval === "flagged" ? (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 space-y-2">
          <p className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Completion flagged with an issue
          </p>
          {job.flagReason && <p className="text-sm">{job.flagReason}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          The provider marked this job as completed. Review the work and approve it, or flag an issue.
        </p>
      )}

      {approval !== "approved" && (
        <div className="space-y-3">
          {showFlag ? (
            <div className="bg-muted/30 border-2 border-border p-4 space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason for flag</Label>
              <Textarea
                className="rounded-none border-2"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Describe what's wrong (e.g. incomplete haul, wrong material, damage)..."
              />
              <div className="flex gap-2">
                <Button
                  className="rounded-none font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={!reason.trim() || flag.isPending}
                  onClick={() => flag.mutate({ id: job.id, data: { reason: reason.trim() } })}
                >
                  {flag.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Flag className="h-4 w-4 mr-2" />}
                  Submit Flag
                </Button>
                <Button variant="ghost" className="rounded-none" onClick={() => { setShowFlag(false); setReason(""); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="rounded-none font-bold bg-green-600 hover:bg-green-700 text-white flex-1"
                disabled={approve.isPending}
                onClick={() => approve.mutate({ id: job.id })}
              >
                {approve.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Approve Completion
              </Button>
              <Button
                variant="outline"
                className="rounded-none border-2 font-bold text-destructive hover:bg-destructive/10 hover:border-destructive flex-1"
                onClick={() => setShowFlag(true)}
              >
                <Flag className="h-4 w-4 mr-2" /> Flag an Issue
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile } = useGetMyProfile();
  const { data: job, isLoading } = useGetJob(id, {
    query: { enabled: !!id } as any
  });

  const updateJob = useUpdateJob();
  const acceptJob = useAcceptJob();
  const declineJob = useDeclineJob();

  const isCustomer = profile?.role === "customer";
  const isProvider = profile?.role === "provider";
  const isDriver = profile?.role === "driver";
  const canUploadEvidence = isProvider || isDriver;

  const refreshJob = () => queryClient.invalidateQueries({ queryKey: getGetJobQueryKey(id) });

  const handleAcceptAward = () => {
    acceptJob.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Job accepted. You can start when ready." });
        refreshJob();
      },
      onError: (err) => toast({
        title: "Failed to accept job",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
    });
  };

  const handleDeclineAward = () => {
    declineJob.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Job declined." });
        refreshJob();
      },
      onError: (err) => toast({
        title: "Failed to decline job",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      }),
    });
  };

  const handleUpdateStatus = (newStatus: "in_progress" | "completed") => {
    updateJob.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          toast({ title: `Job marked as ${newStatus.replace('_', ' ')}` });
          refreshJob();
        },
        onError: (err) => {
          toast({ 
            title: "Failed to update status", 
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive"
          });
        }
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "awarded": return "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
      case "accepted":
      case "active": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "declined":
      case "cancelled": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      case "in_progress": return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800";
      case "completed": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <h2 className="text-2xl font-bold">Job not found</h2>
        <Button className="mt-4" onClick={() => setLocation("/jobs")}>Back to Jobs</Button>
      </div>
    );
  }

  if (isDriver) {
    return (
      <div className="max-w-5xl mx-auto">
        <DriverJobDetail jobId={id} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <Button variant="ghost" className="mb-2 -ml-4" onClick={() => setLocation("/jobs")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Jobs
      </Button>

      <div className="bg-card border-2 border-border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-secondary text-secondary-foreground p-6 md:p-8 flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-black tracking-tight uppercase">
                JOB-{job.id.toString().padStart(4, '0')}
              </h1>
              <Badge className={`rounded-none border-2 font-bold uppercase text-xs px-3 py-1 ${getStatusColor(job.status)}`}>
                {job.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-xl font-medium text-secondary-foreground/80 capitalize">
              {job.materialType} Haul
            </p>
          </div>
          
          <div className="text-left md:text-right bg-black/20 p-4 rounded-sm border border-white/10 min-w-[200px]">
            <p className="text-sm font-bold uppercase tracking-wider text-secondary-foreground/60 mb-1">Agreed Rate</p>
            <p className="text-3xl font-black">${job.ratePerHour}<span className="text-lg font-medium text-secondary-foreground/70">/hr</span></p>
          </div>
        </div>

        {/* Action Bar (Provider Only) */}
        {isProvider && job.status !== "completed" && (
          <div className="bg-muted p-4 border-b border-border flex flex-wrap gap-4 items-center justify-between">
            <div className="font-bold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Navigation className="h-4 w-4" /> Dispatch Controls
            </div>
            <div className="flex gap-3">
              {job.status === "awarded" && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleDeclineAward}
                    disabled={declineJob.isPending || acceptJob.isPending}
                    className="font-bold rounded-none border-2"
                  >
                    Decline Award
                  </Button>
                  <Button
                    onClick={handleAcceptAward}
                    disabled={declineJob.isPending || acceptJob.isPending}
                    className="font-bold rounded-none bg-green-600 hover:bg-green-700 text-white"
                  >
                    {acceptJob.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Accept Job
                  </Button>
                </>
              )}
              {(job.status === "accepted" || job.status === "active") && (
                <Button 
                  onClick={() => handleUpdateStatus("in_progress")}
                  disabled={updateJob.isPending}
                  className="font-bold rounded-none bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {updateJob.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flag className="mr-2 h-4 w-4" />}
                  Start Job
                </Button>
              )}
              {job.status === "in_progress" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="font-bold rounded-none bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark Completed
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-none border-2">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Complete this job?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the job as finished and notify the customer. Make sure all hauling is complete.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-none border-2">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        className="rounded-none bg-green-600 hover:bg-green-700"
                        onClick={() => handleUpdateStatus("completed")}
                      >
                        Confirm Completion
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Left Col - Entities & Logistics */}
          <div className="p-6 md:p-8 space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Customer Site</p>
                <p className="text-lg font-bold flex items-center gap-2">
                  <HardHat className="h-5 w-5 text-primary" />
                  {job.customerCompany}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Fleet Provider</p>
                <p className="text-lg font-bold flex items-center gap-2 justify-end">
                  {job.providerCompany}
                  <Truck className="h-5 w-5 text-primary" />
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Schedule & Resources
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Date</p>
                  <p className="font-bold">{format(new Date(job.scheduledDate), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Start Time</p>
                  <p className="font-bold">{job.startTime ? formatStartTime(job.startTime) : "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Material</p>
                  <p className="font-bold capitalize">{job.materialType}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Truck Type</p>
                  <p className="font-bold">{job.truckType ? formatTruckType(job.truckType) : "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Committed Trucks</p>
                  <p className="font-bold">{job.trucksAssigned} Trucks</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Estimated Hours</p>
                  <p className="font-bold">~{job.estimatedHours} hours</p>
                </div>
                {job.startedAt && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Started At</p>
                    <p className="font-bold">{format(new Date(job.startedAt), "h:mm a")}</p>
                  </div>
                )}
                {job.completedAt && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Completed At</p>
                    <p className="font-bold">{format(new Date(job.completedAt), "h:mm a")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Col - Routing */}
          <div className="p-6 md:p-8 bg-muted/10 space-y-8">
            <div>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                Route Information
              </h3>
              
              <div className="relative pl-8 pb-8">
                <div className="absolute left-3 top-2 bottom-0 w-0.5 bg-border border-dashed border-l-2"></div>
                <div className="absolute left-[9px] top-2 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background"></div>
                
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Pickup</p>
                <div className="bg-background border-2 border-border p-4 shadow-sm">
                  <p className="font-medium whitespace-pre-line">{job.pickupAddress}</p>
                </div>
              </div>
              
              <div className="relative pl-8">
                <div className="absolute left-[9px] top-2 w-2.5 h-2.5 rounded-full border-2 border-primary bg-background ring-4 ring-background"></div>
                
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Delivery</p>
                <div className="bg-background border-2 border-border p-4 shadow-sm">
                  <p className="font-medium whitespace-pre-line">{job.deliveryAddress}</p>
                </div>
              </div>
            </div>

            {job.notes && (
              <div className="pt-6">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Customer Instructions</p>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 border-l-4 border-yellow-400">
                  <p className="text-sm font-medium whitespace-pre-line">{job.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {isProvider && (job.status === "accepted" || job.status === "active" || job.status === "in_progress") && (
          <AssignDriverPanel job={job} />
        )}

        {isCustomer && (job.status === "accepted" || job.status === "active" || job.status === "in_progress" || job.status === "completed") && (
          <CarrierDocuments jobId={job.id} />
        )}

        {isDriver && <DriverFieldOpsPanel job={job} />}

        {job.status === "completed" && isCustomer && (
          <CompletionReviewPanel job={job} />
        )}

        {job.status === "completed" && (
          <PaymentPanel job={job} isCustomer={isCustomer} isProvider={isProvider} />
        )}

        <StatusTimeline jobId={id} />

        <HaulTicketsPanel jobId={id} />

        <EvidencePanel jobId={id} canUpload={canUploadEvidence} />
      </div>
    </div>
  );
}