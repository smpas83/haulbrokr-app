/**
 * Create or update a single HaulBrokr staff admin account.
 *
 * Usage (from repo root):
 *   pnpm create:staff --username admin --password 'YourSecurePassword!'
 *   pnpm create:staff --username admin --password '...' --role cto --display-name 'Ops Admin'
 *
 * Requires DATABASE_URL. Uses the same scrypt hashing as POST /api/admin/login.
 */

type StaffRole =
  | "ceo"
  | "president"
  | "cto"
  | "cfo"
  | "accounting"
  | "it"
  | "programmer";

const ASSIGNABLE_ROLES: StaffRole[] = [
  "ceo",
  "president",
  "cto",
  "cfo",
  "accounting",
  "it",
  "programmer",
];

type Args = {
  username?: string;
  password?: string;
  role: StaffRole;
  displayName?: string;
  help: boolean;
};

function printUsage(): void {
  console.log(`Usage:
  pnpm create:staff --username <name> --password <secret> [--role <role>] [--display-name <label>]

Options:
  --username, -u       Staff username (stored lowercase, unique)
  --password, -p       Plaintext password (hashed with scrypt before storage)
  --role, -r           One of: ${ASSIGNABLE_ROLES.join(", ")} (default: cto)
  --display-name, -n   Display name (default: username)
  --help, -h           Show this help

Environment:
  DATABASE_URL         Neon/Postgres connection string (required)
`);
}

function parseArgs(argv: string[]): Args {
  const out: Args = { role: "cto", help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") {
      out.help = true;
      continue;
    }
    if ((arg === "--username" || arg === "-u") && next) {
      out.username = next;
      i += 1;
      continue;
    }
    if ((arg === "--password" || arg === "-p") && next) {
      out.password = next;
      i += 1;
      continue;
    }
    if ((arg === "--role" || arg === "-r") && next) {
      out.role = next as StaffRole;
      i += 1;
      continue;
    }
    if ((arg === "--display-name" || arg === "-n") && next) {
      out.displayName = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return out;
}

function assertValidDatabaseUrl(): void {
  let url = (process.env.DATABASE_URL ?? "").trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set.\n" +
        "Export your Neon pooled connection string, then re-run:\n" +
        "  export DATABASE_URL='postgresql://...'\n" +
        "  pnpm create:staff --username admin --password '...'",
    );
  }
  url = url.replace(/^DATABASE_URL\s*=\s*/i, "").replace(/^['"]|['"]$/g, "");
  process.env.DATABASE_URL = url;
  if (!url.startsWith("postgres://") && !url.startsWith("postgresql://")) {
    throw new Error("DATABASE_URL must start with postgres:// or postgresql://");
  }
}

async function main(): Promise<void> {
  // Load repo-root .env before touching DATABASE_URL / db imports.
  const { loadRepoEnvFile } = await import("../src/load-env.js");
  const { dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  loadRepoEnvFile(repoRoot);

  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (!args.username?.trim() || !args.password) {
    printUsage();
    throw new Error("Both --username and --password are required.");
  }
  if (!ASSIGNABLE_ROLES.includes(args.role)) {
    throw new Error(
      `Invalid --role "${args.role}". Choose one of: ${ASSIGNABLE_ROLES.join(", ")}`,
    );
  }
  if (args.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  assertValidDatabaseUrl();

  const username = args.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,64}$/.test(username)) {
    throw new Error(
      "Username must be 1–64 chars: lowercase letters, digits, '.', '_', or '-'.",
    );
  }

  const { eq } = await import("drizzle-orm");
  const { db, staffUsersTable, pool } = await import("@workspace/db");
  const { hashStaffPassword } = await import("../src/lib/staffPassword.js");

  const displayName = (args.displayName ?? args.username).trim() || username;
  const passwordHash = await hashStaffPassword(args.password);

  try {
    const [existing] = await db
      .select({ id: staffUsersTable.id })
      .from(staffUsersTable)
      .where(eq(staffUsersTable.username, username));

    if (existing) {
      await db
        .update(staffUsersTable)
        .set({
          passwordHash,
          staffRole: args.role,
          displayName,
          active: true,
        })
        .where(eq(staffUsersTable.id, existing.id));
      console.log(`Updated staff user: ${username} (role=${args.role})`);
    } else {
      await db.insert(staffUsersTable).values({
        username,
        passwordHash,
        staffRole: args.role,
        displayName,
        active: true,
      });
      console.log(`Created staff user: ${username} (role=${args.role})`);
    }

    console.log("Login at https://haulbrokr.com/admin/login");
    console.log(`Username: ${username}`);
    console.log("Password: (the value you passed; not printed)");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
