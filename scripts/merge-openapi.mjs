/**
 * Merges lib/api-spec/openapi-extensions.yaml into openapi.yaml before codegen.
 * Extensions are inserted immediately before the `components:` section.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const specDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../lib/api-spec");
const mainPath = path.join(specDir, "openapi.yaml");
const extPath = path.join(specDir, "openapi-extensions.yaml");

const main = readFileSync(mainPath, "utf8");
const extensions = readFileSync(extPath, "utf8").trim();

if (main.includes("/factoring:") || main.includes("/quickbooks/status:")) {
  console.log("OpenAPI extensions already merged — skipping");
  process.exit(0);
}

if (!main.includes("components:")) {
  console.error("openapi.yaml missing components: section");
  process.exit(1);
}

const marker = "\ncomponents:";
const idx = main.indexOf(marker);
if (idx === -1) {
  console.error("Could not find components marker");
  process.exit(1);
}

const merged = main.slice(0, idx) + "\n" + extensions + marker + main.slice(idx + marker.length);
writeFileSync(mainPath, merged);
console.log("Merged openapi-extensions.yaml into openapi.yaml");
