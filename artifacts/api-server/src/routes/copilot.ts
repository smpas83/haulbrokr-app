import { Router, type IRouter } from "express";
import { db, jobsTable, requestsTable, trucksTable, activityTable } from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";

const router: IRouter = Router();

const SUGGESTIONS: Record<string, string[]> = {
  customer: [
    "What open requests need my attention?",
    "Summarize my active jobs today",
    "Which bids should I review first?",
  ],
  provider: [
    "Show me nearby open loads",
    "What's my fleet utilization?",
    "Which jobs need dispatch today?",
  ],
  driver: [
    "What's my next assigned job?",
    "How do I check in on site?",
    "Upload ticket instructions",
  ],
};

async function buildContext(profile: { id: number; role: string; companyName: string }) {
  const isCustomer = profile.role === "customer";
  const isProvider = profile.role === "provider" || profile.role === "driver";

  const [openRequests, activeJobs, recentActivity] = await Promise.all([
    isCustomer
      ? db.select({ id: requestsTable.id, status: requestsTable.status, materialType: requestsTable.materialType })
          .from(requestsTable)
          .where(and(eq(requestsTable.customerId, profile.id), inArray(requestsTable.status, ["open", "bidding", "bid_received"])))
          .limit(10)
      : db.select({ id: requestsTable.id, status: requestsTable.status, materialType: requestsTable.materialType })
          .from(requestsTable)
          .where(eq(requestsTable.status, "open"))
          .limit(10),
    isCustomer
      ? db.select({ id: jobsTable.id, status: jobsTable.status, materialType: jobsTable.materialType })
          .from(jobsTable)
          .where(and(eq(jobsTable.customerId, profile.id), inArray(jobsTable.status, ["accepted", "active", "in_progress"])))
          .limit(10)
      : isProvider
        ? db.select({ id: jobsTable.id, status: jobsTable.status, materialType: jobsTable.materialType })
            .from(jobsTable)
            .where(and(eq(jobsTable.providerId, profile.id), inArray(jobsTable.status, ["accepted", "active", "in_progress"])))
            .limit(10)
        : Promise.resolve([]),
    db.select({ description: activityTable.description, type: activityTable.type, createdAt: activityTable.createdAt })
      .from(activityTable)
      .where(eq(activityTable.profileId, profile.id))
      .orderBy(desc(activityTable.createdAt))
      .limit(5),
  ]);

  let trucksAvailable = 0;
  if (isProvider) {
    const trucks = await db.select({ id: trucksTable.id })
      .from(trucksTable)
      .where(and(eq(trucksTable.ownerId, profile.id), eq(trucksTable.isAvailable, true)));
    trucksAvailable = trucks.length;
  }

  return { openRequests, activeJobs, recentActivity, trucksAvailable };
}

function answerQuery(message: string, profile: { role: string; companyName: string }, ctx: Awaited<ReturnType<typeof buildContext>>): string {
  const q = message.toLowerCase();

  if (q.includes("open") || q.includes("request") || q.includes("load")) {
    if (ctx.openRequests.length === 0) {
      return profile.role === "customer"
        ? "You have no open requests right now. Post a new haul from the Load Board to get started."
        : "No open loads on the board at the moment. Check back shortly or expand your service radius.";
    }
    const list = ctx.openRequests.slice(0, 3).map((r) => `• ${r.materialType} haul (#${r.id}, ${r.status})`).join("\n");
    return `Found ${ctx.openRequests.length} open load(s):\n${list}`;
  }

  if (q.includes("active") || q.includes("job") || q.includes("dispatch")) {
    if (ctx.activeJobs.length === 0) {
      return "No active jobs on your account. Accept a bid or get assigned to start hauling.";
    }
    const list = ctx.activeJobs.map((j) => `• Job #${j.id} — ${j.materialType} (${j.status})`).join("\n");
    return `You have ${ctx.activeJobs.length} active job(s):\n${list}`;
  }

  if (q.includes("fleet") || q.includes("truck") || q.includes("utilization")) {
    return ctx.trucksAvailable > 0
      ? `${ctx.trucksAvailable} truck(s) marked available in your fleet. Assign drivers from Active Jobs to maximize utilization.`
      : "No trucks currently marked available. Update fleet status or add trucks from My Fleet.";
  }

  if (q.includes("check in") || q.includes("ticket") || q.includes("upload")) {
    return "On an active job: open the job detail → Driver Field Ops → check in with GPS, then upload scale ticket photos at pickup and delivery proof at drop-off.";
  }

  if (q.includes("bid")) {
    return ctx.openRequests.length > 0
      ? `You have ${ctx.openRequests.length} request(s) that may have bids. Open My Requests to review and award.`
      : "No pending bids to review. Post a new request to receive provider quotes.";
  }

  const activity = ctx.recentActivity[0];
  if (activity) {
    return `Latest on your account: ${activity.description}. Ask about "open loads", "active jobs", or "fleet utilization" for more detail.`;
  }

  return `Hi ${profile.companyName}! I can help with open loads, active jobs, fleet status, and dispatch steps. What would you like to know?`;
}

router.get("/copilot/insights", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const ctx = await buildContext(profile);
  const role = profile.role === "driver" ? "driver" : profile.role === "provider" ? "provider" : "customer";

  res.json({
    suggestions: SUGGESTIONS[role] ?? SUGGESTIONS.customer,
    summary: {
      openLoads: ctx.openRequests.length,
      activeJobs: ctx.activeJobs.length,
      trucksAvailable: ctx.trucksAvailable,
    },
    recentActivity: ctx.recentActivity,
  });
});

router.post("/copilot/chat", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const message = String(req.body?.message ?? "").trim();
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const ctx = await buildContext(profile);
  const reply = answerQuery(message, profile, ctx);

  res.json({
    role: "assistant",
    content: reply,
    timestamp: new Date().toISOString(),
  });
});

export default router;
