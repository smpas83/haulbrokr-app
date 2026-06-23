import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, profilesTable, organizationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isOrgManager } from "../lib/access";
import { getCarrierComplianceSnapshot } from "../lib/adminComplianceBundle";
import {
  ListOrgMembersResponse,
  UpdateOrgMemberRoleBody,
  UpdateOrgMemberRoleResponse,
  GetOrganizationComplianceStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function loadProfile(clerkId: string) {
  const [p] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  return p ?? null;
}

router.get("/organizations/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const profile = await loadProfile(clerkId);
  if (!profile?.organizationId) {
    res.status(404).json({ error: "No organization" });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, profile.organizationId));
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }
  res.json(org);
});

router.get("/organizations/compliance-status", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const profile = await loadProfile(clerkId);
  if (!profile?.organizationId) {
    res.status(404).json({ error: "No organization" });
    return;
  }
  const snapshot = await getCarrierComplianceSnapshot(profile.organizationId);
  if (!snapshot) {
    res.status(404).json({ error: "Carrier compliance record not found" });
    return;
  }
  res.json(GetOrganizationComplianceStatusResponse.parse(snapshot));
});

router.get("/organizations/members", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const profile = await loadProfile(clerkId);
  if (!profile?.organizationId) {
    res.status(404).json({ error: "No organization" });
    return;
  }
  const members = await db.select({
    id: profilesTable.id,
    role: profilesTable.role,
    orgRole: profilesTable.orgRole,
    contactName: profilesTable.contactName,
    companyName: profilesTable.companyName,
    phone: profilesTable.phone,
    email: profilesTable.email,
    createdAt: profilesTable.createdAt,
  }).from(profilesTable).where(eq(profilesTable.organizationId, profile.organizationId));
  res.json(ListOrgMembersResponse.parse({ members }));
});

router.patch("/organizations/members/:id", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const profile = await loadProfile(clerkId);
  if (!profile?.organizationId) {
    res.status(404).json({ error: "No organization" });
    return;
  }
  if (!isOrgManager(profile)) {
    res.status(403).json({ error: "Only the owner or an admin can change member roles." });
    return;
  }
  const targetId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(targetId)) { res.status(400).json({ error: "Invalid member id" }); return; }
  const parsed = UpdateOrgMemberRoleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [target] = await db.select().from(profilesTable).where(eq(profilesTable.id, targetId));
  if (!target || target.organizationId !== profile.organizationId) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (target.orgRole === "owner") {
    res.status(403).json({ error: "The company owner's role cannot be changed." });
    return;
  }
  if (target.id === profile.id) {
    res.status(400).json({ error: "You cannot change your own role." });
    return;
  }
  const [updated] = await db.update(profilesTable)
    .set({ orgRole: parsed.data.orgRole })
    .where(eq(profilesTable.id, targetId))
    .returning();
  res.json(UpdateOrgMemberRoleResponse.parse({
    id: updated.id,
    role: updated.role,
    orgRole: updated.orgRole,
    contactName: updated.contactName,
    companyName: updated.companyName,
    phone: updated.phone,
    email: updated.email,
    createdAt: updated.createdAt,
  }));
});

router.delete("/organizations/members/:id", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const profile = await loadProfile(clerkId);
  if (!profile?.organizationId) {
    res.status(404).json({ error: "No organization" });
    return;
  }
  if (!isOrgManager(profile)) {
    res.status(403).json({ error: "Only the owner or an admin can remove members." });
    return;
  }
  const targetId = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(targetId)) { res.status(400).json({ error: "Invalid member id" }); return; }

  const [target] = await db.select().from(profilesTable).where(eq(profilesTable.id, targetId));
  if (!target || target.organizationId !== profile.organizationId) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  if (target.orgRole === "owner") {
    res.status(403).json({ error: "The company owner cannot be removed." });
    return;
  }
  if (target.id === profile.id) {
    res.status(400).json({ error: "You cannot remove yourself." });
    return;
  }
  await db.update(profilesTable)
    .set({ organizationId: null, orgRole: null })
    .where(and(eq(profilesTable.id, targetId), eq(profilesTable.organizationId, profile.organizationId)));
  res.sendStatus(204);
});

router.post("/organizations/rotate-code", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const profile = await loadProfile(clerkId);
  if (!profile?.organizationId) {
    res.status(404).json({ error: "No organization" });
    return;
  }
  if (profile.role !== "customer" && profile.role !== "provider") {
    res.status(403).json({ error: "Only the owner can rotate the invite code." });
    return;
  }
  let code = generateInviteCode();
  for (let i = 0; i < 5; i++) {
    const [collision] = await db.select().from(organizationsTable).where(eq(organizationsTable.inviteCode, code));
    if (!collision) break;
    code = generateInviteCode();
  }
  const [updated] = await db.update(organizationsTable)
    .set({ inviteCode: code })
    .where(eq(organizationsTable.id, profile.organizationId))
    .returning();
  res.json(updated);
});

export default router;
