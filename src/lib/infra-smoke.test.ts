import { beforeAll, describe, expect, it, vi } from "vitest";

// Smoke-test the singleton/config modules that are otherwise side-effect only.
// We unmock the real db module so db.ts executes (construction is lazy — no
// connection is opened) and auth.ts can wire up NextAuth against it.
vi.unmock("@/lib/db");

beforeAll(() => {
  process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
  process.env.AUTH_SECRET ??= "test-secret";
});

describe("infra smoke", () => {
  it("db module exposes a prisma client instance", async () => {
    const { db } = await import("@/lib/db");
    expect(db).toBeDefined();
    expect(db.user).toBeDefined();
  });

  // NOTE: src/lib/auth.ts and the [...nextauth] route are NOT tested here.
  // next-auth resolves `next/server` in a way jsdom/vitest cannot load, and
  // construction has real side effects. They are excluded from coverage in
  // vitest.config.ts instead.
});
