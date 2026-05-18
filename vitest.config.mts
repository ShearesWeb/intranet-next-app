import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    projects: [
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          globals: true,
        },
      },
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "component",
          environment: "happy-dom",
          include: ["src/**/*.test.tsx"],
          globals: true,
        },
      },
    ],
  },
});
