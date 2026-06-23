import { describe, it, expect } from "vitest";
import { applyEnvFile, parseEnvFileContents } from "./load-env";

describe("load-env precedence", () => {
  it("parses quoted values and skips comments", () => {
    const parsed = parseEnvFileContents(`
# comment
DATABASE_URL="postgresql://from-file"
STAFF_DEFAULT_PASSWORD=secret
`);
    expect(parsed.DATABASE_URL).toBe("postgresql://from-file");
    expect(parsed.STAFF_DEFAULT_PASSWORD).toBe("secret");
  });

  it("does not overwrite an exported DATABASE_URL from .env", () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://exported@ep-real.neon.tech/neondb?sslmode=require",
    };
    applyEnvFile(
      { DATABASE_URL: "postgresql://placeholder@ep-xxxxx.neon.tech/neondb?sslmode=require" },
      env,
    );
    expect(env.DATABASE_URL).toBe("postgresql://exported@ep-real.neon.tech/neondb?sslmode=require");
  });

  it("fills DATABASE_URL from .env when not exported", () => {
    const env: NodeJS.ProcessEnv = {};
    applyEnvFile(
      { DATABASE_URL: "postgresql://from-file@ep-real.neon.tech/neondb?sslmode=require" },
      env,
    );
    expect(env.DATABASE_URL).toBe("postgresql://from-file@ep-real.neon.tech/neondb?sslmode=require");
  });

  it("does not overwrite exported STAFF_DEFAULT_PASSWORD", () => {
    const env: NodeJS.ProcessEnv = { STAFF_DEFAULT_PASSWORD: "from-shell" };
    applyEnvFile({ STAFF_DEFAULT_PASSWORD: "from-file" }, env);
    expect(env.STAFF_DEFAULT_PASSWORD).toBe("from-shell");
  });
});
