import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// `@/*` -> `./src/*`, mirroring tsconfig.json `paths`. Resolved with an explicit
// alias rather than the `vite-tsconfig-paths` plugin (removed: it emitted a
// deprecation warning now that Vite resolves tsconfig paths natively).
const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// Only *.test.ts / *.test.tsx — *.spec.* is reserved for Playwright e2e (e2e/specs).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": srcDir },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "happy-dom",
          include: ["src/**/*.test.tsx"],
        },
      },
    ],
  },
});
