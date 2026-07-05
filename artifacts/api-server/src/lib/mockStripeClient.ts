import type Stripe from "stripe";

/**
 * Mock payment mode.
 *
 * When no live Stripe connection is configured for this environment (or mock
 * mode is forced via PAYMENTS_MOCK_MODE), the app falls back to this in-memory
 * stand-in instead of throwing. It implements ONLY the handful of Stripe methods
 * the app actually calls, returning plausible, always-successful objects so the
 * full payment/payout flow keeps working end-to-end without a real Stripe
 * account. Real Stripe is used automatically the moment a connection exists — no
 * code changes required. This is intentionally a simulation: no money moves.
 */

export const MOCK_PUBLISHABLE_KEY = "pk_test_mock_haulbrokr_no_stripe_connected";

function mockId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 12);
  const stamp = Date.now().toString(36);
  return `${prefix}_mock_${stamp}${rand}`;
}

/** Pull the job id the route stamped onto the Checkout Session metadata. */
function jobIdFromCheckoutParams(params: any): string {
  return (
    params?.metadata?.jobId ??
    params?.payment_intent_data?.metadata?.jobId ??
    ""
  );
}

/**
 * Encode the job id into the mock session id so a later `retrieve` can echo the
 * SAME jobId back in metadata — the verify-checkout route rejects a session
 * whose metadata.jobId doesn't match the job, so the round-trip must preserve it.
 */
function encodeCheckoutSessionId(jobId: string): string {
  return `cs_mock_${encodeURIComponent(jobId)}_${Math.random().toString(36).slice(2, 10)}`;
}

function jobIdFromCheckoutSessionId(id: string): string {
  const m = /^cs_mock_([^_]*)_/.exec(id);
  return m ? decodeURIComponent(m[1]) : "";
}

export function createMockStripeClient(): Stripe {
  const client = {
    paymentIntents: {
      async create(params: any) {
        const id = mockId("pi");
        return {
          id,
          object: "payment_intent",
          status: "succeeded",
          client_secret: `${id}_secret_${mockId("cs")}`,
          latest_charge: mockId("ch"),
          amount: params?.amount ?? 0,
          currency: params?.currency ?? "usd",
          metadata: params?.metadata ?? {},
        };
      },
      async retrieve(id: string) {
        return {
          id,
          object: "payment_intent",
          status: "succeeded",
          client_secret: `${id}_secret_mock`,
          latest_charge: mockId("ch"),
          metadata: {},
        };
      },
    },

    transfers: {
      async create(params: any) {
        return {
          id: mockId("tr"),
          object: "transfer",
          amount: params?.amount ?? 0,
          currency: params?.currency ?? "usd",
          destination: params?.destination ?? null,
          metadata: params?.metadata ?? {},
        };
      },
    },

    accounts: {
      async create(_params: any) {
        return { id: mockId("acct"), object: "account" };
      },
      async retrieve(id: string) {
        // A fully-onboarded, payout-ready connected account so the readiness
        // guard passes and money "moves" in mock mode.
        return {
          id,
          object: "account",
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: {
            currently_due: [],
            past_due: [],
            pending_verification: [],
            disabled_reason: null,
            current_deadline: null,
          },
        };
      },
    },

    accountLinks: {
      async create(params: any) {
        // Bounce straight to the return URL — onboarding "completes" instantly.
        return {
          object: "account_link",
          url: params?.return_url ?? "https://example.com/mock-onboarding-complete",
        };
      },
    },

    customers: {
      async create(_params: any) {
        return { id: mockId("cus"), object: "customer" };
      },
    },

    paymentMethods: {
      async retrieve(id: string) {
        // Default to a card instrument so the saved-card path resolves cleanly.
        return {
          id,
          object: "payment_method",
          type: "card",
          customer: null,
          card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2099 },
          us_bank_account: null,
        };
      },
      async attach(id: string, params: any) {
        return { id, object: "payment_method", customer: params?.customer ?? null };
      },
    },

    setupIntents: {
      async create(params: any) {
        const id = mockId("seti");
        return {
          id,
          object: "setup_intent",
          status: "succeeded",
          client_secret: `${id}_secret_mock`,
          customer: params?.customer ?? null,
          payment_method: null,
        };
      },
      async retrieve(id: string) {
        return {
          id,
          object: "setup_intent",
          status: "succeeded",
          customer: null,
          payment_method: null,
        };
      },
      async verifyMicrodeposits(id: string, _params: any) {
        return { id, object: "setup_intent", status: "succeeded" };
      },
    },

    checkout: {
      sessions: {
        async create(params: any) {
          const jobId = jobIdFromCheckoutParams(params);
          const id = encodeCheckoutSessionId(jobId);
          // Send the customer straight to the success URL (the route swaps the
          // {CHECKOUT_SESSION_ID} placeholder for the real id) so the hosted
          // Checkout step "completes" without a real Stripe page.
          const successUrl = typeof params?.success_url === "string"
            ? params.success_url.replace("{CHECKOUT_SESSION_ID}", id)
            : "";
          return {
            id,
            object: "checkout.session",
            url: successUrl || "https://example.com/mock-checkout-complete",
          };
        },
        async retrieve(id: string, _opts: any) {
          const jobId = jobIdFromCheckoutSessionId(id);
          const pi = {
            id: mockId("pi"),
            object: "payment_intent",
            status: "succeeded",
            latest_charge: mockId("ch"),
          };
          return {
            id,
            object: "checkout.session",
            payment_status: "paid",
            metadata: { jobId, kind: "checkout" },
            payment_intent: pi,
          };
        },
      },
    },

    refunds: {
      async create(params: any, _opts?: { idempotencyKey?: string }) {
        const id = mockId("re");
        const amount = params?.amount ?? 0;
        return {
          id,
          object: "refund",
          amount,
          charge: params?.charge ?? mockId("ch"),
          payment_intent: params?.payment_intent ?? null,
          status: "succeeded",
          reason: params?.reason ?? "requested_by_customer",
          metadata: params?.metadata ?? {},
        };
      },
    },
  };

  return client as unknown as Stripe;
}
