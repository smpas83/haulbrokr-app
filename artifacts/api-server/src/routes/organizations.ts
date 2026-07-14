import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, profilesTable, organizationsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isOrgManager } from "../lib/access";
import {
  canManageCompany,
  canManageMembers,
  canManageFleet,
  canDispatch,
  hasOrgPermission,
  isAssignableOrgRole,
  orgPermissionsFor,
  classifyMemberAudience,
  ASSIGNABLE_ORG_ROLES,
} from "../lib/orgPermissions";
import { getCarrierComplianceSnapshot } from "../lib/adminComplianceBundle";
import {
  ListOrgMembersResponse,
  UpdateOrgMemberRoleResponse,
  GetOrganizationComplianceStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function loadProfile(clerkId: string) {
  const [p] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));
  return p ?? null;
}

const UpdateCompanyBody = z.object({
  name: z.string().min(1).max(200).optional(),
  billingEmail: z.string().email().nullable().optional(),
  phone: z.string().min(7).max(40).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(40).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
});

const UpdateMemberBody = z.object({
  orgRole: z.enum(["admin", "member", "fleet_manager", "dispatcher"]),
});

const InviteMemberBody = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  contactName: z.string().min(1).max(120),
  role: z.enum(["driver", "supervisor", "customer", "provider"]).optional(),
  orgRole: z
    .enum(["admin", "member", "fleet_manager", "dispatcher"])
    .default("member"),
  clerkId: z.string().min(1),
});

router.get(
  "/organizations/me",
  requireAuth,
  async (req, res): Promise<void> => {
    const clerkId = req.clerkId as string;
    const profile = await loadProfile(clerkId);
    if (!profile?.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, profile.organizationId));
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }
    res.json({
      ...org,
      permissions: orgPermissionsFor(profile),
      audience: classifyMemberAudience(profile),
      assignableRoles: ASSIGNABLE_ORG_ROLES,
    });
  },
);

router.patch(
  "/organizations/me",
  requireAuth,
  async (req, res): Promise<void> => {
    const clerkId = req.clerkId as string;
    const profile = await loadProfile(clerkId);
    if (!profile?.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    if (!canManageCompany(profile)) {
      res
        .status(403)
        .json({ error: "Only company managers can update company details." });
      return;
    }
    const parsed = UpdateCompanyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [updated] = await db
      .update(organizationsTable)
      .set(parsed.data)
      .where(eq(organizationsTable.id, profile.organizationId))
      .returning();
    res.json(updated);
  },
);

router.get(
  "/organizations/compliance-status",
  requireAuth,
  async (req, res): Promise<void> => {
    const clerkId = req.clerkId as string;
    const profile = await loadProfile(clerkId);
    if (!profile?.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    if (
      !hasOrgPermission(profile, "view_compliance") &&
      !isOrgManager(profile)
    ) {
      res
        .status(403)
        .json({
          error: "You do not have permission to view compliance status.",
        });
      return;
    }
    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, profile.organizationId));
    if (!org || org.type !== "provider" || !org.ownerProfileId) {
      res.status(404).json({ error: "Carrier compliance record not found" });
      return;
    }
    const snapshot = await getCarrierComplianceSnapshot(org.ownerProfileId);
    if (!snapshot) {
      res.status(404).json({ error: "Carrier compliance record not found" });
      return;
    }
    res.json(GetOrganizationComplianceStatusResponse.parse(snapshot));
  },
);

router.get(
  "/organizations/members",
  requireAuth,
  async (req, res): Promise<void> => {
    const clerkId = req.clerkId as string;
    const profile = await loadProfile(clerkId);
    if (!profile?.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    const members = await db
      .select({
        id: profilesTable.id,
        role: profilesTable.role,
        orgRole: profilesTable.orgRole,
        contactName: profilesTable.contactName,
        companyName: profilesTable.companyName,
        phone: profilesTable.phone,
        email: profilesTable.email,
        createdAt: profilesTable.createdAt,
      })
      .from(profilesTable)
      .where(eq(profilesTable.organizationId, profile.organizationId));

    res.json({
      ...ListOrgMembersResponse.parse({ members }),
      roster: {
        drivers: members.filter((m) => m.role === "driver"),
        customers: members.filter(
          (m) => m.role === "customer" || m.role === "supervisor",
        ),
        dispatchers: members.filter((m) => m.orgRole === "dispatcher"),
        fleetManagers: members.filter(
          (m) => m.orgRole === "fleet_manager" || m.orgRole === "owner",
        ),
      },
    });
  },
);

/** Roster filtered by audience: drivers, dispatchers, fleet managers, customers. */
router.get(
  "/organizations/roster",
  requireAuth,
  async (req, res): Promise<void> => {
    const clerkId = req.clerkId as string;
    const profile = await loadProfile(clerkId);
    if (!profile?.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    const members = await db
      .select({
        id: profilesTable.id,
        role: profilesTable.role,
        orgRole: profilesTable.orgRole,
        contactName: profilesTable.contactName,
        companyName: profilesTable.companyName,
        phone: profilesTable.phone,
        email: profilesTable.email,
        createdAt: profilesTable.createdAt,
      })
      .from(profilesTable)
      .where(eq(profilesTable.organizationId, profile.organizationId));

    const drivers = members.filter((m) => m.role === "driver");
    const customers = members.filter(
      (m) => m.role === "customer" || m.role === "supervisor",
    );
    const dispatchers = members.filter((m) => m.orgRole === "dispatcher");
    const fleetManagers = members.filter(
      (m) => m.orgRole === "fleet_manager" || m.orgRole === "owner",
    );
    const providers = members.filter((m) => m.role === "provider");

    res.json({
      drivers,
      customers,
      dispatchers,
      fleetManagers,
      providers,
      canManageFleet: canManageFleet(profile),
      canDispatch: canDispatch(profile),
      canManageMembers: canManageMembers(profile),
    });
  },
);

router.patch(
  "/organizations/members/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const clerkId = req.clerkId as string;
    const profile = await loadProfile(clerkId);
    if (!profile?.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    if (!canManageMembers(profile)) {
      res
        .status(403)
        .json({ error: "Only the owner or an admin can change member roles." });
      return;
    }
    const targetId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(targetId)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }
    const parsed = UpdateMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!isAssignableOrgRole(parsed.data.orgRole)) {
      res.status(400).json({ error: "Invalid org role" });
      return;
    }

    const [target] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, targetId));
    if (!target || target.organizationId !== profile.organizationId) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    if (target.orgRole === "owner") {
      res
        .status(403)
        .json({ error: "The company owner's role cannot be changed." });
      return;
    }
    if (target.id === profile.id) {
      res.status(400).json({ error: "You cannot change your own role." });
      return;
    }
    const [updated] = await db
      .update(profilesTable)
      .set({ orgRole: parsed.data.orgRole })
      .where(eq(profilesTable.id, targetId))
      .returning();
    res.json(
      UpdateOrgMemberRoleResponse.parse({
        id: updated.id,
        role: updated.role,
        orgRole: updated.orgRole,
        contactName: updated.contactName,
        companyName: updated.companyName,
        phone: updated.phone,
        email: updated.email,
        createdAt: updated.createdAt,
      }),
    );
  },
);

router.delete(
  "/organizations/members/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const clerkId = req.clerkId as string;
    const profile = await loadProfile(clerkId);
    if (!profile?.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    if (!canManageMembers(profile)) {
      res
        .status(403)
        .json({ error: "Only the owner or an admin can remove members." });
      return;
    }
    const targetId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(targetId)) {
      res.status(400).json({ error: "Invalid member id" });
      return;
    }

    const [target] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, targetId));
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
    await db
      .update(profilesTable)
      .set({ organizationId: null, orgRole: null })
      .where(
        and(
          eq(profilesTable.id, targetId),
          eq(profilesTable.organizationId, profile.organizationId),
        ),
      );
    res.sendStatus(204);
  },
);

/**
 * Attach an existing Clerk profile into this organization with a role.
 * Used by company admins after the invitee has created a HaulBrokr profile.
 */
router.post(
  "/organizations/members/invite",
  requireAuth,
  async (req, res): Promise<void> => {
    const clerkId = req.clerkId as string;
    const profile = await loadProfile(clerkId);
    if (!profile?.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    if (!canManageMembers(profile)) {
      res.status(403).json({ error: "Only managers can invite members." });
      return;
    }
    const parsed = InviteMemberBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [target] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.clerkId, parsed.data.clerkId));
    if (!target) {
      res
        .status(404)
        .json({
          error:
            "No profile found for that Clerk user. They must sign up first.",
        });
      return;
    }
    if (
      target.organizationId &&
      target.organizationId !== profile.organizationId
    ) {
      res
        .status(409)
        .json({ error: "That user already belongs to another organization." });
      return;
    }

    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, profile.organizationId));
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    // Role defaults: provider orgs invite drivers; customer orgs invite supervisors
    const defaultRole = org.type === "provider" ? "driver" : "supervisor";
    const role = parsed.data.role ?? defaultRole;

    const [updated] = await db
      .update(profilesTable)
      .set({
        organizationId: profile.organizationId,
        orgRole: parsed.data.orgRole,
        role,
        contactName: parsed.data.contactName,
        email: parsed.data.email ?? target.email,
        phone: parsed.data.phone ?? target.phone,
      })
      .where(eq(profilesTable.id, target.id))
      .returning();

    res.status(201).json({
      id: updated.id,
      role: updated.role,
      orgRole: updated.orgRole,
      contactName: updated.contactName,
      companyName: updated.companyName,
      phone: updated.phone,
      email: updated.email,
      createdAt: updated.createdAt,
    });
  },
);

router.post(
  "/organizations/rotate-code",
  requireAuth,
  async (req, res): Promise<void> => {
    const clerkId = req.clerkId as string;
    const profile = await loadProfile(clerkId);
    if (!profile?.organizationId) {
      res.status(404).json({ error: "No organization" });
      return;
    }
    if (!canManageMembers(profile)) {
      res
        .status(403)
        .json({ error: "Only managers can rotate the invite code." });
      return;
    }
    let code = generateInviteCode();
    for (let i = 0; i < 5; i++) {
      const [collision] = await db
        .select()
        .from(organizationsTable)
        .where(eq(organizationsTable.inviteCode, code));
      if (!collision) break;
      code = generateInviteCode();
    }
    const [updated] = await db
      .update(organizationsTable)
      .set({ inviteCode: code })
      .where(eq(organizationsTable.id, profile.organizationId))
      .returning();
    res.json(updated);
  },
);

export default router;
