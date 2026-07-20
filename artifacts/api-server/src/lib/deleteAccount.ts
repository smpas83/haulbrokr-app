import { and, eq, or, sql } from "drizzle-orm";
import {
  activityTable,
  bidsTable,
  creditApplicationsTable,
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
  trucksTable,
  uploadSessionsTable,
  w9SubmissionsTable,
} from "@workspace/db";

/**
 * Permanently delete a HaulBrokr account for App Store Guideline 5.1.1(v).
 *
 * Strategy:
 * 1. Remove cascade-safe / personally identifying satellite rows.
 * 2. Detach the profile from org ownership / membership.
 * 3. Anonymize the profile row when marketplace FKs (jobs, requests, tickets)
 *    prevent a hard delete — retained financial history stays non-identifying.
 * 4. Delete the Clerk user so the auth identity cannot sign in again.
 */
export async function deleteAccountForClerkUser(clerkId: string): Promise<{
  deleted: true;
  profileId: number | null;
  clerkDeleted: boolean;
}> {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));

  if (!profile) {
    // Still remove the Clerk identity if the app profile was never created.
    const clerkDeleted = await deleteClerkUser(clerkId);
    return { deleted: true, profileId: null, clerkDeleted };
  }

  const profileId = profile.id;

  await db.transaction(async (tx) => {
    await tx.delete(deviceTokensTable).where(eq(deviceTokensTable.profileId, profileId));
    await tx.delete(activityTable).where(eq(activityTable.profileId, profileId));
    await tx.delete(w9SubmissionsTable).where(eq(w9SubmissionsTable.profileId, profileId));
    await tx.delete(insuranceSubmissionsTable).where(eq(insuranceSubmissionsTable.profileId, profileId));
    await tx.delete(paymentMethodsTable).where(eq(paymentMethodsTable.profileId, profileId));
    await tx.delete(payoutAccountsTable).where(eq(payoutAccountsTable.profileId, profileId));
    await tx.delete(creditApplicationsTable).where(eq(creditApplicationsTable.profileId, profileId));
    await tx.delete(dotCdlTable).where(eq(dotCdlTable.profileId, profileId));
    await tx.delete(driverDocumentsTable).where(eq(driverDocumentsTable.profileId, profileId));
    await tx.delete(quickbooksConnectionsTable).where(eq(quickbooksConnectionsTable.profileId, profileId));
    await tx.delete(uploadSessionsTable).where(eq(uploadSessionsTable.profileId, profileId));
    await tx.delete(bidsTable).where(eq(bidsTable.providerId, profileId));
    await tx
      .update(trucksTable)
      .set({ assignedDriverId: null })
      .where(eq(trucksTable.assignedDriverId, profileId));
    await tx.delete(trucksTable).where(eq(trucksTable.ownerId, profileId));
    await tx
      .delete(projectAssignmentsTable)
      .where(
        or(
          eq(projectAssignmentsTable.supervisorProfileId, profileId),
          eq(projectAssignmentsTable.assignedByProfileId, profileId),
        ),
      );

    // Detach from organization before anonymizing.
    if (profile.organizationId) {
      const members = await tx
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(
          and(
            eq(profilesTable.organizationId, profile.organizationId),
            sql`${profilesTable.id} <> ${profileId}`,
          ),
        );

      // Clear this profile's org link first so org delete is not blocked.
      await tx
        .update(profilesTable)
        .set({ organizationId: null, orgRole: null })
        .where(eq(profilesTable.id, profileId));

      if (members.length === 0) {
        await tx
          .update(organizationsTable)
          .set({ ownerProfileId: null, name: "Deleted Organization" })
          .where(eq(organizationsTable.id, profile.organizationId));
        await tx
          .delete(organizationsTable)
          .where(eq(organizationsTable.id, profile.organizationId));
      } else if (profile.orgRole === "owner") {
        const [nextOwner] = members;
        await tx
          .update(profilesTable)
          .set({ orgRole: "owner" })
          .where(eq(profilesTable.id, nextOwner.id));
        await tx
          .update(organizationsTable)
          .set({ ownerProfileId: nextOwner.id })
          .where(eq(organizationsTable.id, profile.organizationId));
      } else {
        await tx
          .update(organizationsTable)
          .set({ ownerProfileId: null })
          .where(
            and(
              eq(organizationsTable.id, profile.organizationId),
              eq(organizationsTable.ownerProfileId, profileId),
            ),
          );
      }
    }

    // Anonymize rather than hard-delete: jobs/requests/tickets may still reference
    // this profile id for settlement history. Clear all PII and detach auth.
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
  });

  const clerkDeleted = await deleteClerkUser(clerkId);
  return { deleted: true, profileId, clerkDeleted };
}

async function deleteClerkUser(clerkId: string): Promise<boolean> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("CLERK_SECRET_KEY is not configured — cannot delete auth identity.");
  }

  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
  });

  // 404 = already gone — treat as success for idempotent retries.
  if (res.ok || res.status === 404) return true;

  const text = await res.text();
  throw new Error(`Clerk user delete failed (${res.status}): ${text}`);
}
