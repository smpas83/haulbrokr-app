import { and, eq, or } from "drizzle-orm";
import { appleAuthTokensTable, db, profilesTable } from "@workspace/db";
import { exchangeAppleAuthorizationCode, isAppleAuthConfigured } from "./appleAuth";
import { encryptSecret, getAppleTokenEncryptionKey } from "./appleTokenCrypto";
import { logger } from "./logger";

export type StoreAppleAuthorizationResult = {
  stored: boolean;
  skippedReason?: string;
  appleSubject: string | null;
};

/**
 * Exchange a native Apple authorization code for a refresh token and store it
 * encrypted at rest, keyed by Clerk user / profile.
 */
export async function storeAppleAuthorizationForUser(opts: {
  clerkId: string;
  authorizationCode: string;
  profileId?: number | null;
}): Promise<StoreAppleAuthorizationResult> {
  if (!isAppleAuthConfigured()) {
    logger.warn(
      { clerkId: opts.clerkId },
      "Apple authorization code received but APPLE_* credentials are not configured — skipping token storage",
    );
    return { stored: false, skippedReason: "apple_not_configured", appleSubject: null };
  }

  const exchanged = await exchangeAppleAuthorizationCode(opts.authorizationCode);
  const key = getAppleTokenEncryptionKey();
  const encryptedRefreshToken = encryptSecret(exchanged.refreshToken, key);

  let profileId = opts.profileId ?? null;
  if (profileId == null) {
    const [profile] = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.clerkId, opts.clerkId));
    profileId = profile?.id ?? null;
  }

  const existing = await db
    .select()
    .from(appleAuthTokensTable)
    .where(
      or(
        eq(appleAuthTokensTable.clerkId, opts.clerkId),
        profileId != null ? eq(appleAuthTokensTable.profileId, profileId) : eq(appleAuthTokensTable.clerkId, opts.clerkId),
      ),
    );

  const activeOrPending = existing.filter((row) =>
    row.status === "active" || row.status === "revoke_pending" || row.status === "revoke_failed",
  );

  if (activeOrPending.length > 0) {
    const [primary] = activeOrPending;
    await db
      .update(appleAuthTokensTable)
      .set({
        profileId,
        clerkId: opts.clerkId,
        appleSubject: exchanged.appleSubject,
        encryptedRefreshToken,
        status: "active",
        lastError: null,
        revokedAt: null,
      })
      .where(eq(appleAuthTokensTable.id, primary.id));

    // Mark duplicates revoked so only one active row remains.
    for (const row of activeOrPending.slice(1)) {
      await db
        .update(appleAuthTokensTable)
        .set({ status: "revoked", revokedAt: new Date(), encryptedRefreshToken: "superseded" })
        .where(eq(appleAuthTokensTable.id, row.id));
    }
  } else {
    await db.insert(appleAuthTokensTable).values({
      profileId,
      clerkId: opts.clerkId,
      appleSubject: exchanged.appleSubject,
      encryptedRefreshToken,
      status: "active",
    });
  }

  return { stored: true, appleSubject: exchanged.appleSubject };
}

/** Attach profile id onto any orphan Apple tokens created before profile onboarding. */
export async function linkAppleTokensToProfile(clerkId: string, profileId: number): Promise<void> {
  await db
    .update(appleAuthTokensTable)
    .set({ profileId })
    .where(
      and(
        eq(appleAuthTokensTable.clerkId, clerkId),
        eq(appleAuthTokensTable.status, "active"),
      ),
    );
}
