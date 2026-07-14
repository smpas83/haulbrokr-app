#!/usr/bin/env node
/**
 * RC2 Production Certification runner.
 *
 * 1) Runs api-server Vitest suite (includes RC2 workflow / failure / security tests)
 * 2) Runs app-store static audit
 * 3) Runs performance audit against staging/prod URLs
 * 4) Prints consolidated PASS/WARN/FAIL summary
 *
 * Usage: node scripts/rc2-certify.mjs
 */
import { spawnSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname;

function run(label, command, args, cwd = ROOT) {
  console.log(`\n=== ${label} ===\n`);
  const res = spawnSync(command, args, { cwd, stdio: "inherit", env: process.env });
  return res.status === 0;
}

const unitOk = run(
  "Phase 1–3 automated tests (api-server)",
  "pnpm",
  ["--filter", "@workspace/api-server", "test"],
);

const appStoreOk = run("Phase 5–6 App Store audit", "node", ["scripts/rc2-app-store-audit.mjs"]);
const perfOk = run("Phase 4 Performance audit", "node", ["scripts/rc2-performance-audit.mjs"]);

const summary = {
  generatedAt: new Date().toISOString(),
  unitTests: unitOk ? "PASS" : "FAIL",
  appStoreAudit: appStoreOk ? "PASS" : "FAIL",
  performanceAudit: perfOk ? "PASS" : "WARN",
};

writeFileSync(join(ROOT, ".rc2-certify-summary.json"), JSON.stringify(summary, null, 2));

console.log("\n=== RC2 certify summary ===");
console.log(JSON.stringify(summary, null, 2));
console.log("\nSee RC2_PRODUCTION_CERTIFICATION.md for workflow-level PASS/WARN/FAIL.\n");

if (!unitOk) process.exit(1);
