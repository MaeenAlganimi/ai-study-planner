import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves repo paths from the process entry. Works for `tsx src/index.ts`
 * and for the esbuild bundle at `dist/index.js`, both one directory below
 * `apps/server`.
 */
export function resolvePaths(entryUrl: string): {
  repoRoot: string;
  serverRoot: string;
  fixturesDir: string;
  webDistDir: string;
  envFile: string;
} {
  const here = path.dirname(fileURLToPath(entryUrl));
  const serverRoot = path.resolve(here, "..");
  const repoRoot = path.resolve(serverRoot, "../..");
  return {
    repoRoot,
    serverRoot,
    fixturesDir: path.join(serverRoot, "fixtures"),
    webDistDir: path.resolve(serverRoot, "../web/dist"),
    envFile: path.join(repoRoot, ".env"),
  };
}
