import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude:
      process.env.RUN_DB_TESTS === "true" ? [] : ["**/company-flow.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
