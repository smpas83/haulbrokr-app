/**
 * Static validation for iOS release auth configuration.
 * Run: pnpm --filter @workspace/api-server run validate:ios-auth
 */
import fs from "node:fs";
import path from "node:path";

const mobileRoot = path.resolve(import.meta.dirname, "../../haulbrokr-mobile");
const appJsonPath = path.join(mobileRoot, "app.json");
const appConfigPath = path.join(mobileRoot, "app.config.js");

type Check = { name: string; ok: boolean; detail: string };

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}

function runChecks(): Check[] {
  const checks: Check[] = [];
  const appJson = readJson(appJsonPath);
  const expo = appJson.expo as Record<string, unknown>;
  const ios = expo.ios as Record<string, unknown>;
  const android = expo.android as Record<string, unknown>;
  const plugins = expo.plugins as unknown[];

  checks.push({
    name: "iOS bundle identifier",
    ok: ios.bundleIdentifier === "com.haulbrokr.mobile",
    detail: String(ios.bundleIdentifier),
  });

  checks.push({
    name: "Apple Sign In enabled",
    ok: ios.usesAppleSignIn === true,
    detail: String(ios.usesAppleSignIn),
  });

  const associatedDomains =
    (ios.associatedDomains as string[] | undefined) ?? [];
  checks.push({
    name: "Associated domains include haulbrokr.com",
    ok: associatedDomains.some((d) => d.includes("haulbrokr.com")),
    detail: associatedDomains.join(", ") || "(none)",
  });

  checks.push({
    name: "Deep link scheme",
    ok: expo.scheme === "haulbrokr",
    detail: String(expo.scheme),
  });

  const linking = expo.linking as { prefixes?: string[] } | undefined;
  checks.push({
    name: "Linking prefixes include haulbrokr://",
    ok: !!linking?.prefixes?.some((p) => p.startsWith("haulbrokr://")),
    detail: linking?.prefixes?.join(", ") ?? "(none)",
  });

  const intentFilters = (android.intentFilters as unknown[] | undefined) ?? [];
  checks.push({
    name: "Android intent filter for haulbrokr scheme",
    ok: JSON.stringify(intentFilters).includes("haulbrokr"),
    detail: `${intentFilters.length} intent filter(s)`,
  });

  checks.push({
    name: "Clerk Expo plugin present",
    ok: plugins.some(
      (p) =>
        p === "@clerk/expo" || (Array.isArray(p) && p[0] === "@clerk/expo"),
    ),
    detail: "plugins[]",
  });

  const appConfigSource = fs.readFileSync(appConfigPath, "utf8");
  checks.push({
    name: "app.config.js documents Clerk redirect allowlist",
    ok:
      appConfigSource.includes("clerkRedirectAllowlist") &&
      appConfigSource.includes("haulbrokr://"),
    detail: "clerkRedirectAllowlist",
  });

  const authConfigSource = fs.readFileSync(
    path.join(mobileRoot, "lib/authRedirectConfig.ts"),
    "utf8",
  );
  checks.push({
    name: "authRedirectConfig defines haulbrokr OAuth scheme",
    ok:
      authConfigSource.includes('HAULBROKR_OAUTH_SCHEME = "haulbrokr"') &&
      authConfigSource.includes("oauth-callback"),
    detail: "HAULBROKR_OAUTH_SCHEME",
  });

  const signInSource = fs.readFileSync(
    path.join(mobileRoot, "app/sign-in.tsx"),
    "utf8",
  );
  checks.push({
    name: "sign-in uses explicit OAuth redirect helper",
    ok: signInSource.includes("getClerkOAuthRedirectUri"),
    detail: "getClerkOAuthRedirectUri()",
  });

  checks.push({
    name: "sign-in activates session after email verification",
    ok:
      signInSource.includes("activateSession") &&
      signInSource.includes("createdSessionId"),
    detail: "activateSession + createdSessionId",
  });

  return checks;
}

const checks = runChecks();
let failed = 0;

console.log("iOS release auth validation\n");
for (const check of checks) {
  const status = check.ok ? "PASS" : "FAIL";
  if (!check.ok) failed += 1;
  console.log(`[${status}] ${check.name}: ${check.detail}`);
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}

console.log("\nAll iOS release auth checks passed.");
