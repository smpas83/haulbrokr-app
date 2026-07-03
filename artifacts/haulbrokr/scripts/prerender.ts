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
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist/public");
const assetsDir = path.join(distDir, "assets");

const routes: Array<{ component: string; outputFile: string; route: string }> = [
  { component: "landing", outputFile: "index.html", route: "/" },
  { component: "features", outputFile: "features.html", route: "/features" },
  { component: "industries", outputFile: "industries.html", route: "/industries" },
  { component: "pricing", outputFile: "pricing.html", route: "/pricing" },
  { component: "about", outputFile: "about.html", route: "/about" },
  { component: "contact", outputFile: "contact.html", route: "/contact" },
  { component: "terms", outputFile: "terms.html", route: "/terms" },
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

function builtAssetUrl(sourceFileName: string) {
  if (!existsSync(assetsDir)) {
    return null;
  }

  const ext = path.extname(sourceFileName);
  const baseName = path.basename(sourceFileName, ext);
  const builtName = readdirSync(assetsDir).find((fileName) => {
    return fileName.startsWith(`${baseName}-`) && fileName.endsWith(ext);
  });

  return builtName ? `/assets/${builtName}` : null;
}

function rewriteDevAssetUrls(html: string) {
  return html.replace(
    /\/src\/assets\/([A-Za-z0-9._-]+\.(?:png|jpe?g|webp|svg|gif))/g,
    (match, fileName: string) => builtAssetUrl(fileName) ?? match,
  );
}

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
      `<div id="root">${rewriteDevAssetUrls(appHtml)}</div>`,
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
