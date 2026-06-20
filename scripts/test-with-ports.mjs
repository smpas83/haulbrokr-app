// Validation harness that runs the workspace `test` suite in a state that
// mirrors a normal, *running* workspace: the canonical dev-server ports are held
// busy for the entire run.
//
// Background: a port-coupled mobile test silently broke for weeks because the
// shared `test` validation usually ran where the dev servers (and their ports)
// weren't up, so the common ports weren't bound. The regression only surfaced
// once port 8081 happened to be occupied. Binding the ports here reproduces the
// "ports busy" workspace for *every* run — in bare CI we bind them ourselves; in
// a live workspace the real servers already own them and our bind harmlessly
// no-ops (EADDRINUSE) while the port stays busy. Either way, any test or build
// code that assumes it can listen on a fixed dev-server port now fails loudly
// (EADDRINUSE) during validation instead of passing until it collides later.
//
// The canonical ports are read straight from `.replit` ([[ports]] localPort),
// the source of truth for the workspace's dev-server ports, so this stays
// correct as artifacts (and their ports) come and go. A hardcoded fallback
// covers the unlikely case where `.replit` can't be parsed.

import net from "node:net";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Observed dev-server ports (api, expo/metro, and the vite artifacts) as a
// safety net if `.replit` parsing ever yields nothing.
export const FALLBACK_PORTS = [8080, 8081, 18118, 21989, 23806, 25050];

// Pull every `localPort` out of a `.replit` file's contents. Kept separate from
// the file read so the parsing and the fallback-on-read-failure paths can both
// be exercised by tests.
export function parseCanonicalPorts(replitContents) {
  const ports = new Set();
  for (const match of replitContents.matchAll(/localPort\s*=\s*(\d+)/g)) {
    ports.add(Number(match[1]));
  }
  return [...ports].sort((a, b) => a - b);
}

export function readCanonicalPorts(replitPath = path.join(root, ".replit")) {
  try {
    const ports = parseCanonicalPorts(readFileSync(replitPath, "utf8"));
    if (ports.length > 0) {
      return ports;
    }
  } catch {
    // fall through to the hardcoded list
  }
  return [...FALLBACK_PORTS];
}

export function holdPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      // Already in use (e.g. a real dev server owns it). Still busy — fine.
      resolve(null);
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const TEST_ARGS = [
  "-r",
  "--no-bail",
  "--filter",
  "./artifacts/**",
  "--if-present",
  "run",
  "test",
];

// The command this harness wraps. Defaults to the workspace test suite, but a
// caller can override it with `-- <command> [args...]` so the harness's own
// port-holding and exit-code forwarding can be exercised without recursing back
// into the full test suite.
export function resolveChildCommand(argv) {
  const sep = argv.indexOf("--");
  if (sep !== -1 && sep + 1 < argv.length) {
    return { command: argv[sep + 1], args: argv.slice(sep + 2) };
  }
  return { command: "pnpm", args: TEST_ARGS };
}

async function main() {
  const { command, args } = resolveChildCommand(process.argv.slice(2));
  const ports = readCanonicalPorts();
  const held = await Promise.all(ports.map(holdPort));
  const boundHere = held.filter(Boolean).length;
  console.log(
    `[test-with-ports] Holding ${ports.length} canonical dev-server ports busy ` +
      `(${boundHere} bound here, ${ports.length - boundHere} already in use): ` +
      ports.join(", "),
  );

  const releasePorts = () => {
    for (const server of held) {
      if (server) {
        try {
          server.close();
        } catch {
          // best-effort teardown
        }
      }
    }
  };

  const child = spawn(command, args, { stdio: "inherit", cwd: root });

  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => child.kill(signal));
  }

  child.on("exit", (code, signal) => {
    releasePorts();
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });

  child.on("error", (err) => {
    releasePorts();
    console.error("[test-with-ports] Failed to launch test command:", err);
    process.exit(1);
  });
}

// Only run the harness when invoked directly (e.g. `node test-with-ports.mjs`),
// not when imported by a test that exercises the helpers above.
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error("[test-with-ports]", err);
    process.exit(1);
  });
}
