import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Replit [services.env] variables (PORT, BASE_PATH) are injected at serve/runtime
// only, NOT during the deployment build step. So these are validated strictly when
// serving (dev/preview) and fall back to build-safe defaults during `vite build`.
// PROD_BASE_PATH must match this artifact's previewPath in .replit-artifact/artifact.toml.
const PROD_BASE_PATH = "/haulbrokr-deck/";

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
    return PROD_BASE_PATH;
  }

  return basePath;
}

export default defineConfig(async ({ command }) => {
  const isServe = command === "serve";
  const port = resolvePort(isServe);
  const basePath = resolveBasePath(isServe);

  return {
  base: basePath,
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
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
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  };
});
