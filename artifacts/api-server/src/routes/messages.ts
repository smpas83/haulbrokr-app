import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, jobMessagesTable, profilesTable } from "@workspace/db";
import { requireProfile } from "../middlewares/requireAuth";
import { loadJobIfMember } from "../lib/access";
import {
  GetJobMessagesResponse,
  GetJobMessagesResponseItem,
  CreateJobMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function senderName(profile: { companyName?: string | null; contactName?: string | null }): string {
  return profile.contactName ?? profile.companyName ?? "Unknown";
}

router.get("/jobs/:id/messages", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const rows = await db
    .select({
      id: jobMessagesTable.id,
      jobId: jobMessagesTable.jobId,
      senderProfileId: jobMessagesTable.senderProfileId,
      body: jobMessagesTable.body,
      createdAt: jobMessagesTable.createdAt,
      companyName: profilesTable.companyName,
      contactName: profilesTable.contactName,
    })
    .from(jobMessagesTable)
    .leftJoin(profilesTable, eq(jobMessagesTable.senderProfileId, profilesTable.id))
    .where(eq(jobMessagesTable.jobId, jobId))
    .orderBy(asc(jobMessagesTable.createdAt));

  const messages = rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    senderProfileId: r.senderProfileId,
    senderName: senderName({ companyName: r.companyName, contactName: r.contactName }),
    body: r.body,
    createdAt: r.createdAt,
  }));

  res.json(GetJobMessagesResponse.parse(messages));
});

router.post("/jobs/:id/messages", requireProfile, async (req, res): Promise<void> => {
  const profile = (req as any).profile;
  const jobId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const job = await loadJobIfMember(jobId, profile);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const raw = typeof req.body?.body === "string" ? req.body.body.trim() : req.body?.body;
  const parsed = CreateJobMessageBody.safeParse({ body: raw });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [created] = await db.insert(jobMessagesTable).values({
    jobId,
    senderProfileId: profile.id,
    body: parsed.data.body,
  }).returning();

  res.status(201).json(GetJobMessagesResponseItem.parse({
    id: created.id,
    jobId: created.jobId,
    senderProfileId: created.senderProfileId,
    senderName: senderName(profile),
    body: created.body,
    createdAt: created.createdAt,
  }));
});

export default router;
