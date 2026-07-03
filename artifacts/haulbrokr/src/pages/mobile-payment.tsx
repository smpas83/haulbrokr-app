import { CheckCircle } from "lucide-react";
import { useSetPaymentMethod, useUpdatePaymentMethod } from "@workspace/api-client-react";
import { StripeCardForm } from "@/components/stripe-card-form";
import { useToast } from "@/hooks/use-toast";

const RETURN_URL = "haulbrokr://payment-return";

/**
 * Minimal card-setup page for mobile in-app browser flows.
 * Mobile opens https://<domain>/mobile-payment and returns via haulbrokr://payment-return
 */
export default function MobilePaymentPage() {
  const { toast } = useToast();
  const setPm = useSetPaymentMethod();
  const updatePm = useUpdatePaymentMethod();

  const onSaved = (paymentMethodId: string) => {
    const cardData = {
      methodType: "credit_card" as const,
      stripePaymentMethodId: paymentMethodId,
    };

    setPm.mutate(
      { data: cardData },
      {
        onSuccess: () => {
          toast({ title: "Card saved", description: "Your payment method is ready." });
          window.location.href = RETURN_URL;
        },
        onError: () => {
          updatePm.mutate(
            { data: cardData },
            {
              onSuccess: () => {
                toast({ title: "Card updated" });
                window.location.href = RETURN_URL;
              },
              onError: (e) =>
                toast({ title: "Could not save card", description: e.message, variant: "destructive" }),
            },
          );
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md border border-border/60 bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Add Payment Card</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Secure card setup powered by Stripe. When finished, you&apos;ll return to the HaulBrokr app.
        </p>
        <StripeCardForm
          onSaved={onSaved}
          saving={setPm.isPending || updatePm.isPending}
          saveLabel="Save card"
        />
      </div>
    </div>
  );
}
