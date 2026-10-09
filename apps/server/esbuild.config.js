import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const sharedEntry = path.resolve(here, "../../packages/shared/src/index.ts");

await esbuild.build({
  entryPoints: [path.join(here, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: path.join(here, "dist/index.js"),
  packages: "external",
  plugins: [
    {
      name: "bundle-shared",
      setup(build) {
        build.onResolve({ filter: /^@atrium\/shared$/ }, () => ({
          path: sharedEntry,
        }));
      },
    },
  ],
});
