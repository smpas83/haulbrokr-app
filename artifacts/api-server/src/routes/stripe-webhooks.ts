import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import { handleStripeEvent } from "../lib/stripeWebhooks";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function webhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret || null;
}

/**
 * POST /webhooks/stripe — Stripe webhook receiver.
 * Mounted with express.raw() in app.ts so signature verification works.
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const secret = webhookSecret();
  if (!secret) {
    res.status(503).json({ error: "Stripe webhook secret is not configured." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    res.status(400).json({ error: "Missing Stripe-Signature header." });
    return;
  }

  const payload = req.body;
  if (!Buffer.isBuffer(payload)) {
    res.status(400).json({ error: "Webhook payload must be raw bytes." });
    return;
  }

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid Stripe webhook signature." });
    return;
  }

  try {
    const result = await handleStripeEvent(event);
    logger.info(
      { eventId: event.id, eventType: event.type, result },
      "Stripe webhook processed",
    );
    res.json({ received: true, ...result });
  } catch (err) {
    logger.error(
      { err, eventId: event.id, eventType: event.type },
      "Stripe webhook handler failed",
    );
    res.status(500).json({ error: "Webhook handler failed." });
  }
});

export default router;
