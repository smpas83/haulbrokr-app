// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";

/**
 * Unit coverage for the pure helpers behind the web *runtime* guard
 * (`scripts/check-web-runtime.js`). The guard loads the exported web bundle in
 * headless Chromium and fails when first render crashes; here we assert the
 * decision logic, executable resolution, and SPA file server in isolation —
 * without launching a real browser or running a full expo export.
 */

const require = createRequire(import.meta.url);

const runtime = require("../scripts/check-web-runtime.js") as {
  WEB_RUNTIME_ROUTES: { name: string; path: string }[];
  resolveChromiumExecutable: (env?: NodeJS.ProcessEnv) => string | null;
  createStaticServer: (rootDir: string) => http.Server;
  analyzeRuntime: (obs: {
    pageErrors?: { message: string; stack?: string }[];
    consoleErrors?: string[];
    dom?: { rootChildren: number; bodyText: string };
  }) => { ok: boolean; reason?: string; message?: string };
  summarizeRouteFailures: (
    failures: { route: string; result: { reason?: string; message?: string } }[],
  ) => string;
  checkWebRuntime: (
    outputDir: string,
    options?: {
      env?: NodeJS.ProcessEnv;
      executablePath?: string;
      puppeteer?: unknown;
      navTimeoutMs?: number;
      renderTimeoutMs?: number;
      pollMs?: number;
    },
  ) => Promise<void>;
};

describe("analyzeRuntime", () => {
  it("passes when the app rendered content and threw nothing", () => {
    const result = runtime.analyzeRuntime({
      pageErrors: [],
      consoleErrors: [],
      dom: { rootChildren: 3, bodyText: "Sign in to HaulBrokr" },
    });
    expect(result.ok).toBe(true);
  });

  it("passes despite benign console warnings when content rendered", () => {
    const result = runtime.analyzeRuntime({
      pageErrors: [],
      consoleErrors: ["Warning: useLayoutEffect does nothing on the server"],
      dom: { rootChildren: 2, bodyText: "Dashboard" },
    });
    expect(result.ok).toBe(true);
  });

  it("fails on an uncaught page exception and surfaces the stack", () => {
    const result = runtime.analyzeRuntime({
      pageErrors: [
        {
          message: "Cannot read properties of undefined (reading 'View')",
          stack:
            "TypeError: ...\n    at react-native-maps (bundle.js:1:200)",
        },
      ],
      consoleErrors: [],
      dom: { rootChildren: 0, bodyText: "" },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("uncaught-exception");
    expect(result.message).toContain("react-native-maps");
  });

  it("counts additional uncaught errors in the message", () => {
    const result = runtime.analyzeRuntime({
      pageErrors: [
        { message: "boom one", stack: "boom one stack" },
        { message: "boom two", stack: "boom two stack" },
      ],
      consoleErrors: [],
      dom: { rootChildren: 0, bodyText: "" },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("+1 more uncaught error");
  });

  it("fails when the ErrorBoundary fallback rendered", () => {
    const result = runtime.analyzeRuntime({
      pageErrors: [],
      consoleErrors: [
        "Error: Maps are not supported on web at MapScreen",
      ],
      dom: {
        rootChildren: 1,
        bodyText: "Something went wrong\nPlease reload the app to continue.",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("error-boundary");
    expect(result.message).toContain("MapScreen");
  });

  it("fails when nothing rendered into the root", () => {
    const result = runtime.analyzeRuntime({
      pageErrors: [],
      consoleErrors: ["Uncaught SyntaxError"],
      dom: { rootChildren: 0, bodyText: "" },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no-render");
  });

  it("treats a missing dom observation as a no-render crash", () => {
    const result = runtime.analyzeRuntime({
      pageErrors: [],
      consoleErrors: [],
      dom: undefined,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no-render");
  });
});

describe("WEB_RUNTIME_ROUTES", () => {
  it("covers more than just the entry route", () => {
    expect(runtime.WEB_RUNTIME_ROUTES.length).toBeGreaterThan(1);
    expect(runtime.WEB_RUNTIME_ROUTES.map((r) => r.path)).toContain("/");
  });

  it("includes the high-risk device-feature screens", () => {
    const paths = runtime.WEB_RUNTIME_ROUTES.map((r) => r.path);
    // maps, camera, deep detail and admin screens are exactly the ones that
    // can crash on web while "/" stays green.
    expect(paths).toContain("/map");
    expect(paths).toContain("/tracking/preview");
    expect(paths).toContain("/ticket/scan");
    expect(paths).toContain("/fleet");
    expect(paths).toContain("/job/preview");
    expect(paths).toContain("/admin-payouts");
  });

  it("gives every route a human-readable name and a rooted path", () => {
    for (const route of runtime.WEB_RUNTIME_ROUTES) {
      expect(route.name.trim().length).toBeGreaterThan(0);
      expect(route.path.startsWith("/")).toBe(true);
    }
  });

  it("has no duplicate paths", () => {
    const paths = runtime.WEB_RUNTIME_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("summarizeRouteFailures", () => {
  it("names the single crashing route and its reason and detail", () => {
    const message = runtime.summarizeRouteFailures([
      {
        route: "Map tab (/map) — react-native-maps",
        result: {
          reason: "uncaught-exception",
          message: "TypeError: Cannot read properties of undefined",
        },
      },
    ]);
    expect(message).toContain("1 web route crashed");
    expect(message).toContain("Map tab (/map)");
    expect(message).toContain("uncaught-exception");
    expect(message).toContain("Cannot read properties of undefined");
  });

  it("lists every crashing route when several fail", () => {
    const message = runtime.summarizeRouteFailures([
      {
        route: "Map tab (/map)",
        result: { reason: "error-boundary", message: "boom maps" },
      },
      {
        route: "Fleet (/fleet)",
        result: { reason: "no-render", message: "boom fleet" },
      },
    ]);
    expect(message).toContain("2 web routes crashed");
    expect(message).toContain("Map tab (/map)");
    expect(message).toContain("Fleet (/fleet)");
    expect(message).toContain("boom maps");
    expect(message).toContain("boom fleet");
  });
});

describe("resolveChromiumExecutable", () => {
  let tmpExe: string;

  beforeEach(() => {
    tmpExe = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "chromium-stub-")),
      "chrome",
    );
    fs.writeFileSync(tmpExe, "#!/bin/sh\n");
  });

  afterEach(() => {
    fs.rmSync(path.dirname(tmpExe), { recursive: true, force: true });
  });

  it("prefers PUPPETEER_EXECUTABLE_PATH when it exists", () => {
    const resolved = runtime.resolveChromiumExecutable({
      PUPPETEER_EXECUTABLE_PATH: tmpExe,
    } as Partial<NodeJS.ProcessEnv> as NodeJS.ProcessEnv);
    expect(resolved).toBe(tmpExe);
  });

  it("falls back to the Replit Playwright executable", () => {
    const resolved = runtime.resolveChromiumExecutable({
      PUPPETEER_EXECUTABLE_PATH: "/does/not/exist",
      REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE: tmpExe,
    } as Partial<NodeJS.ProcessEnv> as NodeJS.ProcessEnv);
    expect(resolved).toBe(tmpExe);
  });

  it("ignores override paths that do not exist on disk", () => {
    const resolved = runtime.resolveChromiumExecutable({
      PUPPETEER_EXECUTABLE_PATH: "/nope/chrome",
      CHROMIUM_PATH: "/also/nope",
    } as Partial<NodeJS.ProcessEnv> as NodeJS.ProcessEnv);
    // May still resolve via PATH lookup in this environment, but it must never
    // return one of the non-existent override paths.
    expect(resolved).not.toBe("/nope/chrome");
    expect(resolved).not.toBe("/also/nope");
  });
});

describe("createStaticServer", () => {
  let rootDir: string;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "webroot-"));
    fs.writeFileSync(
      path.join(rootDir, "index.html"),
      "<!doctype html><div id=\"root\"></div>",
    );
    fs.mkdirSync(path.join(rootDir, "_expo"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, "_expo", "bundle.js"),
      "console.log('bundle');",
    );

    server = runtime.createStaticServer(rootDir);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", () => resolve()),
    );
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it("serves real files with the right content type", async () => {
    const res = await fetch(`${baseUrl}/_expo/bundle.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
    expect(await res.text()).toContain("bundle");
  });

  it("falls back to index.html for unknown SPA routes", async () => {
    const res = await fetch(`${baseUrl}/some/client/route`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('id="root"');
  });

  it("rejects path traversal attempts", async () => {
    const res = await fetch(`${baseUrl}/../../etc/passwd`, {
      redirect: "manual",
    });
    // Normalized away — never returns /etc/passwd contents.
    const body = await res.text();
    expect(body).not.toContain("root:");
  });
});

/**
 * End-to-end coverage that the *whole* guard — static server + headless
 * Chromium + analyzeRuntime — actually rejects a crashing bundle and accepts a
 * healthy one. The unit tests above prove the decision logic in isolation, but
 * only this exercises the browser-driving code in `checkWebRuntime`, so a future
 * change to how it loads the page / collects pageerrors / polls the DOM can't
 * silently stop catching real crashes.
 *
 * Each fixture is a self-contained index.html (no Expo export needed) that
 * reproduces one of the three crash modes the guard detects, plus a healthy
 * page. The block skips gracefully when no Chromium executable is available so
 * it never flakes in a bare environment.
 */
const chromiumExecutable = runtime.resolveChromiumExecutable();

// Launching a real browser and waiting out the no-render poll is slow; give
// each case plenty of headroom over Vitest's 5s default so it never flakes.
const E2E_TIMEOUT = 60_000;

describe.skipIf(!chromiumExecutable)("checkWebRuntime (headless Chromium)", () => {
  const fixtureDirs: string[] = [];

  function writeFixture(html: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "web-runtime-fixture-"));
    fs.writeFileSync(path.join(dir, "index.html"), html);
    fixtureDirs.push(dir);
    return dir;
  }

  function run(dir: string): Promise<void> {
    return runtime.checkWebRuntime(dir, {
      executablePath: chromiumExecutable as string,
      // Keep the no-render case from waiting the full 30s default.
      navTimeoutMs: 15_000,
      renderTimeoutMs: 3_000,
      pollMs: 100,
    });
  }

  afterEach(() => {
    while (fixtureDirs.length) {
      const dir = fixtureDirs.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves for a healthy bundle that renders content", async () => {
    const dir = writeFixture(
      `<!doctype html><html><body><div id="root"></div>` +
        `<script>` +
        `var c=document.createElement('div');` +
        `c.textContent='Sign in to HaulBrokr';` +
        `document.getElementById('root').appendChild(c);` +
        `</script></body></html>`,
    );
    await expect(run(dir)).resolves.toBeUndefined();
  }, E2E_TIMEOUT);

  it("rejects when the bundle throws an uncaught exception", async () => {
    const dir = writeFixture(
      `<!doctype html><html><body><div id="root"></div>` +
        `<script>throw new Error("react-native-maps is not supported on web");` +
        `</script></body></html>`,
    );
    await expect(run(dir)).rejects.toThrow(/uncaught exception/i);
  }, E2E_TIMEOUT);

  it("rejects when the ErrorBoundary fallback renders", async () => {
    const dir = writeFixture(
      `<!doctype html><html><body><div id="root">` +
        `<div>Something went wrong</div>` +
        `<div>Please reload the app to continue.</div>` +
        `</div></body></html>`,
    );
    await expect(run(dir)).rejects.toThrow(/Something went wrong/i);
  }, E2E_TIMEOUT);

  it("rejects when nothing mounts into the root", async () => {
    const dir = writeFixture(
      `<!doctype html><html><body><div id="root"></div></body></html>`,
    );
    await expect(run(dir)).rejects.toThrow(/mounted nothing/i);
  }, E2E_TIMEOUT);
});
