import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, organizationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { computeDocumentStatus } from "../lib/documentStatus";
import { deleteAccountForClerkUser } from "../lib/deleteAccount";
import { linkAppleTokensToProfile } from "../lib/appleTokenStore";

const router: IRouter = Router();

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const TEXT_PROFILE_FIELDS = [
  "contactName", "email", "address", "city", "state", "zip",
  "dba", "website", "mcNumber", "countiesServed", "equipmentTypes",
  "billingEinLast4", "apContactName", "apEmail",
] as const;
const NUMERIC_PROFILE_FIELDS = ["capacityTons", "capacityYards", "hourlyRate", "minimumHours"] as const;
const VALID_PAYMENT_TERMS = ["due_on_receipt", "net_15", "net_30", "prepaid"] as const;

/**
 * Picks the optional carrier/customer profile fields off a request body and
 * coerces them to the storage types Drizzle expects (numeric columns as strings).
 * Does NOT include companyName/role/phone — those are handled explicitly.
 */
function buildProfileFields(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TEXT_PROFILE_FIELDS) {
    if (body?.[k] !== undefined) out[k] = body[k] === null ? null : String(body[k]).trim();
  }
  for (const k of NUMERIC_PROFILE_FIELDS) {
    const v = body?.[k];
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  if (body?.paymentTerms !== undefined && VALID_PAYMENT_TERMS.includes(body.paymentTerms)) {
    out.paymentTerms = body.paymentTerms;
  }
  return out;
}

router.get("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  let organization = null;
  if (profile.organizationId) {
    const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, profile.organizationId));
    organization = org ?? null;
  }
  res.json({ ...profile, organization });
});

// GET /profiles/me/document-status -> required-document checklist + completeness
// for the signed-in user. Drives the in-app reminder banner and the gate.
router.get("/profiles/me/document-status", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const status = await computeDocumentStatus(profile);
  res.json(status);
});

router.patch("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const allowed: Record<string, unknown> = buildProfileFields(req.body);
  if (req.body?.companyName !== undefined) allowed.companyName = String(req.body.companyName).trim();
  if (req.body?.phone !== undefined) allowed.phone = req.body.phone === null ? null : String(req.body.phone).trim();
  const [profile] = await db
    .update(profilesTable)
    .set(allowed)
    .where(eq(profilesTable.clerkId, clerkId))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(profile);
});

/**
 * Permanently delete the authenticated account (App Store Guideline 5.1.1(v)).
 * Runs an auditable state machine: Apple token revoke → anonymize → Clerk delete,
 * with background retries for Apple revocation failures.
 */
router.delete("/profiles/me", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  try {
    const result = await deleteAccountForClerkUser(clerkId);
    res.json({
      deleted: true,
      profileId: result.profileId,
      clerkDeleted: result.clerkDeleted,
      appleRevoked: result.appleRevoked,
      jobId: result.jobId,
      status: result.status,
      message: "Your account has been permanently deleted.",
    });
  } catch (err: any) {
    req.log?.error?.({ err }, "Account deletion failed");
    res.status(500).json({ error: err?.message ?? "Account deletion failed" });
  }
});

const VALID_ROLES = ["customer", "provider", "driver", "supervisor"] as const;
type Role = (typeof VALID_ROLES)[number];

router.post("/profiles", requireAuth, async (req, res): Promise<void> => {
  const clerkId = req.clerkId as string;
  const role = req.body?.role as Role;
  const companyName = String(req.body?.companyName ?? "").trim();
  const phone = req.body?.phone ? String(req.body.phone).trim() : undefined;
  const inviteCode = req.body?.inviteCode ? String(req.body.inviteCode).trim().toUpperCase() : undefined;
  const extras = buildProfileFields(req.body);

  if (!VALID_ROLES.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  if (!companyName) {
    res.status(400).json({ error: "companyName is required" });
    return;
  }

  const [existing] = await db.select().from(profilesTable).where(eq(profilesTable.clerkId, clerkId));
  if (existing) {
    res.status(409).json({ error: "Profile already exists" });
    return;
  }

  let organizationId: number | null = null;

  if (role === "customer" || role === "provider") {
    // Owner: auto-create an organization
    let code = generateInviteCode();
    // best-effort uniqueness retry
    for (let i = 0; i < 5; i++) {
      const [collision] = await db.select().from(organizationsTable).where(eq(organizationsTable.inviteCode, code));
      if (!collision) break;
      code = generateInviteCode();
    }
    const [newProfile] = await db.insert(profilesTable).values({ ...extras, clerkId, role, companyName, phone, orgRole: "owner" }).returning();
    const [org] = await db.insert(organizationsTable).values({
      name: companyName,
      type: role,
      ownerProfileId: newProfile.id,
      inviteCode: code,
    }).returning();
    await db.update(profilesTable).set({ organizationId: org.id }).where(eq(profilesTable.id, newProfile.id));
    await linkAppleTokensToProfile(clerkId, newProfile.id).catch(() => undefined);
    res.status(201).json({ ...newProfile, organizationId: org.id, organization: org });
    return;
  }

  // Driver or Supervisor — must provide invite code
  if (!inviteCode) {
    res.status(400).json({ error: "An invite code is required to join as a driver or supervisor." });
    return;
  }
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.inviteCode, inviteCode));
  if (!org) {
    res.status(404).json({ error: "Invite code not found. Ask your manager to share it again." });
    return;
  }
  // Validate role compatibility: supervisor joins a customer org; driver joins a provider org
  if (role === "supervisor" && org.type !== "customer") {
    res.status(400).json({ error: "Supervisors join a Customer (construction company) team." });
    return;
  }
  if (role === "driver" && org.type !== "provider") {
    res.status(400).json({ error: "Drivers join a Provider (trucking company) team." });
    return;
  }
  const [newProfile] = await db.insert(profilesTable).values({
    ...extras, clerkId, role, companyName: org.name, phone, organizationId: org.id, orgRole: "member",
  }).returning();
  organizationId = org.id;
  await linkAppleTokensToProfile(clerkId, newProfile.id).catch(() => undefined);
  res.status(201).json({ ...newProfile, organizationId, organization: org });
});

export default router;
