import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useCreatePaymentMethodSetupIntent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

type StripeCardFormProps = {
  /**
   * Called once Stripe has confirmed the card and minted a PaymentMethod id
   * (pm_…). The parent persists it via the payment-method endpoint; the card
   * details themselves never touch our servers.
   */
  onSaved: (paymentMethodId: string) => void;
  onCancel?: () => void;
  /** Reflects the parent's save mutation so the button stays disabled while persisting. */
  saving?: boolean;
  saveLabel?: string;
};

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "16px",
      color: "hsl(var(--foreground))",
      fontFamily: "ui-monospace, monospace",
      "::placeholder": { color: "hsl(var(--muted-foreground))" },
    },
    invalid: { color: "hsl(var(--destructive))" },
  },
};

// Rendered inside <Elements>; here Stripe.js + the CardElement are available so we
// can confirm the SetupIntent and hand the resulting PaymentMethod id upward.
function CardCaptureForm({
  clientSecret,
  onSaved,
  onCancel,
  saving,
  saveLabel,
}: { clientSecret: string } & StripeCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [ready, setReady] = useState(false);

  const handleConfirm = async () => {
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;
    setConfirming(true);
    setError(null);
    const result = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card },
    });
    setConfirming(false);
    if (result.error) {
      setError(
        result.error.message ??
          "Could not verify card. Please check the details and try again.",
      );
      return;
    }
    const pmId = result.setupIntent?.payment_method;
    if (typeof pmId !== "string") {
      setError(
        "Card was verified but no payment method was returned. Please try again.",
      );
      return;
    }
    onSaved(pmId);
  };

  const busy = confirming || saving;

  return (
    <div className="space-y-3">
      <div className="border-2 border-border bg-background p-3 rounded-none">
        <CardElement
          options={CARD_ELEMENT_OPTIONS}
          onReady={() => setReady(true)}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={handleConfirm}
          disabled={!stripe || !ready || busy}
          className="rounded-none font-bold"
        >
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saveLabel ?? "Save card"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="rounded-none border-2 font-bold"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Securely captures a real card with Stripe Elements. On mount it asks the server
 * for a SetupIntent (which also returns the publishable key), boots Stripe.js, and
 * renders a CardElement. We use CardElement + confirmCardSetup (not PaymentElement)
 * so no redirect/return_url is needed for the off-session card we're saving.
 */
export function StripeCardForm({
  onSaved,
  onCancel,
  saving,
  saveLabel,
}: StripeCardFormProps) {
  const setupIntent = useCreatePaymentMethodSetupIntent();
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const start = () => {
    setInitError(null);
    setupIntent.mutate(undefined, {
      onSuccess: (data) => {
        setClientSecret(data.clientSecret);
        setStripePromise(loadStripe(data.publishableKey));
      },
      onError: (err: unknown) =>
        setInitError(
          err instanceof Error
            ? err.message
            : "Could not start secure card setup.",
        ),
    });
  };

  // Kick off the SetupIntent exactly once when the form mounts.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {initError}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="rounded-none font-bold"
            onClick={start}
            disabled={setupIntent.isPending}
          >
            {setupIntent.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Try again
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              className="rounded-none border-2 font-bold"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!stripePromise || !clientSecret) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading secure card form…
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CardCaptureForm
        clientSecret={clientSecret}
        onSaved={onSaved}
        onCancel={onCancel}
        saving={saving}
        saveLabel={saveLabel}
      />
    </Elements>
  );
}
