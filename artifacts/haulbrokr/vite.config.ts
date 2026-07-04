import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Replit [services.env] variables (PORT, BASE_PATH) are injected at serve/runtime
// only, NOT during the deployment build step. So these are validated strictly when
// serving (dev/preview) and fall back to build-safe defaults during `vite build`.
function resolvePort(required: boolean): number | undefined {
  const rawPort = process.env.PORT;

  if (!rawPort) {
    if (required) {
      throw new Error(
        "PORT environment variable is required but was not provided.",
      );
    }
    return undefined;
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return port;
}

function resolveBasePath(required: boolean): string {
  const basePath = process.env.BASE_PATH;

  if (!basePath) {
    if (required) {
      throw new Error(
        "BASE_PATH environment variable is required but was not provided.",
      );
    }
    return "/";
  }

  return basePath;
}

const knownSpaRoutes = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/onboarding",
  "/dashboard",
  "/requests",
  "/fleet",
  "/jobs",
  "/map",
  "/dispatch",
  "/account",
  "/company",
  "/bins",
  "/projects",
  "/factoring",
  "/integrations",
  "/mobile-payment",
  "/admin",
  "/admin/login",
]);

const knownSpaPrefixes = [
  "/sign-in/",
  "/sign-up/",
  "/onboarding/",
  "/dashboard/",
  "/requests/",
  "/fleet/",
  "/jobs/",
  "/map/",
  "/dispatch/",
  "/account/",
  "/company/",
  "/bins/",
  "/projects/",
  "/factoring/",
  "/integrations/",
  "/mobile-payment/",
  "/admin/",
];

/**
 * In dev mode, route /support and /privacy to their own HTML entry files, and
 * return 404.html (with a 404 status) for any path that doesn't match a known
 * app route so dev behaviour mirrors the production static-server config.
 */
function publicRoutesDevMiddleware(): Plugin {
  return {
    name: "public-routes-dev-middleware",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        const stripped = url.split("?")[0];

        if (stripped === "/support" || stripped === "/support/") {
          req.url = "/support.html";
          return next();
        }
        if (stripped === "/privacy" || stripped === "/privacy/") {
          req.url = "/privacy.html";
          return next();
        }
        if (stripped === "/terms" || stripped === "/terms/") {
          req.url = "/terms.html";
          return next();
        }

        const isKnown =
          stripped.startsWith("/api") ||
          knownSpaRoutes.has(stripped) ||
          knownSpaRoutes.has(stripped.replace(/\/$/, "") || "/") ||
          knownSpaPrefixes.some((p) => stripped.startsWith(p)) ||
          stripped.startsWith("/@") ||
          stripped.startsWith("/src/") ||
          stripped.startsWith("/node_modules/") ||
          stripped.includes(".");

        if (!isKnown) {
          req.url = "/404.html";
          res.statusCode = 404;
        }

        next();
      });
    },
  };
}

export default defineConfig(async ({ command }) => {
  const isServe = command === "serve";
  const port = resolvePort(isServe);
  const basePath = resolveBasePath(isServe);

  return {
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    publicRoutesDevMiddleware(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, "index.html"),
        support: path.resolve(import.meta.dirname, "support.html"),
        privacy: path.resolve(import.meta.dirname, "privacy.html"),
        terms: path.resolve(import.meta.dirname, "terms.html"),
        notFound: path.resolve(import.meta.dirname, "404.html"),
      },
      output: {
        manualChunks: {
          "auth-shell": [
            path.resolve(import.meta.dirname, "src/AuthShell.tsx"),
          ],
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
    proxy: isServe
      ? {
          "/api": {
            target: process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8080",
            changeOrigin: true,
          },
        }
      : undefined,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  };
});
