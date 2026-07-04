import { useState } from "react";
import { useVerifyPaymentMethodMicrodeposits } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, Clock } from "lucide-react";

type MicrodepositVerifyProps = {
  /** Called after the bank account is successfully verified (e.g. to refetch). */
  onVerified?: () => void;
};

/**
 * Lets a customer finish ACH micro-deposit verification when their bank couldn't
 * be linked instantly. Stripe sends 1-2 tiny deposits to the account; the customer
 * either enters the two amounts (in cents/dollars) or the 6-character descriptor
 * code from a single deposit. On success the saved bank account becomes chargeable.
 */
export function MicrodepositVerify({ onVerified }: MicrodepositVerifyProps) {
  const verify = useVerifyPaymentMethodMicrodeposits();
  const [mode, setMode] = useState<"amounts" | "code">("amounts");
  const [amount1, setAmount1] = useState("");
  const [amount2, setAmount2] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Amounts are entered in dollars exactly as they appear on the bank statement
  // (e.g. "0.32"), and converted to the whole cents Stripe expects. Returns null
  // for anything that isn't a valid, sub-dollar deposit amount.
  function toCents(raw: string): number | null {
    const trimmed = raw.trim().replace(/^\$/, "");
    if (!trimmed) return null;
    const dollars = Number(trimmed);
    if (!Number.isFinite(dollars) || dollars <= 0 || dollars >= 1) return null;
    return Math.round(dollars * 100);
  }

  function submit() {
    setError(null);
    let body: { amounts?: number[]; descriptorCode?: string };
    if (mode === "amounts") {
      const c1 = toCents(amount1);
      const c2 = toCents(amount2);
      if (c1 == null || c2 == null) {
        setError("Enter both deposit amounts, e.g. 0.32 and 0.45.");
        return;
      }
      body = { amounts: [c1, c2] };
    } else {
      const trimmed = code.trim().toUpperCase();
      if (!trimmed) {
        setError("Enter the descriptor code from your bank statement.");
        return;
      }
      body = { descriptorCode: trimmed };
    }
    verify.mutate(
      { data: body },
      {
        onSuccess: () => {
          setDone(true);
          onVerified?.();
        },
        onError: (err: unknown) =>
          setError(
            err instanceof Error
              ? err.message
              : "Verification failed. Double-check and try again.",
          ),
      },
    );
  }

  if (done) {
    return (
      <Alert className="rounded-none border-green-600/40 bg-green-50 dark:bg-green-950/20">
        <AlertTitle className="text-green-700 dark:text-green-400">
          Bank account verified
        </AlertTitle>
        <AlertDescription>
          Your bank account is now ready to use for payments.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="rounded-none border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 space-y-3">
      <Clock className="h-4 w-4" />
      <AlertTitle>Finish verifying your bank account</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          Stripe sent small deposits to your bank account (1-2 business days).
          Enter the two amounts in dollars exactly as they appear on your
          statement (e.g. $0.32) — or the descriptor code from a single deposit
          — to confirm ownership and start using this account for payments.
        </p>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode("amounts");
              setError(null);
            }}
            className={`underline-offset-2 ${mode === "amounts" ? "font-bold underline" : "text-muted-foreground"}`}
          >
            Enter deposit amounts
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={() => {
              setMode("code");
              setError(null);
            }}
            className={`underline-offset-2 ${mode === "code" ? "font-bold underline" : "text-muted-foreground"}`}
          >
            Use descriptor code
          </button>
        </div>

        {mode === "amounts" ? (
          <div className="flex items-center gap-2 max-w-xs">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                inputMode="decimal"
                placeholder="0.32"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                className="rounded-none pl-5"
              />
            </div>
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                inputMode="decimal"
                placeholder="0.45"
                value={amount2}
                onChange={(e) => setAmount2(e.target.value)}
                className="rounded-none pl-5"
              />
            </div>
          </div>
        ) : (
          <Input
            placeholder="SM11AA"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-none max-w-xs font-mono uppercase"
          />
        )}

        {error && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </p>
        )}

        <Button
          type="button"
          onClick={submit}
          disabled={verify.isPending}
          className="rounded-none font-bold"
        >
          {verify.isPending && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          Verify bank account
        </Button>
      </AlertDescription>
    </Alert>
  );
}
