import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Parse KEY=VALUE lines from a dotenv-style file (no variable expansion). */
export function parseEnvFileContents(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    parsed[key] = val;
  }

  return parsed;
}

/**
 * Apply parsed file variables to a target env object.
 * Existing process/shell values always win — `.env` only fills missing keys.
 */
export function applyEnvFile(
  fileVars: Record<string, string>,
  target: NodeJS.ProcessEnv = process.env,
): void {
  for (const [key, val] of Object.entries(fileVars)) {
    if (target[key] === undefined) {
      target[key] = val;
    }
  }
}

/** Load repo-root `.env` before @workspace/db reads DATABASE_URL. */
export function loadRepoEnvFile(
  repoRoot: string,
  target: NodeJS.ProcessEnv = process.env,
): void {
  const envPath = resolve(repoRoot, ".env");
  if (!existsSync(envPath)) return;
  applyEnvFile(parseEnvFileContents(readFileSync(envPath, "utf8")), target);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
loadRepoEnvFile(repoRoot);
