import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Pin root explicitly: route-group dirs like `src/app/(pos)` contain
    // parentheses that otherwise confuse vitest's auto root detection when a
    // test file lives inside them.
    root: __dirname,
    environment: "jsdom",
    globals: true,
    testTimeout: 10000,
    setupFiles: [resolve(__dirname, "src/test/setup.ts")],
    // Integration tests hit a real Postgres DB and run via
    // vitest.integration.config.ts — keep them out of the mocked unit run.
    exclude: ["node_modules/**", "dist/**", ".next/**", "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/**",
        "src/.next/**",
        "src/test/**",
        "src/components/ui/**", // shadcn generated components
        "src/app/**/(page|layout|loading|error).tsx",
        "prisma/**",
        "**/*.d.ts",
        // NextAuth wiring + Prisma singleton: side-effect modules that cannot be
        // loaded under jsdom/vitest (next-auth fails to resolve `next/server`).
        "src/lib/auth.ts",
        "src/lib/auth-types.ts",
        "src/app/api/auth/**",
      ],
      // Ratcheted gate: locked to coverage actually achieved across the whole
      // source tree (not just touched files). Raise these toward 85 as the
      // remaining deep UI interaction tests land — see docs/unit-test-coverage-plan.md
      // "Fase 6". Lines is the headline metric; branches lags because the large
      // client components in src/app/(pos) have many untested conditional paths.
      thresholds: {
        statements: 70,
        branches: 55,
        functions: 56,
        lines: 76,
      },
    },
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
