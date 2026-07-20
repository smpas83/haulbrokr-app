/**
 * Create or reset a single HaulBrokr staff account (staff_users table).
 *
 * Hashes passwords with the same scrypt format as production login
 * (`hashStaffPassword` in artifacts/api-server/src/lib/staffPassword.ts).
 *
 * Usage (from repo root):
 *   pnpm create:staff -- --username admin --password "StrongPassword"
 *
 * Optional:
 *   --role cto              (default: cto)
 *   --display-name "Admin"  (default: title-cased username)
 *   --inactive              (create/update as inactive)
 *
 * Requires DATABASE_URL (repo-root .env or shell).
 * See STAFF_LOGIN_SETUP.md.
 */
// Side-effect: load repo-root .env before @workspace/db reads DATABASE_URL.
import "../artifacts/api-server/src/load-env.js";
import { hashStaffPassword } from "../artifacts/api-server/src/lib/staffPassword.js";

const ASSIGNABLE_ROLES = [
  "ceo",
  "president",
  "cto",
  "cfo",
  "accounting",
  "it",
  "programmer",
] as const;

type StaffRole = (typeof ASSIGNABLE_ROLES)[number];

type CliArgs = {
  username: string;
  password: string;
  role: StaffRole;
  displayName: string;
  active: boolean;
};

function printUsage(): void {
  console.log(`Create or reset a staff account in staff_users.

Usage:
  pnpm create:staff -- --username <name> --password <secret> [options]

Required:
  --username, -u     Login username (stored lowercase)
  --password, -p     Plaintext password (hashed with scrypt before storage)

Optional:
  --role, -r         One of: ${ASSIGNABLE_ROLES.join(", ")} (default: cto)
  --display-name, -n Display name shown in admin UI (default: title-cased username)
  --inactive         Mark the account inactive (cannot log in)
  --help, -h         Show this help

Examples:
  pnpm create:staff -- --username admin --password "StrongPassword"
  pnpm create:staff -- --username accounting --password "..." --role accounting

Requires DATABASE_URL in the environment or repo-root .env.
`);
}

function parseArgs(argv: string[]): CliArgs | "help" {
  // Drop node + script path; also skip a bare "--" that pnpm may forward.
  const args = argv.slice(2).filter((a) => a !== "--");
  let username: string | undefined;
  let password: string | undefined;
  let role: string = "cto";
  let displayName: string | undefined;
  let active = true;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = () => {
      const v = args[++i];
      if (v === undefined || v.startsWith("-")) {
        throw new Error(`Missing value after ${a}`);
      }
      return v;
    };

    switch (a) {
      case "--help":
      case "-h":
        return "help";
      case "--username":
      case "-u":
        username = next();
        break;
      case "--password":
      case "-p":
        password = next();
        break;
      case "--role":
      case "-r":
        role = next();
        break;
      case "--display-name":
      case "-n":
        displayName = next();
        break;
      case "--inactive":
        active = false;
        break;
      default:
        throw new Error(`Unknown argument: ${a}\nRun with --help for usage.`);
    }
  }

  if (!username?.trim()) {
    throw new Error("Missing --username. Run with --help for usage.");
  }
  if (!password) {
    throw new Error("Missing --password. Run with --help for usage.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (password.length > 128) {
    throw new Error("Password must be at most 128 characters.");
  }

  const normalizedUser = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,64}$/.test(normalizedUser)) {
    throw new Error(
      "Username must be 1–64 chars: lowercase letters, digits, '.', '_', or '-'.",
    );
  }

  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(role)) {
    throw new Error(
      `Invalid --role "${role}". Allowed: ${ASSIGNABLE_ROLES.join(", ")}`,
    );
  }

  const resolvedDisplay =
    displayName?.trim() ||
    normalizedUser.replace(/(^|[._-])([a-z])/g, (_, _sep: string, c: string) =>
      c.toUpperCase(),
    );

  return {
    username: normalizedUser,
    password,
    role: role as StaffRole,
    displayName: resolvedDisplay,
    active,
  };
}

function assertValidDatabaseUrl(): void {
  let url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set.\n\n" +
        "Add it to the repo-root .env, or export it:\n" +
        "  export DATABASE_URL=postgresql://...(Neon connection string)\n" +
        "Then re-run: pnpm create:staff -- --username ... --password ...",
    );
  }

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
      "DATABASE_URL still contains placeholder text. Paste your real Neon connection string.",
    );
  }
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error(
      "DATABASE_URL must start with postgres:// or postgresql://\n" +
        `Got: ${url.slice(0, 40)}...`,
    );
  }

  const normalized = url.replace(/^postgres:/, "postgresql:");
  const host = new URL(normalized).hostname;
  if (!host.includes(".")) {
    throw new Error(`DATABASE_URL hostname looks invalid: ${host}`);
  }
  console.log(`Connecting to database: ${host}`);
}

async function main(): Promise<void> {
  let parsed: CliArgs | "help";
  try {
    parsed = parseArgs(process.argv);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
    return;
  }

  if (parsed === "help") {
    printUsage();
    return;
  }

  assertValidDatabaseUrl();

  // Dynamic import so --help works without DATABASE_URL (@workspace/db throws at load).
  const { eq } = await import("drizzle-orm");
  const { db, staffUsersTable } = await import("@workspace/db");

  const passwordHash = await hashStaffPassword(parsed.password);

  const [existing] = await db
    .select({
      id: staffUsersTable.id,
      username: staffUsersTable.username,
      staffRole: staffUsersTable.staffRole,
      active: staffUsersTable.active,
    })
    .from(staffUsersTable)
    .where(eq(staffUsersTable.username, parsed.username));

  if (existing) {
    await db
      .update(staffUsersTable)
      .set({
        passwordHash,
        staffRole: parsed.role,
        displayName: parsed.displayName,
        active: parsed.active,
      })
      .where(eq(staffUsersTable.id, existing.id));
    console.log(
      `Updated staff user: ${parsed.username} (id=${existing.id}, role=${parsed.role}, active=${parsed.active})`,
    );
    console.log("Password hash rotated (plaintext was not stored).");
  } else {
    const [created] = await db
      .insert(staffUsersTable)
      .values({
        username: parsed.username,
        passwordHash,
        staffRole: parsed.role,
        displayName: parsed.displayName,
        active: parsed.active,
      })
      .returning({ id: staffUsersTable.id });
    console.log(
      `Created staff user: ${parsed.username} (id=${created?.id ?? "?"}, role=${parsed.role}, active=${parsed.active})`,
    );
  }

  console.log("\nLog in at https://haulbrokr.com/admin/login");
  console.log(`Username: ${parsed.username}`);
  console.log("Password: (the value you passed; not printed)");

  // Allow the process to exit (pg pool keeps the event loop alive).
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
