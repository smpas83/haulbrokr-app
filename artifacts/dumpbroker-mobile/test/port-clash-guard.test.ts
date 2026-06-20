// @vitest-environment node
import { describe, expect, it } from "vitest";
import net from "node:net";
import { CANONICAL_PORTS } from "./global-port-guard";

/**
 * Proves the suite actually runs in a "ports busy" state that mirrors a normal
 * running workspace. The globalSetup (test/global-port-guard.ts) holds the
 * canonical dev-server ports for the duration of the run; this test confirms
 * that's in effect so the enforcement can't silently rot. If the guard ever
 * stops binding (config change, removed file), this test fails — which is the
 * whole point: it makes the "tests run with ports bound" guarantee executable.
 */

function isPortBusy(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(true);
      } else {
        reject(err);
      }
    });
    probe.listen(port, "127.0.0.1", () => {
      probe.close(() => resolve(false));
    });
  });
}

describe("port-clash guard", () => {
  it("runs the suite with the canonical dev-server ports bound", async () => {
    expect(CANONICAL_PORTS.length).toBeGreaterThan(0);
    for (const port of CANONICAL_PORTS) {
      await expect(isPortBusy(port)).resolves.toBe(true);
    }
  });
});
