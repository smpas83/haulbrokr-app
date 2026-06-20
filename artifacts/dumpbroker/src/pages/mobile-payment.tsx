import { CheckCircle } from "lucide-react";
import { useSetPaymentMethod, useUpdatePaymentMethod } from "@workspace/api-client-react";
import { StripeCardForm } from "@/components/stripe-card-form";
import { useToast } from "@/hooks/use-toast";

/**
 * Minimal card-setup page for mobile in-app browser flows.
 * Mobile opens https://<domain>/mobile-payment and returns via dumpbroker://payment-return
 */
export default function MobilePaymentPage() {
  const { toast } = useToast();
  const setPm = useSetPaymentMethod();
  const updatePm = useUpdatePaymentMethod();

  const onSaved = (paymentMethodId: string) => {
    setPm.mutate(
      { data: { methodType: "credit_card", stripePaymentMethodId: paymentMethodId } },
        {
          onSuccess: () => {
            toast({ title: "Card saved", description: "Your payment method is ready." });
            window.location.href = "dumpbroker://payment-return";
          },
          onError: (err) => {
            updatePm.mutate(
              { data: { stripePaymentMethodId: paymentMethodId } },
              {
                onSuccess: () => {
                  toast({ title: "Card updated" });
                  window.location.href = "dumpbroker://payment-return";
                },
                onError: (e) => toast({ title: "Could not save card", description: e.message, variant: "destructive" }),
              },
            );
          },
        },
      );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md border-2 border-border bg-card p-6 space-y-4">
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
