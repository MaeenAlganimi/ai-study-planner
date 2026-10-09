import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@atrium/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/shared/src/**/*.test.ts", "apps/server/src/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
