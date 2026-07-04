/**
 * Seed HaulBrokr staff admin accounts (username + password).
 *
 * Easiest: ./scripts/seed-staff-easy.sh
 *
 * Or put DATABASE_URL + STAFF_DEFAULT_PASSWORD in repo-root `.env`, then:
 *   pnpm --filter @workspace/api-server run seed-staff
 *
 * Shell exports take precedence over `.env` (export DATABASE_URL=... wins).
 */
import "../src/load-env.js";
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
  let url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set.\n\n" +
        "Run:  ./scripts/seed-staff-easy.sh\n\n" +
        "Or create haulbrokr-source-4/.env with:\n" +
        "  DATABASE_URL=postgresql://...(copy from Neon Connect button)\n" +
        "  STAFF_DEFAULT_PASSWORD=YourPassword123!"
    );
  }

  // Common copy/paste mistakes from Render/Neon dashboards
  url = url.replace(/^DATABASE_URL\s*=\s*/i, "");
  url = url.replace(/^['"]|['"]$/g, "");
  process.env.DATABASE_URL = url;

  if (
    url.includes("ep-xxxxx") ||
    url.includes("@ep-xxx.") ||
    url.includes("USER:PASS") ||
    url.includes("YOUR_REAL_PASSWORD") ||
    url.includes("YOUR_PASSWORD") ||
    url.includes("paste_key_here")
  ) {
    throw new Error(
      "DATABASE_URL still contains placeholder text.\n" +
        "Run: ./scripts/seed-staff-easy.sh\n" +
        "Or run: unset DATABASE_URL && pnpm --filter @workspace/api-server run seed-staff"
    );
  }
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error(
      "DATABASE_URL must start with postgres:// or postgresql://\n" +
        `Got: ${url.slice(0, 40)}...`
    );
  }

  try {
    const normalized = url.replace(/^postgres:/, "postgresql:");
    const host = new URL(normalized).hostname;
    if (!host.includes(".")) {
      throw new Error(`DATABASE_URL hostname looks invalid: ${host}`);
    }
    if (host.includes("xxxxx") || host.startsWith("ep-xxx.")) {
      throw new Error(
        `DATABASE_URL hostname "${host}" is a documentation example, not your real Neon host.\n` +
          "Neon → Connect → copy connection string (host looks like ep-damp-boat-aftkv449....neon.tech)"
      );
    }
    console.log(`Connecting to database: ${host}`);
  } catch (err) {
    const hint =
      err instanceof Error && err.message.includes("hostname")
        ? err.message
        : "If your Neon password has special characters (@ # / :), URL-encode them or reset the password in Neon.";
    throw new Error(
      `DATABASE_URL is not a valid postgres URL.\n${hint}\n` +
        "Paste only the connection string — no 'DATABASE_URL=' prefix, no extra quotes."
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

  console.log("\nStaff accounts ready. Log in at https://haulbrokr.com/admin/login");
  console.log("Username: ceo");
  if (process.env.STAFF_DEFAULT_PASSWORD) {
    console.log("Password: (value of STAFF_DEFAULT_PASSWORD in your .env)");
  } else {
    console.log("Password: Set STAFF_DEFAULT_PASSWORD in your .env before running this script.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
