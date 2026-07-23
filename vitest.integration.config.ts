import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Integration tests run the real server actions against a real Postgres
// database (DATABASE_URL) — no Prisma mock. They live in `*.integration.test.ts`
// files and are excluded from the unit run (see vitest.config.ts).
//
// Requires a seeded database. Locally:
//   docker compose up -d db
//   npx prisma db push && npx tsx prisma/seed.ts
//   npm run test:integration:db
export default defineConfig({
  test: {
    root: __dirname,
    // Node, not jsdom: these exercise server-side data flow, no DOM needed.
    environment: "node",
    globals: true,
    // Verbose reporter prints the full describe/it tree (every case name) so CI
    // logs show each scenario instead of the collapsed "(N tests)" summary line.
    reporters: ["verbose"],
    // Mute the "[PRINT] ..." logs from printOrderTicket so the verbose tree
    // stays readable; other console output is preserved.
    onConsoleLog: (log) => (log.includes("[PRINT]") ? false : undefined),
    include: ["src/**/*.integration.test.ts"],
    // Real DB round-trips + seed lookups are slower than mocked unit tests.
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: [resolve(__dirname, "src/test/integration-setup.ts")],
    // Single worker: tests share one Postgres instance and mutate order rows,
    // so run them serially to keep state assertions deterministic.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
