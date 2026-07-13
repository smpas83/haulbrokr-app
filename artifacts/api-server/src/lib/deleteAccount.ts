import { and, eq, lte, ne, or, sql } from "drizzle-orm";
import {
  activityTable,
  accountDeletionJobsTable,
  appleAuthTokensTable,
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
  type AccountDeletionJob,
} from "@workspace/db";
import { isAppleAuthConfigured, revokeAppleToken } from "./appleAuth";
import { decryptSecret, getAppleTokenEncryptionKey } from "./appleTokenCrypto";
import { logger } from "./logger";

const MAX_ATTEMPTS = 12;
const BASE_RETRY_MS = 60_000;

export type DeleteAccountResult = {
  deleted: true;
  profileId: number | null;
  clerkDeleted: boolean;
  appleRevoked: boolean | null;
  jobId: number;
  status: string;
};

function nextRetryDelayMs(attemptCount: number): number {
  const exp = Math.min(attemptCount, 6);
  return BASE_RETRY_MS * 2 ** exp;
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

async function anonymizeProfileForDeletion(
  profileId: number,
  organizationId: number | null,
  orgRole: string | null,
): Promise<void> {
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

    if (organizationId) {
      const members = await tx
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(
          and(
            eq(profilesTable.organizationId, organizationId),
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
          .set({ ownerProfileId: null, name: "Deleted Organization" })
          .where(eq(organizationsTable.id, organizationId));
        await tx.delete(organizationsTable).where(eq(organizationsTable.id, organizationId));
      } else if (orgRole === "owner") {
        const [nextOwner] = members;
        await tx
          .update(profilesTable)
          .set({ orgRole: "owner" })
          .where(eq(profilesTable.id, nextOwner.id));
        await tx
          .update(organizationsTable)
          .set({ ownerProfileId: nextOwner.id })
          .where(eq(organizationsTable.id, organizationId));
      } else {
        await tx
          .update(organizationsTable)
          .set({ ownerProfileId: null })
          .where(
            and(
              eq(organizationsTable.id, organizationId),
              eq(organizationsTable.ownerProfileId, profileId),
            ),
          );
      }
    }

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
}

/**
 * Revoke any active Apple refresh tokens for this clerk/profile.
 * Returns true when revoked (or already revoked), false when none exist,
 * and throws when Apple credentials/API fail (caller schedules retry).
 */
export async function revokeStoredAppleTokens(opts: {
  clerkId: string;
  profileId: number | null;
}): Promise<boolean> {
  const rows = await db
    .select()
    .from(appleAuthTokensTable)
    .where(
      and(
        eq(appleAuthTokensTable.clerkId, opts.clerkId),
        or(
          eq(appleAuthTokensTable.status, "active"),
          eq(appleAuthTokensTable.status, "revoke_pending"),
          eq(appleAuthTokensTable.status, "revoke_failed"),
        ),
      ),
    );

  const profileRows =
    opts.profileId == null
      ? []
      : await db
          .select()
          .from(appleAuthTokensTable)
          .where(
            and(
              eq(appleAuthTokensTable.profileId, opts.profileId),
              or(
                eq(appleAuthTokensTable.status, "active"),
                eq(appleAuthTokensTable.status, "revoke_pending"),
                eq(appleAuthTokensTable.status, "revoke_failed"),
              ),
            ),
          );

  const byId = new Map<number, (typeof rows)[number]>();
  for (const row of [...rows, ...profileRows]) {
    byId.set(row.id, row);
  }
  const tokens = [...byId.values()];

  if (tokens.length === 0) {
    return false;
  }

  if (!isAppleAuthConfigured()) {
    throw new Error(
      "Apple refresh token(s) exist but APPLE_* credentials are not configured — cannot revoke.",
    );
  }

  const key = getAppleTokenEncryptionKey();

  for (const row of tokens) {
    await db
      .update(appleAuthTokensTable)
      .set({ status: "revoke_pending", lastError: null })
      .where(eq(appleAuthTokensTable.id, row.id));

    try {
      const refreshToken = decryptSecret(row.encryptedRefreshToken, key);
      await revokeAppleToken(refreshToken, "refresh_token");
      await db
        .update(appleAuthTokensTable)
        .set({
          status: "revoked",
          revokedAt: new Date(),
          lastError: null,
          // Wipe ciphertext after successful revoke so residual secrets aren't retained.
          encryptedRefreshToken: "revoked",
        })
        .where(eq(appleAuthTokensTable.id, row.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(appleAuthTokensTable)
        .set({ status: "revoke_failed", lastError: message.slice(0, 1000) })
        .where(eq(appleAuthTokensTable.id, row.id));
      throw err;
    }
  }

  return true;
}

async function loadOpenDeletionJob(clerkId: string): Promise<AccountDeletionJob | null> {
  const [job] = await db
    .select()
    .from(accountDeletionJobsTable)
    .where(
      and(
        eq(accountDeletionJobsTable.clerkId, clerkId),
        ne(accountDeletionJobsTable.status, "completed"),
      ),
    )
    .limit(1);
  return job ?? null;
}

async function updateJob(
  jobId: number,
  values: Partial<typeof accountDeletionJobsTable.$inferInsert>,
): Promise<AccountDeletionJob> {
  const [updated] = await db
    .update(accountDeletionJobsTable)
    .set(values)
    .where(eq(accountDeletionJobsTable.id, jobId))
    .returning();
  return updated;
}

/**
 * Advance a deletion job through Apple revoke → anonymize → Clerk delete.
 *
 * Apple revocation is owned by HaulBrokr (not Clerk). If revoke fails, local
 * anonymization + Clerk deletion still proceed so the user is not locked out of
 * App Store deletion UX; Apple revoke continues via the retry scheduler.
 */
export async function processDeletionJob(jobId: number): Promise<DeleteAccountResult> {
  const [job] = await db
    .select()
    .from(accountDeletionJobsTable)
    .where(eq(accountDeletionJobsTable.id, jobId));

  if (!job) {
    throw new Error(`Account deletion job ${jobId} not found`);
  }

  if (job.status === "completed") {
    return {
      deleted: true,
      profileId: job.profileId,
      clerkDeleted: true,
      appleRevoked: job.appleRevokeStatus === "succeeded" ? true : job.appleRevokeStatus === "not_needed" ? null : false,
      jobId: job.id,
      status: job.status,
    };
  }

  const attemptCount = job.attemptCount + 1;
  await updateJob(jobId, {
    attemptCount,
    lastError: null,
    nextAttemptAt: new Date(),
  });

  let profileId = job.profileId;
  let organizationId: number | null = null;
  let orgRole: string | null = null;

  if (profileId == null) {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.clerkId, job.clerkId));
    if (profile) {
      profileId = profile.id;
      organizationId = profile.organizationId;
      orgRole = profile.orgRole;
      await updateJob(jobId, { profileId });
    }
  } else {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, profileId));
    if (profile) {
      organizationId = profile.organizationId;
      orgRole = profile.orgRole;
    }
  }

  // ── Apple revoke ──────────────────────────────────────────────────────────
  let appleRevoked: boolean | null = null;
  if (job.appleRevokeStatus === "pending" || job.appleRevokeStatus === "failed") {
    await updateJob(jobId, { status: "revoking_apple" });
    try {
      const revoked = await revokeStoredAppleTokens({
        clerkId: job.clerkId,
        profileId,
      });
      appleRevoked = revoked ? true : null;
      await updateJob(jobId, {
        appleRevokeStatus: revoked ? "succeeded" : "not_needed",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err, jobId, clerkId: job.clerkId }, "Apple token revoke failed during deletion");
      await updateJob(jobId, {
        appleRevokeStatus: "failed",
        lastError: message.slice(0, 1000),
        nextAttemptAt: new Date(Date.now() + nextRetryDelayMs(attemptCount)),
      });
      appleRevoked = false;
      // Continue — local deletion must still succeed for App Store 5.1.1(v).
    }
  } else if (job.appleRevokeStatus === "succeeded") {
    appleRevoked = true;
  } else if (job.appleRevokeStatus === "not_needed") {
    appleRevoked = null;
  }

  // ── Anonymize ─────────────────────────────────────────────────────────────
  if (profileId != null) {
    const [stillPresent] = await db
      .select({ clerkId: profilesTable.clerkId })
      .from(profilesTable)
      .where(eq(profilesTable.id, profileId));

    if (stillPresent && !stillPresent.clerkId.startsWith("deleted_")) {
      await updateJob(jobId, { status: "anonymizing" });
      await anonymizeProfileForDeletion(profileId, organizationId, orgRole);
    }
  }

  // ── Clerk delete ──────────────────────────────────────────────────────────
  await updateJob(jobId, { status: "deleting_clerk" });
  const clerkDeleted = await deleteClerkUser(job.clerkId);

  const [latest] = await db
    .select()
    .from(accountDeletionJobsTable)
    .where(eq(accountDeletionJobsTable.id, jobId));

  const appleStatus = latest?.appleRevokeStatus ?? job.appleRevokeStatus;
  const fullyDone = appleStatus === "succeeded" || appleStatus === "not_needed";

  if (fullyDone) {
    await updateJob(jobId, {
      status: "completed",
      completedAt: new Date(),
      lastError: null,
    });
  } else {
    // Local account is gone; keep job open solely for Apple revoke retries.
    await updateJob(jobId, {
      status: "revoking_apple",
      nextAttemptAt: new Date(Date.now() + nextRetryDelayMs(attemptCount)),
      lastError: latest?.lastError ?? "Apple revoke still pending after local deletion",
    });
  }

  return {
    deleted: true,
    profileId,
    clerkDeleted,
    appleRevoked: appleStatus === "succeeded" ? true : appleStatus === "not_needed" ? null : false,
    jobId,
    status: fullyDone ? "completed" : "revoking_apple",
  };
}

/**
 * Create or resume a durable deletion job and process it.
 */
export async function deleteAccountForClerkUser(clerkId: string): Promise<DeleteAccountResult> {
  const existing = await loadOpenDeletionJob(clerkId);
  if (existing) {
    return processDeletionJob(existing.id);
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.clerkId, clerkId));

  const [job] = await db
    .insert(accountDeletionJobsTable)
    .values({
      clerkId,
      profileId: profile?.id ?? null,
      status: "pending",
      appleRevokeStatus: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date(),
    })
    .returning();

  return processDeletionJob(job.id);
}

/**
 * Retry Apple-only leftovers and any incomplete deletion jobs that are due.
 */
export async function sweepAccountDeletionJobs(limit = 25): Promise<{ processed: number; errors: number }> {
  const now = new Date();
  const due = await db
    .select()
    .from(accountDeletionJobsTable)
    .where(
      and(
        ne(accountDeletionJobsTable.status, "completed"),
        lte(accountDeletionJobsTable.nextAttemptAt, now),
        sql`${accountDeletionJobsTable.attemptCount} < ${MAX_ATTEMPTS}`,
      ),
    )
    .limit(limit);

  let processed = 0;
  let errors = 0;

  for (const job of due) {
    try {
      // If local deletion already finished (clerk deleted / profile anonymized)
      // but Apple revoke failed, only retry Apple revoke.
      if (
        job.status === "revoking_apple" &&
        (job.appleRevokeStatus === "failed" || job.appleRevokeStatus === "pending")
      ) {
        const [profile] = job.profileId
          ? await db.select().from(profilesTable).where(eq(profilesTable.id, job.profileId))
          : [undefined];
        const localAlreadyDeleted =
          !profile || profile.clerkId.startsWith("deleted_");

        if (localAlreadyDeleted) {
          const attemptCount = job.attemptCount + 1;
          try {
            const revoked = await revokeStoredAppleTokens({
              clerkId: job.clerkId,
              profileId: job.profileId,
            });
            await updateJob(job.id, {
              attemptCount,
              appleRevokeStatus: revoked ? "succeeded" : "not_needed",
              status: "completed",
              completedAt: new Date(),
              lastError: null,
            });
            processed += 1;
            continue;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await updateJob(job.id, {
              attemptCount,
              appleRevokeStatus: "failed",
              lastError: message.slice(0, 1000),
              nextAttemptAt: new Date(Date.now() + nextRetryDelayMs(attemptCount)),
              status: attemptCount >= MAX_ATTEMPTS ? "failed" : "revoking_apple",
            });
            errors += 1;
            continue;
          }
        }
      }

      await processDeletionJob(job.id);
      processed += 1;
    } catch (err) {
      errors += 1;
      logger.error({ err, jobId: job.id }, "Account deletion sweep failed for job");
      const attemptCount = job.attemptCount + 1;
      await updateJob(job.id, {
        attemptCount,
        lastError: (err instanceof Error ? err.message : String(err)).slice(0, 1000),
        nextAttemptAt: new Date(Date.now() + nextRetryDelayMs(attemptCount)),
        status: attemptCount >= MAX_ATTEMPTS ? "failed" : job.status,
      }).catch(() => undefined);
    }
  }

  return { processed, errors };
}
