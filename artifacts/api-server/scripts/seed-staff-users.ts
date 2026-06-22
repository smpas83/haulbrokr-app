/**
 * Seed HaulBrokr staff admin accounts (username + password).
 *
 * Usage (after db push):
 *   STAFF_DEFAULT_PASSWORD='your-secure-password' pnpm --filter @workspace/api-server run seed-staff
 *
 * Default password (dev only): HaulBrokr-Staff-2026!
 */
import { eq } from "drizzle-orm";
import { db, staffUsersTable } from "@workspace/db";
import { hashStaffPassword } from "../src/lib/staffPassword";

type SeedRole =
  | "ceo"
  | "president"
  | "cto"
  | "cfo"
  | "accounting"
  | "it"
  | "programmer";

function assertValidDatabaseUrl(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Export your Neon pooled URL before running seed-staff."
    );
  }
  if (url.includes("...")) {
    throw new Error(
      "DATABASE_URL contains '...' — that is a documentation placeholder, not a real URL. " +
        "Copy the full connection string from Neon Dashboard → Connect → Pooled connection."
    );
  }
  try {
    const normalized = url.replace(/^postgres:/, "postgresql:");
    const host = new URL(normalized).hostname;
    if (!host.includes(".")) {
      throw new Error(`DATABASE_URL hostname looks invalid: ${host}`);
    }
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid postgres URL. Use Neon pooled postgres:// or postgresql:// URL."
    );
  }
}

const SEED_USERS: Array<{ username: string; displayName: string; staffRole: SeedRole }> = [
  { username: "ceo", displayName: "CEO", staffRole: "ceo" },
  { username: "president", displayName: "President", staffRole: "president" },
  { username: "cto", displayName: "CTO", staffRole: "cto" },
  { username: "cfo", displayName: "CFO", staffRole: "cfo" },
  { username: "accounting", displayName: "Accounting", staffRole: "accounting" },
  { username: "it", displayName: "IT", staffRole: "it" },
  { username: "programmer", displayName: "Programmer", staffRole: "programmer" },
];

async function main(): Promise<void> {
  assertValidDatabaseUrl();
  const password = process.env.STAFF_DEFAULT_PASSWORD ?? "HaulBrokr-Staff-2026!";
  if (process.env.NODE_ENV === "production" && !process.env.STAFF_DEFAULT_PASSWORD) {
    throw new Error("Set STAFF_DEFAULT_PASSWORD before seeding staff users in production.");
  }
  const hash = await hashStaffPassword(password);

  for (const user of SEED_USERS) {
    const [existing] = await db
      .select({ id: staffUsersTable.id })
      .from(staffUsersTable)
      .where(eq(staffUsersTable.username, user.username));
    if (existing) {
      await db
        .update(staffUsersTable)
        .set({
          passwordHash: hash,
          staffRole: user.staffRole,
          displayName: user.displayName,
          active: true,
        })
        .where(eq(staffUsersTable.id, existing.id));
      console.log(`Updated staff user: ${user.username} (${user.staffRole})`);
    } else {
      await db.insert(staffUsersTable).values({
        username: user.username,
        passwordHash: hash,
        staffRole: user.staffRole,
        displayName: user.displayName,
        active: true,
      });
      console.log(`Created staff user: ${user.username} (${user.staffRole})`);
    }
  }

  console.log("\nStaff accounts ready. Log in at https://<domain>/admin/login");
  console.log("Username = role name (ceo, president, cto, cfo, accounting, it, programmer)");
  if (!process.env.STAFF_DEFAULT_PASSWORD) {
    console.log("Default password: HaulBrokr-Staff-2026! (set STAFF_DEFAULT_PASSWORD to override)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
