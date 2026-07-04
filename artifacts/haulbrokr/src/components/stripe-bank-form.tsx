import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useCreatePaymentMethodBankSetupIntent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

type StripeBankFormProps = {
  /**
   * Called once Stripe has minted a us_bank_account PaymentMethod id (pm_…). The
   * parent persists it via the payment-method endpoint, passing the SetupIntent id
   * (seti_…) so the server can tell whether the bank verified instantly or still
   * needs micro-deposit confirmation. The bank credentials never touch our servers.
   */
  onSaved: (paymentMethodId: string, setupIntentId: string) => void;
  onCancel?: () => void;
  /** Reflects the parent's save mutation so the button stays disabled while persisting. */
  saving?: boolean;
  saveLabel?: string;
  /** Pre-filled account holder details Stripe requires to set up an ACH mandate. */
  accountHolderName?: string;
  email?: string;
};

/**
 * Securely captures a real US bank account (ACH) with Stripe. On mount it asks the
 * server for a SetupIntent (which also returns the publishable key) and boots
 * Stripe.js. Clicking the button launches Stripe's hosted bank-account collection
 * flow (instant verification via Financial Connections where supported, falling
 * back to micro-deposits) and confirms the SetupIntent — minting an off-session
 * chargeable us_bank_account PaymentMethod whose id we hand upward.
 */
export function StripeBankForm({ onSaved, onCancel, saving, saveLabel, accountHolderName, email }: StripeBankFormProps) {
  const setupIntent = useCreatePaymentMethodBankSetupIntent();
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const startedRef = useRef(false);

  const start = () => {
    setInitError(null);
    setupIntent.mutate(undefined, {
      onSuccess: async (data) => {
        setClientSecret(data.clientSecret);
        setStripe(await loadStripe(data.publishableKey));
      },
      onError: (err: unknown) =>
        setInitError(err instanceof Error ? err.message : "Could not start secure bank setup."),
    });
  };

  // Kick off the SetupIntent exactly once when the form mounts.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = async () => {
    if (!stripe || !clientSecret) return;
    const name = accountHolderName?.trim();
    if (!name) {
      setError("Enter the account holder's name before connecting a bank account.");
      return;
    }
    setConfirming(true);
    setError(null);

    // 1) Collect the bank account (Financial Connections / instant verification).
    const collectResult = await stripe.collectBankAccountForSetup({
      clientSecret,
      params: {
        payment_method_type: "us_bank_account",
        payment_method_data: {
          billing_details: { name, email: email || undefined },
        },
      },
    });

    if (collectResult.error) {
      setConfirming(false);
      setError(collectResult.error.message ?? "Could not connect your bank account. Please try again.");
      return;
    }

    const collected = collectResult.setupIntent;
    // The customer may cancel the bank-picker before selecting an account.
    if (collected.status === "requires_payment_method") {
      setConfirming(false);
      setError("No bank account was connected. Please try again.");
      return;
    }

    // 2) Confirm the SetupIntent to attach the verified account (and its mandate).
    let intent = collected;
    if (collected.status === "requires_confirmation") {
      const confirmResult = await stripe.confirmUsBankAccountSetup(clientSecret);
      if (confirmResult.error) {
        setConfirming(false);
        setError(confirmResult.error.message ?? "Could not verify your bank account. Please try again.");
        return;
      }
      if (confirmResult.setupIntent) intent = confirmResult.setupIntent;
    }

    setConfirming(false);

    const pmId = intent.payment_method;
    if (typeof pmId !== "string") {
      setError("Bank account was connected but no payment method was returned. Please try again.");
      return;
    }

    // With micro-deposit verification the SetupIntent stays in requires_action
    // until the customer confirms the deposit amounts. The PaymentMethod still
    // exists and can be charged once verified, so we persist it either way; the
    // SetupIntent id lets the server record whether verification is still pending
    // and lets the customer finish micro-deposits later.
    onSaved(pmId, intent.id);
  };

  if (initError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {initError}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" className="rounded-none font-bold" onClick={start} disabled={setupIntent.isPending}>
            {setupIntent.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Try again
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" className="rounded-xl border font-bold" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!stripe || !clientSecret) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading secure bank setup…
      </div>
    );
  }

  const busy = confirming || saving;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Connect your bank securely through Stripe. Most banks verify instantly; if
        yours doesn't, Stripe will send two small deposits to confirm.
      </p>
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleConfirm} disabled={busy} className="rounded-none font-bold">
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saveLabel ?? "Connect bank account"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" className="rounded-xl border font-bold" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
