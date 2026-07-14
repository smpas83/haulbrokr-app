#!/usr/bin/env node
/**
 * RC2 Phase 5–6 — Mobile + App Store readiness static audit.
 * Run: node scripts/rc2-app-store-audit.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const mobile = join(ROOT, "artifacts/haulbrokr-mobile");
const results = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
  console.log(`${status.padEnd(4)} ${name}${detail ? ` — ${detail}` : ""}`);
}

function read(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (["node_modules", ".expo", "dist"].includes(entry)) continue;
      walk(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

const appJson = JSON.parse(read(join(mobile, "app.json")) || "{}");
const expo = appJson.expo ?? {};
const info = expo.ios?.infoPlist ?? {};
const account = read(join(mobile, "app/(tabs)/account.tsx"));
const privacy = read(join(mobile, "app/privacy.tsx"));
const terms = read(join(mobile, "app/terms.tsx"));
const allMobileSrc = walk(join(mobile, "app")).concat(walk(join(mobile, "hooks")));

console.log("\nHaulBrokr RC2 — Mobile / App Store Audit\n");

// Permissions
record(
  "Location permission string",
  info.NSLocationWhenInUseUsageDescription ? "PASS" : "FAIL",
  info.NSLocationWhenInUseUsageDescription?.slice(0, 60) ?? "missing",
);
record(
  "Camera permission string",
  info.NSCameraUsageDescription ? "PASS" : "FAIL",
  info.NSCameraUsageDescription?.slice(0, 60) ?? "missing",
);
record(
  "Photo library permission string",
  info.NSPhotoLibraryUsageDescription ? "PASS" : "FAIL",
  info.NSPhotoLibraryUsageDescription?.slice(0, 60) ?? "missing",
);
record(
  "Notification plugin configured",
  (expo.plugins ?? []).some((p) => Array.isArray(p) ? p[0] === "expo-notifications" : p === "expo-notifications")
    ? "PASS" : "FAIL",
);
record(
  "Deep link scheme",
  expo.scheme === "haulbrokr" ? "PASS" : "WARN",
  `scheme=${expo.scheme}`,
);
record(
  "Universal links (associatedDomains)",
  (expo.ios?.associatedDomains ?? []).some((d) => d.startsWith("applinks:")) ? "PASS" : "WARN",
);

// Legal
record("Privacy policy screen", privacy.includes("Information We Collect") ? "PASS" : "FAIL");
record("Terms of service screen", existsSync(join(mobile, "app/terms.tsx")) ? "PASS" : "FAIL");
record(
  "Account links to privacy/terms",
  account.includes("/privacy") && account.includes("/terms") ? "PASS" : "FAIL",
);

// Account deletion / export (App Store requirement)
const hasInAppDelete = /delete\s*account|deleteAccount|Delete Account/i.test(account + allMobileSrc.map(read).join("\n"));
const hasEmailDelete = /privacy@haulbrokr\.com/i.test(privacy);
record(
  "In-app Delete Account",
  hasInAppDelete ? "PASS" : "FAIL",
  hasInAppDelete ? "UI present" : "Apple Guideline 5.1.1(v) typically requires in-app deletion",
);
record(
  "Account deletion via privacy email",
  hasEmailDelete ? "WARN" : "FAIL",
  hasEmailDelete ? "email-only path documented" : "no deletion path",
);
record(
  "Export account data",
  /Export Account Data|export\s*(my\s*)?(data|account)|download\s*my\s*data/i.test(account + privacy)
    ? "PASS" : "FAIL",
  "Account → Privacy & Account / Export Account Data",
);

// Demo / placeholder
const demoHits = [];
for (const file of allMobileSrc) {
  const text = read(file);
  if (/demoMode\s*:\s*true|USE_DEMO|placeholder\s*UI|lorem ipsum/i.test(text)) {
    demoHits.push(relative(mobile, file));
  }
}
record(
  "No demo-mode flags in mobile app routes",
  demoHits.length === 0 ? "PASS" : "WARN",
  demoHits.slice(0, 5).join(", "),
);

// Device matrix (static — runtime simulators not available in this environment)
for (const device of ["iPhone SE", "iPhone 15", "iPhone 17", "iPad"]) {
  record(
    `Device matrix: ${device}`,
    "WARN",
    "Static audit only — run Expo/EAS device checks before store submit",
  );
}
record("Portrait orientation default", expo.orientation === "portrait" ? "PASS" : "WARN", expo.orientation);
record(
  "Landscape support",
  "WARN",
  "app.json orientation is portrait-only; validate critical screens in landscape manually",
);
record("Tablet (iPad)", expo.ios?.supportsTablet ? "PASS" : "WARN", `supportsTablet=${expo.ios?.supportsTablet}`);
record(
  "Backgrounding / push",
  "WARN",
  "Requires device/TestFlight verification of background push delivery",
);
record(
  "Offline mode",
  "WARN",
  "No offline sync layer certified; field ops require connectivity for uploads",
);
record(
  "GPS unavailable handling",
  "WARN",
  "Server rejects missing GPS on check-in (422); confirm mobile UX messaging on device",
);

const pass = results.filter((r) => r.status === "PASS").length;
const warn = results.filter((r) => r.status === "WARN").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log(`\n--- App Store audit: ${pass} PASS / ${warn} WARN / ${fail} FAIL ---\n`);

if (fail > 0) process.exitCode = 1;

// Keep results in-process only — do not write artifacts into the repo.
