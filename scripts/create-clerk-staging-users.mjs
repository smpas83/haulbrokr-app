#!/usr/bin/env node
/**
 * Create RC2 staging Clerk users with documented credentials.
 * Does NOT create HaulBrokr DB profiles — users complete onboarding on first login.
 *
 * Usage:
 *   CLERK_SECRET_KEY=sk_... node scripts/create-clerk-staging-users.mjs
 *   CLERK_SECRET_KEY=sk_... node scripts/create-clerk-staging-users.mjs --dry-run
 */
const DRY_RUN = process.argv.includes("--dry-run");
const API = "https://api.clerk.com/v1";
const SECRET = process.env.CLERK_SECRET_KEY?.trim();

if (!SECRET) {
  console.error("CLERK_SECRET_KEY is required.");
  process.exit(1);
}

/** Shared staging password — document for QA; rotate before Closed Beta invite. */
const STAGING_PASSWORD = process.env.RC2_STAGING_PASSWORD ?? "HaulBrokr-RC2-Staging!2026";

const USERS = [
  {
    key: "admin",
    email: "rc2-admin@haulbrokr.com",
    username: "rc2admin",
    firstName: "RC2",
    lastName: "Admin",
    publicMetadata: { stagingRole: "admin", rc2: true },
    notes: "Add Clerk user ID to ADMIN_USER_IDS on Render for Clerk-based admin access.",
  },
  {
    key: "customer",
    email: "rc2-customer@haulbrokr.com",
    username: "rc2customer",
    firstName: "RC2",
    lastName: "Customer",
    publicMetadata: { stagingRole: "customer", rc2: true },
    notes: "Onboard as Customer (construction company) on first login.",
  },
  {
    key: "fleet",
    email: "rc2-fleet@haulbrokr.com",
    username: "rc2fleet",
    firstName: "RC2",
    lastName: "FleetManager",
    publicMetadata: { stagingRole: "provider", rc2: true },
    notes: "Onboard as Provider (fleet owner). Dispatcher workflows use this account.",
  },
  {
    key: "driver",
    email: "rc2-driver@haulbrokr.com",
    username: "rc2driver",
    firstName: "RC2",
    lastName: "Driver",
    publicMetadata: { stagingRole: "driver", rc2: true },
    notes: "Onboard as Driver using fleet org invite code after rc2-fleet completes onboarding.",
  },
  {
    key: "supervisor",
    email: "rc2-supervisor@haulbrokr.com",
    username: "rc2supervisor",
    firstName: "RC2",
    lastName: "Supervisor",
    publicMetadata: { stagingRole: "supervisor", rc2: true },
    notes: "Onboard as Supervisor (foreman) using customer org invite code.",
  },
];

async function clerk(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function findUserByEmail(email) {
  const { res, body } = await clerk(`/users?email_address=${encodeURIComponent(email)}&limit=1`);
  if (!res.ok) throw new Error(`List users failed: ${res.status} ${JSON.stringify(body)}`);
  return Array.isArray(body) ? body[0] : body?.data?.[0] ?? null;
}

async function createUser(spec) {
  const existing = await findUserByEmail(spec.email);
  if (existing) {
    return { action: "exists", user: existing };
  }
  if (DRY_RUN) {
    return { action: "dry-run", user: { id: "user_dry_run", email_addresses: [{ email_address: spec.email }] } };
  }
  const { res, body } = await clerk("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [spec.email],
      username: spec.username,
      password: STAGING_PASSWORD,
      first_name: spec.firstName,
      last_name: spec.lastName,
      public_metadata: spec.publicMetadata,
      skip_password_checks: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Create ${spec.email} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return { action: "created", user: body };
}

async function main() {
  console.log("HaulBrokr RC2 Clerk staging user bootstrap");
  console.log(DRY_RUN ? "(dry-run mode)\n" : "\n");

  const results = [];
  for (const spec of USERS) {
    try {
      const { action, user } = await createUser(spec);
      results.push({
        key: spec.key,
        email: spec.email,
        clerkId: user.id,
        action,
        notes: spec.notes,
      });
      console.log(`${action === "created" ? "CREATED" : action === "exists" ? "EXISTS " : "DRY-RUN"}  ${spec.key.padEnd(12)} ${spec.email}  ${user.id}`);
    } catch (err) {
      results.push({ key: spec.key, email: spec.email, action: "error", error: String(err) });
      console.error(`ERROR    ${spec.key.padEnd(12)} ${spec.email}  ${err}`);
    }
  }

  console.log("\n--- RC2 Staging Credentials (document for QA) ---");
  console.log(`Password (all accounts): ${STAGING_PASSWORD}`);
  console.log("");
  for (const r of results) {
    if (r.clerkId) console.log(`${r.key}: ${r.email}  clerkId=${r.clerkId}`);
  }
  console.log("\n--- Post-create operator steps ---");
  console.log("1. Add rc2-admin clerkId to ADMIN_USER_IDS on Render.");
  console.log("2. Log in as rc2-fleet → complete provider onboarding → copy org invite code.");
  console.log("3. Log in as rc2-driver → join fleet with invite code.");
  console.log("4. Log in as rc2-customer → complete customer onboarding → copy invite code.");
  console.log("5. Log in as rc2-supervisor → join customer org with invite code.");
  console.log("6. Run: DATABASE_URL=... STAFF_DEFAULT_PASSWORD=... bash scripts/rc2-bootstrap-staging.sh");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
