import { createHash } from "crypto";
import { and, eq, or, sql } from "drizzle-orm";
import {
  activityTable,
  accountDeletionAuditTable,
  accountDeletionRequestsTable,
  bidsTable,
  creditApplicationsTable,
  dataExportRequestsTable,
  db,
  deviceTokensTable,
  dotCdlTable,
  driverDocumentsTable,
  insuranceSubmissionsTable,
  organizationsTable,
  paymentMethodsTable,
  payoutAccountsTable,
  profilesTable,
  projectAssignmentsTable,
  quickbooksConnectionsTable,
  recurringSchedulesTable,
  trucksTable,
  uploadSessionsTable,
  w9SubmissionsTable,
} from "@workspace/db";
import { logger } from "./logger";

export const DELETION_CONFIRMATION_PHRASE = "DELETE";

export type DeletionPreview = {
  willDelete: string[];
  mayRetain: string[];
  organization: {
    isOwner: boolean;
    organizationId: number | null;
    otherMemberCount: number;
    requiresOwnershipTransfer: boolean;
  };
  blockedReason: string | null;
};

export function hashClerkId(clerkId: string): string {
  return createHash("sha256").update(clerkId).digest("hex").slice(0, 32);
}

export async function previewAccountDeletion(
  profileId: number,
): Promise<DeletionPreview> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, profileId));
  if (!profile) {
    throw new Error("Profile not found");
  }

  let otherMemberCount = 0;
  let requiresOwnershipTransfer = false;
  if (profile.organizationId) {
    const members = await db
      .select({ id: profilesTable.id, orgRole: profilesTable.orgRole })
      .from(profilesTable)
      .where(
        and(
          eq(profilesTable.organizationId, profile.organizationId),
          sql`${profilesTable.id} <> ${profileId}`,
        ),
      );
    otherMemberCount = members.length;
    if (profile.orgRole === "owner" && otherMemberCount > 0) {
      const hasOtherOwner = members.some((m) => m.orgRole === "owner");
      requiresOwnershipTransfer = !hasOtherOwner;
    }
  }

  return {
    willDelete: [
      "Profile personal data (name, email, phone, address)",
      "Saved preferences and notification device tokens",
      "Pending organization invitations tied to this user",
      "W-9 / insurance / payment-method / payout personal submissions",
      "Driver documents and compliance personal fields",
      "Active sessions and auth identity (Clerk)",
      "Trucks you solely own (unassigned from fleet)",
      "Open bids you placed",
      "Data export archives you requested",
      "Recurring haul schedules you own",
    ],
    mayRetain: [
      "Financial settlement records (invoices, payments, refunds) required for tax and dispute resolution",
      "Job / haul history required for safety and audit compliance (anonymized identity)",
      "Stripe payment identifiers retained by Stripe under their data retention policy",
      "Secure deletion audit event (hashed identity only — no name/email/phone)",
    ],
    organization: {
      isOwner: profile.orgRole === "owner",
      organizationId: profile.organizationId ?? null,
      otherMemberCount,
      requiresOwnershipTransfer,
    },
    blockedReason: requiresOwnershipTransfer
      ? "You are the sole organization owner. Transfer ownership to another member before deleting your account."
      : null,
  };
}

type DeleteResult = {
  deleted: true;
  profileId: number | null;
  clerkDeleted: boolean;
  deletionRequestId: number | null;
};

/**
 * Permanently delete a HaulBrokr account.
 *
 * - Removes or anonymizes personal data
 * - Preserves financial / tax / dispute / safety records with anonymized identity
 * - Revokes Clerk identity so the user cannot sign back in
 * - Records a secure audit event without unnecessary PII
 * - Supports resumable processing via account_deletion_requests
 */
export async function deleteAccountForClerkUser(
  clerkId: string,
  options: { deletionRequestId?: number; dryRun?: boolean } = {},
): Promise<DeleteResult> {
  const clerkIdHash = hashClerkId(clerkId);
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));

  if (!profile) {
    if (options.dryRun) {
      return {
        deleted: true,
        profileId: null,
        clerkDeleted: false,
        deletionRequestId: options.deletionRequestId ?? null,
      };
    }
    const clerkDeleted = await deleteClerkUser(clerkId);
    await recordDeletionAudit({
      profileId: null,
      clerkIdHash,
      organizationId: null,
      outcome: "completed_no_profile",
      retentionCategories: [],
    });
    return {
      deleted: true,
      profileId: null,
      clerkDeleted,
      deletionRequestId: options.deletionRequestId ?? null,
    };
  }

  const profileId = profile.id;
  const preview = await previewAccountDeletion(profileId);
  if (preview.blockedReason) {
    if (options.deletionRequestId) {
      await db
        .update(accountDeletionRequestsTable)
        .set({ status: "blocked_owner", blockReason: preview.blockedReason })
        .where(eq(accountDeletionRequestsTable.id, options.deletionRequestId));
    }
    const err = new Error(preview.blockedReason) as Error & { code?: string };
    err.code = "OWNERSHIP_TRANSFER_REQUIRED";
    throw err;
  }

  if (options.dryRun) {
    return {
      deleted: true,
      profileId,
      clerkDeleted: false,
      deletionRequestId: options.deletionRequestId ?? null,
    };
  }

  if (options.deletionRequestId) {
    await db
      .update(accountDeletionRequestsTable)
      .set({ status: "processing", confirmedAt: new Date() })
      .where(eq(accountDeletionRequestsTable.id, options.deletionRequestId));
  }

  const stepsCompleted: string[] = [];

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(deviceTokensTable)
        .where(eq(deviceTokensTable.profileId, profileId));
      stepsCompleted.push("device_tokens");

      await tx
        .delete(activityTable)
        .where(eq(activityTable.profileId, profileId));
      stepsCompleted.push("activity");

      await tx
        .delete(dataExportRequestsTable)
        .where(eq(dataExportRequestsTable.profileId, profileId));
      stepsCompleted.push("data_exports");

      await tx
        .delete(recurringSchedulesTable)
        .where(eq(recurringSchedulesTable.customerId, profileId));
      stepsCompleted.push("recurring_schedules");

      await tx
        .delete(w9SubmissionsTable)
        .where(eq(w9SubmissionsTable.profileId, profileId));
      await tx
        .delete(insuranceSubmissionsTable)
        .where(eq(insuranceSubmissionsTable.profileId, profileId));
      await tx
        .delete(paymentMethodsTable)
        .where(eq(paymentMethodsTable.profileId, profileId));
      await tx
        .delete(payoutAccountsTable)
        .where(eq(payoutAccountsTable.profileId, profileId));
      await tx
        .delete(creditApplicationsTable)
        .where(eq(creditApplicationsTable.profileId, profileId));
      await tx.delete(dotCdlTable).where(eq(dotCdlTable.profileId, profileId));
      await tx
        .delete(driverDocumentsTable)
        .where(eq(driverDocumentsTable.profileId, profileId));
      await tx
        .delete(quickbooksConnectionsTable)
        .where(eq(quickbooksConnectionsTable.profileId, profileId));
      await tx
        .delete(uploadSessionsTable)
        .where(eq(uploadSessionsTable.profileId, profileId));
      stepsCompleted.push("personal_submissions");

      await tx.delete(bidsTable).where(eq(bidsTable.providerId, profileId));
      stepsCompleted.push("bids");

      await tx
        .update(trucksTable)
        .set({ assignedDriverId: null })
        .where(eq(trucksTable.assignedDriverId, profileId));
      await tx.delete(trucksTable).where(eq(trucksTable.ownerId, profileId));
      stepsCompleted.push("trucks");

      await tx
        .delete(projectAssignmentsTable)
        .where(
          or(
            eq(projectAssignmentsTable.supervisorProfileId, profileId),
            eq(projectAssignmentsTable.assignedByProfileId, profileId),
          ),
        );
      stepsCompleted.push("project_assignments");

      // Cancel pending invitations: rotating invite code invalidates outstanding codes.
      if (profile.organizationId && profile.orgRole === "owner") {
        const members = await tx
          .select({ id: profilesTable.id })
          .from(profilesTable)
          .where(
            and(
              eq(profilesTable.organizationId, profile.organizationId),
              sql`${profilesTable.id} <> ${profileId}`,
            ),
          );

        await tx
          .update(profilesTable)
          .set({ organizationId: null, orgRole: null })
          .where(eq(profilesTable.id, profileId));

        if (members.length === 0) {
          await tx
            .update(organizationsTable)
            .set({
              ownerProfileId: null,
              name: "Deleted Organization",
              inviteCode: `DEL${profileId}${Date.now()}`,
            })
            .where(eq(organizationsTable.id, profile.organizationId));
          await tx
            .delete(organizationsTable)
            .where(eq(organizationsTable.id, profile.organizationId));
        } else {
          // Should not reach here when requiresOwnershipTransfer — defensive.
          const [nextOwner] = members;
          await tx
            .update(profilesTable)
            .set({ orgRole: "owner" })
            .where(eq(profilesTable.id, nextOwner.id));
          await tx
            .update(organizationsTable)
            .set({
              ownerProfileId: nextOwner.id,
              inviteCode: `X${Date.now().toString(36).toUpperCase()}`,
            })
            .where(eq(organizationsTable.id, profile.organizationId));
        }
        stepsCompleted.push("organization");
      } else if (profile.organizationId) {
        await tx
          .update(profilesTable)
          .set({ organizationId: null, orgRole: null })
          .where(eq(profilesTable.id, profileId));
        await tx
          .update(organizationsTable)
          .set({ ownerProfileId: null })
          .where(
            and(
              eq(organizationsTable.id, profile.organizationId),
              eq(organizationsTable.ownerProfileId, profileId),
            ),
          );
        stepsCompleted.push("organization_membership");
      }

      // Anonymize profile — retain id for financial/job FK integrity.
      await tx
        .update(profilesTable)
        .set({
          clerkId: `deleted_${profileId}_${Date.now()}`,
          companyName: "Deleted Account",
          contactName: null,
          phone: null,
          email: null,
          address: null,
          city: null,
          state: null,
          zip: null,
          organizationId: null,
          orgRole: null,
          staffRole: null,
          dba: null,
          website: null,
          mcNumber: null,
          capacityTons: null,
          capacityYards: null,
          countiesServed: null,
          hourlyRate: null,
          minimumHours: null,
          equipmentTypes: null,
          billingEinLast4: null,
          apContactName: null,
          apEmail: null,
          paymentTerms: null,
          stripeCustomerId: null,
          lastDocReminderAt: null,
        })
        .where(eq(profilesTable.id, profileId));
      stepsCompleted.push("anonymize_profile");
    });
  } catch (err) {
    logger.error(
      { err, profileId, stepsCompleted },
      "Account deletion transaction failed",
    );
    if (options.deletionRequestId) {
      await db
        .update(accountDeletionRequestsTable)
        .set({
          status: "failed",
          errorMessage: err instanceof Error ? err.message : "deletion_failed",
          stepsCompleted,
        })
        .where(eq(accountDeletionRequestsTable.id, options.deletionRequestId));
    }
    throw err;
  }

  let clerkDeleted = false;
  try {
    clerkDeleted = await deleteClerkUser(clerkId);
    stepsCompleted.push("clerk_identity");
  } catch (err) {
    logger.error(
      { err, profileId },
      "Clerk identity delete failed — deletion request left for retry",
    );
    if (options.deletionRequestId) {
      await db
        .update(accountDeletionRequestsTable)
        .set({
          status: "failed",
          errorMessage:
            err instanceof Error ? err.message : "clerk_delete_failed",
          stepsCompleted,
        })
        .where(eq(accountDeletionRequestsTable.id, options.deletionRequestId));
    }
    throw err;
  }

  await recordDeletionAudit({
    profileId,
    clerkIdHash,
    organizationId: profile.organizationId ?? null,
    outcome: "completed",
    retentionCategories: preview.mayRetain,
  });

  if (options.deletionRequestId) {
    await db
      .update(accountDeletionRequestsTable)
      .set({
        status: "completed",
        completedAt: new Date(),
        stepsCompleted,
        errorMessage: null,
      })
      .where(eq(accountDeletionRequestsTable.id, options.deletionRequestId));
  }

  return {
    deleted: true,
    profileId,
    clerkDeleted,
    deletionRequestId: options.deletionRequestId ?? null,
  };
}

async function recordDeletionAudit(input: {
  profileId: number | null;
  clerkIdHash: string;
  organizationId: number | null;
  outcome: string;
  retentionCategories: string[];
}): Promise<void> {
  await db.insert(accountDeletionAuditTable).values({
    profileId: input.profileId,
    clerkIdHash: input.clerkIdHash,
    organizationId: input.organizationId,
    outcome: input.outcome,
    retentionCategories: input.retentionCategories,
    metadata: { version: 1 },
  });
}

async function deleteClerkUser(clerkId: string): Promise<boolean> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error(
      "CLERK_SECRET_KEY is not configured — cannot delete auth identity.",
    );
  }

  const res = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    },
  );

  // 404 = already gone — treat as success for idempotent retries.
  if (res.ok || res.status === 404) return true;

  const text = await res.text();
  throw new Error(`Clerk user delete failed (${res.status}): ${text}`);
}

/** Resume a failed deletion request (compensating cleanup). */
export async function resumeAccountDeletion(
  deletionRequestId: number,
): Promise<DeleteResult> {
  const [req] = await db
    .select()
    .from(accountDeletionRequestsTable)
    .where(eq(accountDeletionRequestsTable.id, deletionRequestId));
  if (!req) throw new Error("Deletion request not found");
  if (req.status === "completed") {
    return {
      deleted: true,
      profileId: req.profileId,
      clerkDeleted: true,
      deletionRequestId: req.id,
    };
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, req.profileId));
  if (!profile) {
    await db
      .update(accountDeletionRequestsTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(accountDeletionRequestsTable.id, req.id));
    return {
      deleted: true,
      profileId: req.profileId,
      clerkDeleted: true,
      deletionRequestId: req.id,
    };
  }

  // Profile clerkId may already be anonymized — only resume if still a live clerk id.
  if (profile.clerkId.startsWith("deleted_")) {
    await db
      .update(accountDeletionRequestsTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(accountDeletionRequestsTable.id, req.id));
    return {
      deleted: true,
      profileId: req.profileId,
      clerkDeleted: true,
      deletionRequestId: req.id,
    };
  }

  return deleteAccountForClerkUser(profile.clerkId, {
    deletionRequestId: req.id,
  });
}
