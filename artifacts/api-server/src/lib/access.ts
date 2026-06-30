import { db, jobsTable, profilesTable, projectAssignmentsTable, ticketsTable, type Job, type Profile } from "@workspace/db";
import { eq, and } from "drizzle-orm";

/**
 * Returns the job if the given profile is allowed to act on it, else null.
 * Access is granted to the direct customer/provider on the job, and to org
 * members on the matching side (supervisor in the customer org, driver in the
 * provider org).
 */
export async function loadJobIfMember(jobId: number, profile: Profile): Promise<Job | null> {
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) return null;

  if (job.customerId === profile.id || job.providerId === profile.id) return job;

  if (profile.organizationId) {
    const [customerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.customerId));
    const [providerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.providerId));
    if (
      (profile.role === "supervisor" && customerProfile?.organizationId === profile.organizationId) ||
      (profile.role === "driver" && providerProfile?.organizationId === profile.organizationId)
    ) {
      return job;
    }
  }
  return null;
}

/**
 * Whether the profile can manage their company (members, fleet, assignments).
 * Org owners and admins qualify; base customer/provider accounts are always the
 * owner of their organization.
 */
export function isOrgManager(profile: Profile): boolean {
  if (profile.orgRole === "owner" || profile.orgRole === "admin") return true;
  return profile.role === "customer" || profile.role === "provider";
}

export const DRIVER_SIDE = new Set(["provider", "driver"]);
export const CUSTOMER_SIDE = new Set(["customer", "supervisor"]);

/** Whether the profile has a load ticket assigned on this job. */
export async function isDriverAssignedToJob(jobId: number, profileId: number): Promise<boolean> {
  const [ticket] = await db
    .select({ id: ticketsTable.id })
    .from(ticketsTable)
    .where(and(eq(ticketsTable.jobId, jobId), eq(ticketsTable.driverProfileId, profileId)));
  return !!ticket;
}

/**
 * Whether the profile may review (approve / flag) completion of the given job.
 *  - The direct customer on the job may always act.
 *  - A customer-org owner/admin may act on any of their org's jobs.
 *  - A supervisor (foreman) member may act ONLY on jobs whose project they are
 *    assigned to via project_assignments.
 */
export async function canReviewCompletion(job: Job, profile: Profile): Promise<boolean> {
  if (job.customerId === profile.id) return true;
  if (!profile.organizationId) return false;

  const [customerProfile] = await db.select().from(profilesTable).where(eq(profilesTable.id, job.customerId));
  if (customerProfile?.organizationId !== profile.organizationId) return false;

  if (isOrgManager(profile)) return true; // owner / admin act org-wide

  if (profile.role === "supervisor" && job.projectId != null) {
    const [assignment] = await db.select().from(projectAssignmentsTable).where(and(
      eq(projectAssignmentsTable.projectId, job.projectId),
      eq(projectAssignmentsTable.supervisorProfileId, profile.id),
    ));
    return !!assignment;
  }
  return false;
}

/**
 * Profile ids whose jobs the actor may see on their side of the marketplace.
 * Owners/admins/base accounts see only their own id; driver/supervisor members
 * see every profile that shares their organization (so they get the whole
 * company's jobs on the relevant side).
 */
export async function orgScopedActorIds(profile: Profile): Promise<number[]> {
  if ((profile.role === "driver" || profile.role === "supervisor") && profile.organizationId) {
    const rows = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.organizationId, profile.organizationId));
    const ids = rows.map((r) => r.id);
    return ids.length ? ids : [profile.id];
  }
  return [profile.id];
}
