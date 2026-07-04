import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { getUncachableResendClient } from "./resendClient";
import { logger } from "./logger";
import { computeDocumentStatus } from "./documentStatus";

const APP_URL = process.env.APP_PUBLIC_URL || "https://haulbrokr.com";
const DOC_SETTINGS_URL = APP_URL.replace(/\/$/, "") + "/account";

function reminderHtml(companyName: string, missing: string[]): string {
  const items = missing
    .map((m) => '<li style="margin:4px 0;">' + m + "</li>")
    .join("");
  return [
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">',
    '<h2 style="font-size:18px;">Action needed: finish your HaulBrokr documents</h2>',
    "<p>Hi " + (companyName || "there") + ",</p>",
    "<p>Your HaulBrokr account still needs the following document(s) before you can be fully active on the platform:</p>",
    '<ul style="padding-left:18px;">' + items + "</ul>",
    '<p style="margin:20px 0;"><a href="' +
      DOC_SETTINGS_URL +
      '" style="background:#0f172a;color:#fff;padding:10px 18px;text-decoration:none;border-radius:4px;display:inline-block;">Upload your documents</a></p>',
    '<p style="color:#64748b;font-size:13px;">You will keep receiving this daily reminder until all required documents are uploaded and approved.</p>',
    "</div>",
  ].join("");
}

/**
 * Send a reminder to every profile that still has missing required documents and
 * has not been reminded in the last ~20 hours. Safe to run daily.
 */
export async function sweepDocumentReminders(): Promise<{
  checked: number;
  sent: number;
}> {
  // Candidates: customers and providers with an email, not reminded recently.
  const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);
  const candidates = await db
    .select()
    .from(profilesTable)
    .where(
      and(
        or(
          eq(profilesTable.role, "provider"),
          eq(profilesTable.role, "customer"),
        ),
        sql`${profilesTable.email} is not null and ${profilesTable.email} <> ''`,
        or(
          isNull(profilesTable.lastDocReminderAt),
          lt(profilesTable.lastDocReminderAt, cutoff),
        ),
      ),
    );

  let sent = 0;
  if (candidates.length === 0) return { checked: 0, sent: 0 };

  let client: Awaited<ReturnType<typeof getUncachableResendClient>> | null =
    null;
  for (const profile of candidates) {
    try {
      const status = await computeDocumentStatus(profile);
      if (status.complete || status.missing.length === 0) continue;
      if (!profile.email) continue;

      if (!client) client = await getUncachableResendClient();
      await client.client.emails.send({
        from: client.fromEmail,
        to: profile.email,
        subject: "Finish your HaulBrokr documents to stay active",
        html: reminderHtml(profile.companyName, status.missing),
      });
      await db
        .update(profilesTable)
        .set({ lastDocReminderAt: new Date() })
        .where(eq(profilesTable.id, profile.id));
      sent += 1;
    } catch (err) {
      logger.error(
        { err, profileId: profile.id },
        "Document reminder email failed",
      );
    }
  }
  logger.info(
    { checked: candidates.length, sent },
    "Document reminder sweep complete",
  );
  return { checked: candidates.length, sent };
}
