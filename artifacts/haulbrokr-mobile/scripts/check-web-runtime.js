#!/usr/bin/env node
/**
 * Runtime guard for the Expo *web* bundle.
 *
 * Why this exists: `check-web-build.js` proves the web bundle *builds*, but a
 * bundle can compile cleanly and still throw the instant it renders in a
 * browser — e.g. a native-only module (react-native-maps, expo-secure-store,
 * …) imported on web without a `.web.ts` shim, or a missing polyfill. Those
 * crashes only surface when a human opens the mobile web preview.
 *
 * This module loads the already-exported web bundle in headless Chromium and
 * fails loudly if the app throws on first render. It is invoked by
 * `check-web-build.js` right after a successful export, so it runs as part of
 * the same `webbuild` validation.
 *
 * Crucially it does NOT only load the entry route ("/"). A native-only import
 * or missing web shim lives in the *screen module*, and an Expo Router screen
 * module is only evaluated when its route actually renders. So a deep screen
 * (tracking/maps, fleet, admin-payouts, job detail, the camera ticket scanner,
 * …) can crash on web while "/" stays perfectly green. To catch those, the
 * guard navigates a representative set of routes — one full page load each so
 * every screen module is forced to evaluate — and names any route that throws.
 *
 * Detection covers all three ways a first render can "crash":
 *   1. An uncaught exception bubbles to the page (`pageerror`).
 *   2. React's <ErrorBoundary> swallows the throw and renders the
 *      "Something went wrong" fallback instead of the app.
 *   3. The app silently mounts nothing (empty root) — usually a bundle that
 *      failed to evaluate.
 *
 * The pure helpers (resolveChromiumExecutable, createStaticServer,
 * analyzeRuntime, summarizeRouteFailures) and the WEB_RUNTIME_ROUTES list are
 * exported so they can be unit-tested without launching a real browser.
 */
const fs = require("fs");
const http = require("http");
const path = require("path");
const { execFileSync } = require("child_process");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

// Text rendered by components/ErrorFallback.tsx when the ErrorBoundary catches
// a render-time throw. Seeing this means the app crashed even though no
// uncaught exception reached the page.
const ERROR_FALLBACK_SIGNATURE = /Something went wrong/i;

// The representative set of routes the runtime guard renders. Each one forces
// its screen module to evaluate, which is the only way a native-only import or
// missing web shim on a deep screen surfaces. Order roughly mirrors how a user
// would walk the app; the highest-risk device-feature screens (maps, camera,
// image picker) are deliberately included.
//
// Dynamic routes use a throwaway id — every detail screen renders a graceful
// "not found" state for an unknown id, so a placeholder never causes a false
// positive while still exercising the screen module.
//
// `name` is what gets printed when a route crashes, so it should read like the
// screen a human would recognize.
const WEB_RUNTIME_ROUTES = [
  { name: "Home / dashboard (/)", path: "/" },
  { name: "Sign in (/sign-in)", path: "/sign-in" },
  { name: "Onboarding (/onboarding)", path: "/onboarding" },
  { name: "Jobs tab (/jobs)", path: "/jobs" },
  { name: "Bins tab (/bins)", path: "/bins" },
  { name: "Projects tab (/projects)", path: "/projects" },
  { name: "Map tab (/map) — react-native-maps", path: "/map" },
  { name: "Guide tab (/guide)", path: "/guide" },
  { name: "Account tab (/account)", path: "/account" },
  { name: "Job detail (/job/[id])", path: "/job/preview" },
  { name: "Live tracking (/tracking/[id]) — react-native-maps", path: "/tracking/preview" },
  { name: "Invoice (/invoice/[id])", path: "/invoice/preview" },
  { name: "Bin detail (/bin/[id])", path: "/bin/preview" },
  { name: "Wallet (/wallet)", path: "/wallet" },
  { name: "Notifications (/notifications)", path: "/notifications" },
  { name: "Fleet (/fleet)", path: "/fleet" },
  { name: "Driver jobs (/driver-jobs) — expo-image-picker", path: "/driver-jobs" },
  { name: "Driver docs (/driver-docs) — expo-image-picker", path: "/driver-docs" },
  { name: "Foreman (/foreman)", path: "/foreman" },
  { name: "Team (/team)", path: "/team" },
  { name: "Dump sites (/dump-sites)", path: "/dump-sites" },
  { name: "Ticket scanner (/ticket/scan) — expo-camera", path: "/ticket/scan" },
  { name: "Ticket QR (/ticket/qr)", path: "/ticket/qr" },
  { name: "Admin payouts (/admin-payouts)", path: "/admin-payouts" },
  { name: "Admin compliance (/admin-compliance)", path: "/admin-compliance" },
  { name: "Admin credit (/admin-credit)", path: "/admin-credit" },
  { name: "Help (/help)", path: "/help" },
  { name: "Terms (/terms)", path: "/terms" },
  { name: "Privacy (/privacy)", path: "/privacy" },
  { name: "Language (/language)", path: "/language" },
];

/**
 * Find a Chromium/Chrome executable to drive. Prefers explicit overrides, then
 * the Replit-provided Playwright build, then anything named chromium/chrome on
 * PATH. Returns null when nothing usable is found.
 */
function resolveChromiumExecutable(env = process.env) {
  const candidates = [
    env.PUPPETEER_EXECUTABLE_PATH,
    env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    env.CHROMIUM_PATH,
    env.CHROME_PATH,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  for (const name of ["chromium", "chromium-browser", "google-chrome", "chrome"]) {
    try {
      const resolved = execFileSync("which", [name], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (resolved && fs.existsSync(resolved)) {
        return resolved;
      }
    } catch {
      // `which` exits non-zero when not found; try the next name.
    }
  }

  return null;
}

/**
 * Minimal static file server rooted at `rootDir`, with SPA fallback to
 * index.html for non-file paths (Expo web's default "single" output is a SPA).
 * Returns an unstarted http.Server.
 */
function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    let pathname = "/";
    try {
      pathname = decodeURIComponent(
        new URL(req.url || "/", "http://localhost").pathname,
      );
    } catch {
      pathname = "/";
    }

    const safePath = path
      .normalize(pathname)
      .replace(/^(\.\.(\/|\\|$))+/, "");
    let filePath = path.join(rootDir, safePath);

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const isFile =
      fs.existsSync(filePath) && fs.statSync(filePath).isFile();

    // SPA fallback: any path that isn't a real file serves index.html so the
    // client router can take over.
    if (!isFile) {
      filePath = path.join(rootDir, "index.html");
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType });
    res.end(fs.readFileSync(filePath));
  });
}

/**
 * Decide whether the first render succeeded, given what the headless browser
 * observed. Pure so it can be unit-tested.
 *
 * @param {object} obs
 * @param {Array<{message:string,stack?:string}>} obs.pageErrors
 * @param {string[]} obs.consoleErrors
 * @param {{rootChildren:number, bodyText:string}} obs.dom
 * @returns {{ok:boolean, reason?:string, message?:string}}
 */
function analyzeRuntime({ pageErrors = [], consoleErrors = [], dom }) {
  const safeDom = dom || { rootChildren: 0, bodyText: "" };
  const bodyText = safeDom.bodyText || "";

  if (pageErrors.length > 0) {
    const first = pageErrors[0];
    const detail = first.stack || first.message || String(first);
    return {
      ok: false,
      reason: "uncaught-exception",
      message:
        "The web app threw an uncaught exception on first render:\n\n" +
        detail +
        (pageErrors.length > 1
          ? `\n\n(+${pageErrors.length - 1} more uncaught error(s))`
          : ""),
    };
  }

  if (ERROR_FALLBACK_SIGNATURE.test(bodyText)) {
    const reactErrors = consoleErrors.filter((line) => line && line.trim());
    return {
      ok: false,
      reason: "error-boundary",
      message:
        "The web app rendered its ErrorBoundary fallback (\"Something went " +
        "wrong\") on first render — a component threw while rendering.\n\n" +
        (reactErrors.length
          ? "Browser console errors (look for the throwing module/screen):\n" +
            reactErrors.map((line) => `  ${line}`).join("\n")
          : "No console error was captured; re-run the mobile web preview to " +
            "inspect the throw."),
    };
  }

  const rendered =
    safeDom.rootChildren > 0 || bodyText.trim().length > 0;
  if (!rendered) {
    return {
      ok: false,
      reason: "no-render",
      message:
        "The web app mounted nothing on first render (empty <div id=\"root\">)." +
        " The bundle likely failed to evaluate." +
        (consoleErrors.length
          ? "\n\nBrowser console errors:\n" +
            consoleErrors.map((line) => `  ${line}`).join("\n")
          : ""),
    };
  }

  return { ok: true };
}

/**
 * Build a single human-readable error for one or more crashed routes. Pure so
 * it can be unit-tested. Each failure names the route up front so the throwing
 * screen is obvious in the validation log.
 *
 * @param {Array<{route:string, result:{reason?:string, message?:string}}>} failures
 * @returns {string}
 */
function summarizeRouteFailures(failures) {
  const header =
    failures.length === 1
      ? "1 web route crashed on first render:"
      : `${failures.length} web routes crashed on first render:`;

  const blocks = failures.map(({ route, result }) => {
    const reason = result && result.reason ? ` [${result.reason}]` : "";
    const detail = (result && result.message) || "Unknown failure.";
    const indented = detail
      .split("\n")
      .map((line) => (line ? `    ${line}` : line))
      .join("\n");
    return `  ✗ ${route}${reason}\n${indented}`;
  });

  return `${header}\n\n${blocks.join("\n\n")}`;
}

function listenOnFreePort(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // Port 0 lets the OS pick a free port — never collides with the canonical
    // dev-server ports the test harness holds busy.
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(address.port);
    });
  });
}

async function pollForRenderOutcome(page, { timeoutMs, pollMs, pageErrors }) {
  const deadline = Date.now() + timeoutMs;
  let dom = { rootChildren: 0, bodyText: "" };

  while (Date.now() < deadline) {
    if (pageErrors.length > 0) {
      return dom;
    }

    dom = await page.evaluate(() => {
      const root = document.getElementById("root");
      const bodyText = document.body ? document.body.innerText || "" : "";
      return {
        rootChildren: root ? root.childElementCount : 0,
        bodyText: bodyText.slice(0, 4000),
      };
    });

    const settled =
      dom.rootChildren > 0 ||
      ERROR_FALLBACK_SIGNATURE.test(dom.bodyText);
    if (settled) {
      return dom;
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  return dom;
}

/**
 * Render a single route in the given page and decide whether it survived first
 * render. Resets the shared error buffers first so each route is judged on its
 * own navigation. Returns the analyzeRuntime result for that route.
 */
async function checkRoute(page, baseUrl, route, options) {
  const { navTimeoutMs, renderTimeoutMs, pollMs, pageErrors, consoleErrors } =
    options;

  // Fresh buffers per route — the listeners push into these same arrays.
  pageErrors.length = 0;
  consoleErrors.length = 0;

  const url = baseUrl + route.path.replace(/^\//, "");

  try {
    // A full navigation (not client-side routing) forces the screen module to
    // re-evaluate, which is exactly the import-time crash we are hunting for.
    await page.goto(url, { waitUntil: "load", timeout: navTimeoutMs });
  } catch (error) {
    // A navigation timeout still lets us inspect pageErrors below; only a hard
    // failure (e.g. connection refused) is fatal here.
    if (pageErrors.length === 0) {
      return {
        ok: false,
        reason: "navigation",
        message: `Failed to load ${url}: ${error.message}`,
      };
    }
  }

  const dom = await pollForRenderOutcome(page, {
    timeoutMs: renderTimeoutMs,
    pollMs,
    pageErrors,
  });

  return analyzeRuntime({ pageErrors, consoleErrors, dom });
}

/**
 * Load the exported web bundle in headless Chromium and report whether the app
 * survived its first render on a representative set of routes (not just "/").
 * Throws with a clear, route-by-route message when any screen crashes.
 */
async function checkWebRuntime(outputDir, options = {}) {
  const env = options.env || process.env;
  const navTimeoutMs = options.navTimeoutMs ?? 60_000;
  const renderTimeoutMs = options.renderTimeoutMs ?? 30_000;
  const pollMs = options.pollMs ?? 500;
  const routes = options.routes || WEB_RUNTIME_ROUTES;

  const indexPath = path.join(outputDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Web export is missing index.html at ${indexPath}; cannot run the ` +
        "runtime check.",
    );
  }

  const executablePath =
    options.executablePath || resolveChromiumExecutable(env);
  if (!executablePath) {
    throw new Error(
      "Could not find a Chromium/Chrome executable for the web runtime check. " +
        "Set PUPPETEER_EXECUTABLE_PATH (or REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE) " +
        "to a Chromium binary.",
    );
  }

  const puppeteer = options.puppeteer || require("puppeteer-core");

  const server = createStaticServer(outputDir);
  const port = await listenOnFreePort(server);
  const baseUrl = `http://127.0.0.1:${port}/`;

  let browser;
  try {
    console.log("Loading the exported web bundle in headless Chromium...");
    console.log(`Chromium: ${executablePath}`);
    console.log(`Serving:  ${outputDir}`);
    console.log(`Checking ${routes.length} routes for first-render crashes...`);

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();

    const pageErrors = [];
    const consoleErrors = [];

    page.on("pageerror", (error) => {
      pageErrors.push({ message: error.message, stack: error.stack });
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const failures = [];
    for (const route of routes) {
      const result = await checkRoute(page, baseUrl, route, {
        navTimeoutMs,
        renderTimeoutMs,
        pollMs,
        pageErrors,
        consoleErrors,
      });

      if (result.ok) {
        console.log(`  ✓ ${route.name}`);
      } else {
        console.log(`  ✗ ${route.name} [${result.reason}]`);
        failures.push({ route: route.name, result });
      }
    }

    if (failures.length > 0) {
      throw new Error(summarizeRouteFailures(failures));
    }

    console.log(
      `All ${routes.length} routes rendered successfully on first load.`,
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    await new Promise((resolve) => server.close(() => resolve()));
  }
}

module.exports = {
  ERROR_FALLBACK_SIGNATURE,
  WEB_RUNTIME_ROUTES,
  resolveChromiumExecutable,
  createStaticServer,
  analyzeRuntime,
  summarizeRouteFailures,
  checkRoute,
  checkWebRuntime,
};
