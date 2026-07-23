import { describe, expect, it } from "vitest";

import { prismaMock } from "@/test/prisma-mock";
import { getDashboardStats } from "./actions";

describe("dashboard server actions", () => {
  it("aggregates revenue, counts and timeline", async () => {
    prismaMock.order.findMany
      .mockResolvedValueOnce([{ totalAmount: 100 }, { totalAmount: 50 }] as never) // paid orders
      .mockResolvedValueOnce([
        {
          status: "PAID",
          totalAmount: 100,
          table: { name: "T1" },
          payments: [],
          closedAt: new Date(),
          openedAt: new Date(),
        },
        {
          status: "SENT",
          totalAmount: 30,
          table: { name: "T2" },
          payments: [],
          closedAt: null,
          openedAt: new Date(Date.now() - 5 * 60000),
        },
        {
          status: "OPEN",
          totalAmount: 0,
          table: { name: "T3" },
          payments: [],
          closedAt: null,
          openedAt: new Date(Date.now() - 90 * 60000),
        },
      ] as never); // recent orders
    prismaMock.order.count.mockResolvedValue(3);
    prismaMock.table.count.mockResolvedValue(10);
    prismaMock.orderItem.groupBy.mockResolvedValue([
      { productId: "p1", _sum: { quantity: 12 } },
    ] as never);
    prismaMock.product.findUnique.mockResolvedValue({ name: "Latte" } as never);

    const stats = await getDashboardStats();

    expect(stats.revenue).toBe(150);
    expect(stats.activeTables).toBe(10);
    expect(stats.topProduct).toBe("Latte");
    expect(stats.topQty).toBe(12);
    expect(stats.timeline).toHaveLength(3);
    expect(stats.timeline[0].label).toContain("checkout");
  });

  it("falls back when no top product", async () => {
    prismaMock.order.findMany.mockResolvedValue([] as never);
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.table.count.mockResolvedValue(0);
    prismaMock.orderItem.groupBy.mockResolvedValue([] as never);

    const stats = await getDashboardStats();

    expect(stats.revenue).toBe(0);
    expect(stats.topProduct).toBe("—");
    expect(stats.topQty).toBe(0);
    expect(stats.timeline).toEqual([]);
  });
});
