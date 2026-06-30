import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, payoutAccountsTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { syncStripeStatus, buildPayoutRequirements, onboardingStatusForAccount } from "../lib/payoutStatus";
import { returnUrlBase, isAllowedReturnTo } from "../lib/returnUrl";

const router: IRouter = Router();

async function ensureConnectedAccount(profile: ReturnType<typeof getRequestProfile>): Promise<string> {
  const stripe = await getUncachableStripeClient();
  const [existing] = await db.select().from(payoutAccountsTable)
    .where(eq(payoutAccountsTable.profileId, profile.id));

  let stripeAccountId = existing?.stripeAccountId ?? null;
  if (!stripeAccountId) {
    const acct = await stripe.accounts.create(
      {
        type: "express",
        email: profile.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_type: "individual",
        metadata: { profileId: String(profile.id) },
      },
      // Idempotency: a double-click or retry returns the SAME account instead
      // of creating a duplicate Express account for the same profile.
      { idempotencyKey: `payouts:acct-create:${profile.id}` },
    );
    stripeAccountId = acct.id;
    if (existing) {
      await db.update(payoutAccountsTable)
        .set({ stripeAccountId, onboardingStatus: "restricted" })
        .where(eq(payoutAccountsTable.id, existing.id));
    } else {
      await db.insert(payoutAccountsTable).values({
        profileId: profile.id,
        stripeAccountId,
        onboardingStatus: "restricted",
      });
    }
  }

  await syncStripeStatus(stripeAccountId, profile.id).catch(() => undefined);
  return stripeAccountId;
}

/** POST /payouts/connect-account — create/retrieve the vendor's Connect Express account. */
router.post("/payouts/connect-account", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  try {
    const stripeAccountId = await ensureConnectedAccount(profile);
    res.json({ stripeAccountId });
  } catch (err: any) {
    req.log.error({ err }, "Stripe connect-account failed");
    res.status(500).json({ error: err?.message ?? "Stripe error" });
  }
});

/** POST /payouts/connect-link — create/get Connect Express account, return onboarding URL. */
router.post("/payouts/connect-link", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  try {
    const stripe = await getUncachableStripeClient();
    const stripeAccountId = await ensureConnectedAccount(profile);
    const base = returnUrlBase(req);
    // The mobile app passes the deep link it wants Stripe to return to. We
    // embed it in our HTTPS return page (Stripe requires https URLs), which
    // then bounces the in-app browser back into the app via this deep link.
    const rawReturnTo = typeof req.body?.returnTo === "string" ? req.body.returnTo : "";
    const returnTo = rawReturnTo && isAllowedReturnTo(rawReturnTo) ? rawReturnTo : "";
    const returnToParam = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${base}/api/payouts/return?status=refresh${returnToParam}`,
      return_url: `${base}/api/payouts/return?status=done${returnToParam}`,
      type: "account_onboarding",
    });

    res.json({ url: link.url, stripeAccountId });
  } catch (err: any) {
    req.log.error({ err }, "Stripe connect-link failed");
    res.status(500).json({ error: err?.message ?? "Stripe error" });
  }
});

/** GET /payouts/status — refresh from Stripe and return current capability flags. */
router.get("/payouts/status", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const [row] = await db.select().from(payoutAccountsTable)
    .where(eq(payoutAccountsTable.profileId, profile.id));
  if (!row?.stripeAccountId) {
    res.json({
      connected: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });
    return;
  }
  try {
    const acct = await syncStripeStatus(row.stripeAccountId, profile.id);
    res.json({
      connected: true,
      stripeAccountId: row.stripeAccountId,
      chargesEnabled: !!acct.charges_enabled,
      payoutsEnabled: !!acct.payouts_enabled,
      detailsSubmitted: !!acct.details_submitted,
      onboardingStatus: onboardingStatusForAccount(acct),
      requirements: buildPayoutRequirements(acct),
    });
  } catch (err: any) {
    req.log.error({ err }, "Stripe status fetch failed");
    res.status(500).json({ error: err?.message ?? "Stripe error" });
  }
});

/** GET /payouts/return — landing page Stripe redirects to after onboarding.
 * If the app supplied a whitelisted deep link, bounce the browser back into the
 * app so the in-app browser closes and payout status auto-refreshes. */
router.get("/payouts/return", (req, res): void => {
  const rawReturnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
  const returnTo = rawReturnTo && isAllowedReturnTo(rawReturnTo) ? rawReturnTo : "";
  // Append a marker so the app knows it arrived from the payout return flow.
  let deepLink = "";
  if (returnTo) {
    deepLink = returnTo + (returnTo.includes("?") ? "&" : "?") + "payouts=done";
  }
  const safeDeepLink = deepLink.replace(/"/g, "%22");
  const redirectScript = deepLink
    ? `<script>setTimeout(function(){location.replace(${JSON.stringify(deepLink)})},250)</script>
<noscript><meta http-equiv="refresh" content="0;url=${safeDeepLink}"></noscript>`
    : "";
  const cta = deepLink
    ? `<p>Returning you to the HaulBrokr app…</p>
<p style="margin-top:16px"><a href="${safeDeepLink}" style="color:#e9a600;font-weight:600;text-decoration:none">Tap here if it doesn't open automatically</a></p>`
    : `<p>You can close this window and return to the HaulBrokr app.</p>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html><head><title>HaulBrokr</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
${redirectScript}
<style>body{font-family:system-ui;background:#0a0a0a;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
.card{max-width:380px;padding:32px;background:#171717;border:1px solid #262626;border-radius:16px}
h1{margin:0 0 8px;font-size:20px}p{margin:0;color:#a3a3a3;line-height:1.5;font-size:14px}a{color:#e9a600}</style>
</head><body><div class="card"><h1>You're all set</h1>
${cta}</div></body></html>`);
});

export default router;
