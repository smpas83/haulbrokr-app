// @vitest-environment node
import { describe, expect, it } from "vitest";
import net from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The validation harness itself. If this import path or the harness's exported
// helpers ever break, this whole suite fails — which is the point: the thing
// that guarantees every test run holds the dev-server ports busy must not be
// able to silently stop doing its job.
import {
  FALLBACK_PORTS,
  parseCanonicalPorts,
  readCanonicalPorts,
  holdPort,
} from "../../../scripts/test-with-ports.mjs";

const harnessPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../scripts/test-with-ports.mjs",
);

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address && typeof address === "object") {
        const { port } = address;
        probe.close(() => resolve(port));
      } else {
        probe.close(() => reject(new Error("could not determine a free port")));
      }
    });
  });
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

// Run the harness as a real subprocess, overriding the wrapped command via `--`
// so it exits with whatever code we ask for instead of running the full suite.
function runHarness(innerArgs: string[]): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [harnessPath, "--", ...innerArgs], {
      stdio: "ignore",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code));
  });
}

describe("test-with-ports harness", () => {
  it("binds a canonical port when free and no-ops when it is already busy", async () => {
    const port = await findFreePort();

    // Free port: holdPort should actually bind it and hand back a live server.
    const held = await holdPort(port);
    expect(held).not.toBeNull();

    try {
      // Busy port (we now own it): holdPort must take the EADDRINUSE branch and
      // resolve null instead of throwing, leaving the port held.
      const second = await holdPort(port);
      expect(second).toBeNull();
    } finally {
      await closeServer(held as net.Server);
    }
  });

  it("forwards a non-zero child exit code so a failing run can't pass", async () => {
    const code = await runHarness(["node", "-e", "process.exit(7)"]);
    expect(code).toBe(7);
  });

  it("forwards a zero child exit code on success", async () => {
    const code = await runHarness(["node", "-e", "process.exit(0)"]);
    expect(code).toBe(0);
  });

  it("falls back to the hardcoded ports when .replit can't be read", () => {
    const ports = readCanonicalPorts(
      path.join(path.dirname(harnessPath), "does-not-exist.replit"),
    );
    expect(ports).toEqual(FALLBACK_PORTS);
  });

  it("parses every localPort out of .replit contents", () => {
    const sample = [
      "[[ports]]",
      "localPort = 8080",
      "externalPort = 80",
      "[[ports]]",
      "localPort = 8081",
      "localPort = 8080", // duplicate is de-duped
    ].join("\n");
    expect(parseCanonicalPorts(sample)).toEqual([8080, 8081]);
  });

  it("reads the real .replit and includes the canonical dev-server ports", () => {
    const ports = readCanonicalPorts();
    expect(ports.length).toBeGreaterThan(0);
    expect(ports).toContain(8081);
  });
});
