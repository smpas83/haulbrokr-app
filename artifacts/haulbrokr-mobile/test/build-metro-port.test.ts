// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import net from "node:net";
import http from "node:http";

/**
 * Regression guard for the Metro port-resolution logic in `scripts/build.js`.
 *
 * The build used to hardcode Metro on port 8081, which broke local/CI builds
 * whenever 8081 was already taken. It was changed to pick a free port (or honor
 * an explicit METRO_PORT / RCT_METRO_PORT override). These tests hold an
 * OS-assigned port busy and confirm the build still resolves a usable port that
 * avoids the busy one, and that Metro comes up "ready" on it — without running
 * the real (~10 minute) Expo build. (We don't hardcode 8081 as the "busy" port
 * because another dev server already owns it in this workspace, which would make
 * the test fail with EADDRINUSE for reasons unrelated to the code under test.)
 *
 * `startMetro` is exercised with an injected fake spawn that stands up a tiny
 * HTTP server answering `/status` on the chosen port, so the real health-check
 * loop runs end to end against a real socket.
 */

const require = createRequire(import.meta.url);
const build = require("../scripts/build.js") as {
  findFreePort: () => Promise<number>;
  resolveMetroPort: () => Promise<number>;
  checkMetroHealth: (port: number) => Promise<boolean>;
  startMetro: (
    domain: string,
    replId: string | undefined,
    options: {
      port?: number;
      spawn?: (cmd: string, args: string[]) => unknown;
      maxAttempts?: number;
      pollIntervalMs?: number;
    },
  ) => Promise<number>;
};

const cleanups: Array<() => void> = [];

afterEach(() => {
  delete process.env.METRO_PORT;
  delete process.env.RCT_METRO_PORT;
  while (cleanups.length) {
    try {
      cleanups.pop()!();
    } catch {
      // best-effort teardown
    }
  }
});

/**
 * Binds an OS-assigned ephemeral port and keeps it held for the duration of the
 * test, returning the port number. We deliberately avoid hardcoding a port like
 * 8081 here: in this workspace another dev server already owns 8081, so binding
 * it would fail with EADDRINUSE for reasons unrelated to the code under test.
 * Letting the OS pick a guaranteed-free port and then proving the resolver
 * avoids *that* port preserves the original guarantee without the flakiness.
 */
function occupyEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Failed to acquire an ephemeral port"));
        return;
      }
      cleanups.push(() => server.close());
      resolve(address.port);
    });
  });
}

/**
 * A stand-in for `child_process.spawn` that mimics Metro: it reads the `--port`
 * arg, stands up an HTTP server answering `/status` on that port, and returns a
 * minimal child-process-shaped object whose `kill()` shuts the server down.
 */
function makeFakeMetroSpawn() {
  const calls: string[][] = [];
  const spawn = (_cmd: unknown, args: string[]) => {
    calls.push(args);
    const portIdx = args.indexOf("--port");
    const port = Number(args[portIdx + 1]);
    const server = http.createServer((req, res) => {
      if (req.url === "/status") {
        res.writeHead(200);
        res.end("packager-status:running");
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(port, "127.0.0.1");
    cleanups.push(() => server.close());
    return {
      stdout: null,
      stderr: null,
      kill: () => server.close(),
    };
  };
  return { spawn, calls };
}

describe("build.js Metro port resolution", () => {
  it("resolves a free port that avoids an already-busy port", async () => {
    const busyPort = await occupyEphemeralPort();

    const port = await build.resolveMetroPort();

    expect(port).not.toBe(busyPort);
    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
  });

  it("never returns the busy port across repeated resolutions", async () => {
    const busyPort = await occupyEphemeralPort();

    for (let i = 0; i < 5; i++) {
      const port = await build.resolveMetroPort();
      expect(port).not.toBe(busyPort);
    }
  });

  it("honors the METRO_PORT override", async () => {
    const free = await build.findFreePort();
    process.env.METRO_PORT = String(free);

    const port = await build.resolveMetroPort();

    expect(port).toBe(free);
  });

  it("honors the RCT_METRO_PORT override", async () => {
    const free = await build.findFreePort();
    process.env.RCT_METRO_PORT = String(free);

    const port = await build.resolveMetroPort();

    expect(port).toBe(free);
  });

  it("rejects an invalid METRO_PORT override", async () => {
    process.env.METRO_PORT = "not-a-port";
    await expect(build.resolveMetroPort()).rejects.toThrow(
      /Invalid METRO_PORT/,
    );

    process.env.METRO_PORT = "99999";
    await expect(build.resolveMetroPort()).rejects.toThrow(
      /Invalid METRO_PORT/,
    );
  });

  it("starts Metro on the resolved port (avoiding a busy one) and reports ready", async () => {
    const busyPort = await occupyEphemeralPort();

    const port = await build.resolveMetroPort();
    expect(port).not.toBe(busyPort);

    const { spawn, calls } = makeFakeMetroSpawn();
    const readyPort = await build.startMetro("test.local", undefined, {
      port,
      spawn,
      maxAttempts: 50,
      pollIntervalMs: 25,
    });

    expect(readyPort).toBe(port);
    expect(readyPort).not.toBe(busyPort);
    // Metro must have been launched with the resolved port, not a hardcoded one.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("--port");
    expect(calls[0][calls[0].indexOf("--port") + 1]).toBe(String(port));

    // The health check should now pass against the live fake server.
    await expect(build.checkMetroHealth(port)).resolves.toBe(true);
  });

  it("throws a descriptive error when Metro never reports ready", async () => {
    const port = await build.findFreePort();

    // A fake spawn that launches a process but never answers `/status`, so the
    // health-check loop exhausts its attempts. This must surface as a thrown
    // Error (so `main()` owns the single exit point) rather than killing the
    // test runner via `process.exit(1)`.
    const calls: string[][] = [];
    const spawn = (_cmd: unknown, args: string[]) => {
      calls.push(args);
      return {
        stdout: null,
        stderr: null,
        kill: () => {},
      };
    };

    await expect(
      build.startMetro("test.local", undefined, {
        port,
        spawn,
        maxAttempts: 3,
        pollIntervalMs: 10,
      }),
    ).rejects.toThrow(/Metro never became ready/);

    expect(calls).toHaveLength(1);
  });
});
