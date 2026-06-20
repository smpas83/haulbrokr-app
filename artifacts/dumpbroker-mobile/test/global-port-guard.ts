import net from "node:net";

/**
 * Vitest globalSetup that mirrors a normal running workspace by holding the
 * canonical dev-server ports busy for the entire test run.
 *
 * Background: the Metro port-resolution tests (build-metro-port.test.ts) only
 * exercise the "port already taken" path meaningfully when something actually
 * owns that port. For a long time the suite ran in environments where the dev
 * servers (and their ports) weren't up, so a regression to a hardcoded Metro
 * port (8081) could pass silently and only blow up later when 8081 happened to
 * be occupied.
 *
 * By binding the canonical ports here, every `pnpm test` run reproduces the
 * "ports busy" workspace regardless of whether the real dev servers are running:
 * - In a live workspace the real servers already own these ports; our bind
 *   no-ops (EADDRINUSE) but the port stays busy, so the guarantee holds.
 * - In a bare CI/agent environment we bind them ourselves for the duration.
 *
 * The payoff is enforcement: any test or build code that assumes it can listen
 * on a fixed port will now hit EADDRINUSE and fail loudly during the run,
 * instead of silently passing until the port collides in production.
 */

export const CANONICAL_PORTS = [8081];

function holdPort(port: number): Promise<net.Server | null> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => {
      // Already in use (e.g. a real dev server owns it). Still busy — fine.
      resolve(null);
    });
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

export default async function setup() {
  const held = await Promise.all(CANONICAL_PORTS.map(holdPort));

  return async () => {
    await Promise.all(
      held.map(
        (server) =>
          new Promise<void>((resolve) => {
            if (server) {
              server.close(() => resolve());
            } else {
              resolve();
            }
          }),
      ),
    );
  };
}
