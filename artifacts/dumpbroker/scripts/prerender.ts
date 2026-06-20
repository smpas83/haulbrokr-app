#!/usr/bin/env node
/**
 * Post-build prerender script.
 * Renders each public route component to static HTML using Vite's SSR API
 * and injects the markup into the corresponding built HTML file so crawlers
 * receive a fully-populated body on the first HTTP response.
 *
 * Run automatically as part of `pnpm build` (see package.json).
 */

// --- Mock browser globals before any module loading ---
// Wouter (and other browser-dependent libs) reference `location` at module
// evaluation time. Provide a minimal stub so SSR loading succeeds.

const mockLocation = {
  href: "http://localhost/",
  pathname: "/",
  search: "",
  hash: "",
  host: "localhost",
  hostname: "localhost",
  origin: "http://localhost",
  port: "",
  protocol: "http:",
  assign: () => {},
  replace: () => {},
  reload: () => {},
};

const mockHistory = {
  pushState: () => {},
  replaceState: () => {},
  go: () => {},
  back: () => {},
  forward: () => {},
  state: null,
  length: 1,
  scrollRestoration: "auto" as const,
};

Object.defineProperty(global, "location", {
  value: mockLocation,
  writable: true,
  configurable: true,
});

Object.defineProperty(global, "history", {
  value: mockHistory,
  writable: true,
  configurable: true,
});

Object.defineProperty(global, "window", {
  value: {
    location: mockLocation,
    history: mockHistory,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 16),
    cancelAnimationFrame: clearTimeout,
    matchMedia: () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    scrollTo: () => {},
    innerWidth: 1280,
    innerHeight: 720,
    navigator: { userAgent: "node" },
  },
  writable: true,
  configurable: true,
});

Object.defineProperty(global, "document", {
  value: {
    createElement: () => ({ style: {} }),
    createElementNS: () => ({ style: {} }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild: () => {}, removeChild: () => {} },
    body: { appendChild: () => {}, removeChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: { style: {}, lang: "en" },
    readyState: "complete",
    title: "",
  },
  writable: true,
  configurable: true,
});

// --- Now do the real work ---

import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist/public");

const routes: Array<{ component: string; outputFile: string; route: string }> = [
  { component: "landing", outputFile: "index.html", route: "/" },
  { component: "support", outputFile: "support.html", route: "/support" },
  { component: "privacy", outputFile: "privacy.html", route: "/privacy" },
  { component: "not-found", outputFile: "404.html", route: "/404" },
];

const mockAssetsPlugin = {
  name: "prerender-mock-assets",
  resolveId(id: string) {
    if (/\.(png|jpg|jpeg|svg|gif|webp|ico)(\?.*)?$/.test(id)) {
      return `\0prerender-asset:${id}`;
    }
  },
  load(id: string) {
    if (id.startsWith("\0prerender-asset:")) {
      return "export default ''";
    }
  },
};

const vite = await createServer({
  configFile: path.join(root, "vite.prerender.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
  plugins: [mockAssetsPlugin],
});

let exitCode = 0;

for (const { component, outputFile, route } of routes) {
  const htmlFilePath = path.join(distDir, outputFile);

  if (!existsSync(htmlFilePath)) {
    console.warn(`[prerender] skipping ${route}: ${outputFile} not found in dist`);
    continue;
  }

  try {
    const mod = await vite.ssrLoadModule(`/src/pages/${component}.tsx`);
    const Component = mod.default as React.ComponentType;

    const appHtml = renderToStaticMarkup(
      React.createElement(Component),
    );

    let template = readFileSync(htmlFilePath, "utf-8");
    template = template.replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`,
    );
    writeFileSync(htmlFilePath, template, "utf-8");

    console.log(`[prerender] ✓ ${route}  →  dist/${outputFile}`);
  } catch (err) {
    console.error(`[prerender] ✗ failed to prerender ${route}:`, err);
    exitCode = 1;
  }
}

await vite.close();
process.exit(exitCode);
