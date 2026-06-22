/**
 * Vitest bootstrap.
 *
 * - Sets a default DATABASE_URL so `@workspace/db` can load in unit tests.
 * - DB integration tests (`company-flow.test.ts`) run only when RUN_DB_TESTS=true
 *   (CI sets this; local: `RUN_DB_TESTS=true pnpm --filter @workspace/api-server test`).
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgres://haulbrokr:haulbrokr@localhost:5432/haulbrokr?sslmode=disable";
}
