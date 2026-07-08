// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression guard for the failure paths in `scripts/build.js`.
 *
 * These helpers used to call `process.exit(1)` (directly or via an
 * `exitWithError` helper), which killed the test runner and made the failure
 * paths impossible to assert. They now throw descriptive Errors, leaving the
 * `require.main === module` catch block in `main()` as the single exit point.
 * These tests confirm the highest-risk failures surface as thrown Errors.
 */

const require = createRequire(import.meta.url);

interface AssetDescriptor {
  originalPath: string;
  filename: string;
  relativePath: string;
  hash: string;
}

const build = require("../scripts/build.js") as {
  getDeploymentDomain: () => string;
  updateManifests: (
    manifests: { ios: unknown; android: unknown },
    timestamp: string,
    baseUrl: string,
    assetsByHash: Map<string, unknown>,
  ) => void;
  downloadAssets: (
    assets: AssetDescriptor[],
    timestamp: string,
    options?: { port?: number },
  ) => Promise<number>;
  downloadBundlesAndManifests: (
    timestamp: string,
    options?: {
      downloadBundle?: (platform: string, timestamp: string) => Promise<void>;
      downloadManifest?: (platform: string) => Promise<unknown>;
    },
  ) => Promise<{ ios: unknown; android: unknown }>;
};

const DOMAIN_VARS = [
  "REPLIT_INTERNAL_APP_DOMAIN",
  "REPLIT_DEV_DOMAIN",
  "EXPO_PUBLIC_DOMAIN",
] as const;

describe("getDeploymentDomain", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of DOMAIN_VARS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of DOMAIN_VARS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("throws a descriptive error when no deployment domain is set", () => {
    expect(() => build.getDeploymentDomain()).toThrow(
      /No deployment domain found/,
    );
  });

  it("returns the host for REPLIT_INTERNAL_APP_DOMAIN", () => {
    process.env.REPLIT_INTERNAL_APP_DOMAIN = "https://example.replit.app";
    expect(build.getDeploymentDomain()).toBe("example.replit.app");
  });

  it("falls back to REPLIT_DEV_DOMAIN when the internal domain is absent", () => {
    process.env.REPLIT_DEV_DOMAIN = "dev.example.repl.co";
    expect(build.getDeploymentDomain()).toBe("dev.example.repl.co");
  });
});

describe("updateManifests", () => {
  it("throws when a manifest is missing launchAsset", () => {
    const manifests = {
      ios: { extra: {} },
      android: { launchAsset: {}, extra: {} },
    };

    expect(() =>
      build.updateManifests(manifests, "123-1", "https://x.dev", new Map()),
    ).toThrow(/Malformed manifest for ios/);
  });

  it("throws when a manifest is missing extra", () => {
    const manifests = {
      ios: { launchAsset: {} },
      android: { launchAsset: {}, extra: {} },
    };

    expect(() =>
      build.updateManifests(manifests, "123-1", "https://x.dev", new Map()),
    ).toThrow(/Malformed manifest for ios/);
  });
});

describe("downloadAssets", () => {
  // Every output write lands under projectRoot/static-build/<timestamp>; we use a
  // unique timestamp per test and clean it up so the suite leaves no artifacts.
  const projectRoot = path.resolve(__dirname, "..");
  const createdTimestamps: string[] = [];

  afterEach(() => {
    while (createdTimestamps.length) {
      const ts = createdTimestamps.pop()!;
      fs.rmSync(path.join(projectRoot, "static-build", ts), {
        recursive: true,
        force: true,
      });
    }
  });

  function freshTimestamp(): string {
    const ts = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    createdTimestamps.push(ts);
    return ts;
  }

  function makeAsset(filename: string): AssetDescriptor {
    return {
      // A real Metro asset path: the unstable_path query is what build.js reads
      // to locate the source file on disk.
      originalPath: `/assets/${filename}?unstable_path=.%2Fassets&platform=ios`,
      filename,
      relativePath: "assets",
      hash: "deadbeef",
    };
  }

  it("throws a descriptive error listing the asset(s) missing on disk", async () => {
    const timestamp = freshTimestamp();
    const asset = makeAsset("does-not-exist-12345.png");

    await expect(
      build.downloadAssets([asset], timestamp, { port: 8081 }),
    ).rejects.toThrow(/Failed to download 1 asset\(s\)/);

    await expect(
      build.downloadAssets([asset], timestamp, { port: 8081 }),
    ).rejects.toThrow(/does-not-exist-12345\.png: Asset not found on disk/);
  });

  it("names every failing asset when several are missing", async () => {
    const timestamp = freshTimestamp();
    const assets = [
      makeAsset("missing-a-98765.png"),
      makeAsset("missing-b-98765.png"),
    ];

    await expect(
      build.downloadAssets(assets, timestamp, { port: 8081 }),
    ).rejects.toThrow(/Failed to download 2 asset\(s\)/);

    const error = await build
      .downloadAssets(assets, timestamp, { port: 8081 })
      .catch((e: Error) => e);
    expect(String(error)).toContain("missing-a-98765.png");
    expect(String(error)).toContain("missing-b-98765.png");
  });
});

describe("downloadBundlesAndManifests", () => {
  it("wraps an underlying bundle download failure as 'Download failed: ...'", async () => {
    await expect(
      build.downloadBundlesAndManifests("123-1", {
        downloadBundle: async () => {
          throw new Error("HTTP 500");
        },
        downloadManifest: async () => ({}),
      }),
    ).rejects.toThrow(/Download failed: HTTP 500/);
  });

  it("wraps an underlying manifest download failure as 'Download failed: ...'", async () => {
    await expect(
      build.downloadBundlesAndManifests("123-1", {
        downloadBundle: async () => {},
        downloadManifest: async () => {
          throw new Error(
            "Manifest download timeout after 5m for platform: ios",
          );
        },
      }),
    ).rejects.toThrow(/Download failed: Manifest download timeout/);
  });
});
