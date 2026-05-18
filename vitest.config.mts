import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Only *.test.ts / *.test.tsx — *.spec.* is not a convention used in this project.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
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
