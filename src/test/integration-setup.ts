import { vi } from "vitest";

// Integration setup: the database is REAL (no @/lib/db mock here). We only stub
// the framework/runtime edges that cannot run outside a Next.js request and the
// cross-module side effects that belong to other modules, so the order module's
// own data flow is exercised end-to-end against Postgres.

// next/cache: revalidatePath/Tag throw when called outside a request scope.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

// Printing reaches a TCP/Bluetooth printer — not available in CI. Stub it.
vi.mock("@/server/reports/print-actions", () => ({
  createPrintJob: vi.fn(async () => ({ success: true, jobId: "test-print-job" })),
}));

// Stock deduction belongs to the inventory/recipe module. checkoutOrder calls it
// when the `inventory` system module is enabled; stub it so the order test does
// not depend on seeded recipes/stock batches (that boundary is covered elsewhere).
vi.mock("@/server/recipe/actions", () => ({
  autoDeductStockForOrder: vi.fn(async () => undefined),
}));
