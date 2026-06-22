#!/usr/bin/env node
/**
 * CI-style guard that the Expo *web* bundle still builds.
 *
 * Why this exists: react-native-worklets' Babel plugin does
 * `require('@babel/generator')` without declaring it as a dependency. Under
 * pnpm's strict isolation that only resolves because of a version-exact
 * `packageExtensions` pin in the workspace's `pnpm-workspace.yaml`. If worklets
 * (or any other transitive Babel plugin) is bumped, the web bundle can silently
 * start failing again with `[BABEL] Cannot find module ...` and nobody notices
 * until a human opens the mobile web preview.
 *
 * This script runs `expo export --platform web` into a throwaway directory and
 * fails loudly (non-zero exit) if the export breaks for any reason — the babel
 * `@babel/generator` resolution or any other transform/bundle error. On a babel
 * resolution failure it adds a pointer to the pin that keeps the build working.
 *
 * It is wired up as the `webbuild` validation command so it runs as a CI check
 * on every change, instead of relying on manual preview inspection.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const { checkWebRuntime } = require("./check-web-runtime");

const projectRoot = path.resolve(__dirname, "..");

// Signatures of the specific, known-silent failure mode this guard protects
// against. Matching any of these lets us print a targeted remediation hint.
const BABEL_GENERATOR_SIGNATURES = [
  /Cannot find module ['"]@babel\/generator['"]/i,
  /react-native-worklets[^\n]*@babel\/generator/i,
];

function runExport(outputDir) {
  return new Promise((resolve) => {
    const child = spawn(
      "pnpm",
      ["exec", "expo", "export", "--platform", "web", "--output-dir", outputDir],
      {
        cwd: projectRoot,
        env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let output = "";
    const capture = (data) => {
      const text = data.toString();
      output += text;
      // Stream through so the validation log shows live progress.
      process.stdout.write(text);
    };

    if (child.stdout) child.stdout.on("data", capture);
    if (child.stderr) child.stderr.on("data", capture);

    child.on("error", (error) => {
      resolve({ code: 1, output: `${output}\nFailed to spawn expo: ${error.message}` });
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, output });
    });
  });
}

function findWebBundle(outputDir) {
  const webJsDir = path.join(outputDir, "_expo", "static", "js", "web");
  if (!fs.existsSync(webJsDir)) {
    return null;
  }
  const bundle = fs
    .readdirSync(webJsDir)
    .find((name) => name.endsWith(".js"));
  return bundle ? path.join(webJsDir, bundle) : null;
}

async function main() {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "haulbrokr-webbuild-"));

  try {
    console.log("Checking that the Expo web bundle builds...");
    console.log(`Output dir: ${outputDir}`);

    const { code, output } = await runExport(outputDir);

    if (code !== 0) {
      const hitBabelSignature = BABEL_GENERATOR_SIGNATURES.some((re) =>
        re.test(output),
      );

      let message =
        `Expo web bundle failed to build (expo export --platform web exited ${code}).`;

      if (hitBabelSignature) {
        message +=
          "\n\nThis looks like the react-native-worklets @babel/generator " +
          "regression: the worklets Babel plugin requires '@babel/generator' " +
          "without declaring it. Make sure the packageExtensions pin in " +
          "pnpm-workspace.yaml still matches the installed react-native-worklets " +
          "version (e.g. 'react-native-worklets@<version>': { dependencies: " +
          "{ '@babel/generator': ... } }), then run `pnpm install`.";
      }

      throw new Error(message);
    }

    const bundle = findWebBundle(outputDir);
    if (!bundle) {
      throw new Error(
        "Expo web export reported success but produced no web JS bundle " +
          `under ${path.join(outputDir, "_expo", "static", "js", "web")}.`,
      );
    }

    const size = fs.statSync(bundle).size;
    if (size === 0) {
      throw new Error(`Expo web bundle is empty: ${bundle}`);
    }

    console.log(
      `Web bundle built successfully (${(size / 1_000_000).toFixed(2)} MB).`,
    );

    // A clean build isn't enough: the bundle can still throw the moment it
    // renders in a browser (e.g. a native-only module imported on web). Load
    // the exported output in headless Chromium and fail if first render crashes.
    await checkWebRuntime(outputDir);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`\nWeb build check failed: ${error.message}`);
  process.exit(1);
});
