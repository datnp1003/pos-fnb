import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";

import { prismaMock } from "@/test/prisma-mock";
import { autoDeductStockForOrder } from "@/server/recipe/actions";
import { isSystemModuleEnabled } from "@/server/settings/actions";
import { createPrintJob } from "@/server/reports/print-actions";
import {
  addItem,
  cancelItem,
  checkoutOrder,
  getCategoriesWithProducts,
  getActiveAreasWithTables,
  getAreasWithTables,
  getOrder,
  getTempBill,
  mergeTables,
  openTable,
  printTempBill,
  refreshKaraokeTime,
  removeItem,
  sendOrder,
  splitItems,
  splitItemsEvenly,
  updateItemQuantity,
  updateOrderGuest,
} from "./actions";

vi.mock("@/server/recipe/actions", () => ({
  autoDeductStockForOrder: vi.fn(),
}));

vi.mock("@/server/settings/actions", () => ({
  isSystemModuleEnabled: vi.fn(),
}));

vi.mock("@/server/reports/print-actions", () => ({
  createPrintJob: vi.fn(),
}));

const revalidatePathMock = vi.mocked(revalidatePath);
const autoDeductStockForOrderMock = vi.mocked(autoDeductStockForOrder);
const createPrintJobMock = vi.mocked(createPrintJob);
const isSystemModuleEnabledMock = vi.mocked(isSystemModuleEnabled);

function mockRecalcDependencies() {
  prismaMock.order.findUnique.mockResolvedValueOnce({
    id: "order-1",
    status: "OPEN",
    table: { isKaraoke: false, area: { type: "RESTAURANT" } },
  });
  prismaMock.order.findUnique.mockResolvedValueOnce({
    id: "order-1",
    guestCount: 2,
    discountAmount: 0,
    table: { areaId: "area-1" },
    items: [],
  });
  prismaMock.serviceCharge.findMany.mockResolvedValue([]);
  prismaMock.holiday.findMany.mockResolvedValue([]);
  prismaMock.order.update.mockResolvedValue({ id: "order-1" });
}

describe("order server actions", () => {
  beforeEach(() => {
    createPrintJobMock.mockResolvedValue({ success: true, jobId: "print-1" });
  });

  it("queries areas with active table orders", async () => {
    prismaMock.area.findMany.mockResolvedValue([{ id: "area-1" }]);

    await expect(getAreasWithTables()).resolves.toEqual([{ id: "area-1" }]);
    expect(prismaMock.area.findMany).toHaveBeenCalledWith({
      include: {
        tables: {
          include: {
            orders: {
              where: { status: { in: ["OPEN", "SENT"] } },
              select: {
                id: true,
                status: true,
                orderNumber: true,
                orderNumberSuffix: true,
                type: true,
                openedAt: true,
                guestCount: true,
                totalAmount: true,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
  });

  it("queries order detail and categories with products", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: "order-1" });
    prismaMock.category.findMany.mockResolvedValue([{ id: "category-1" }]);

    await expect(getOrder("order-1")).resolves.toEqual({ id: "order-1" });
    await expect(getCategoriesWithProducts()).resolves.toEqual([{ id: "category-1" }]);

    expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
      where: { id: "order-1" },
      include: {
        table: { include: { area: true } },
        items: {
          include: {
            product: { include: { category: true, vat: true, exciseTax: true, unit: true } },
            toppings: { include: { topping: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        payments: true,
        karaokeSessions: true,
        user: { select: { name: true } },
      },
    });
  });

  it("returns an existing open order without creating another table order", async () => {
    const existingOrder = { id: "order-existing", status: "OPEN" };
    prismaMock.order.findFirst.mockResolvedValueOnce(existingOrder);

    await expect(openTable("table-1")).resolves.toBe(existingOrder);
    expect(prismaMock.order.create).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("adds an item with toppings and recalculates the order", async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: "product-1", price: 25 });
    prismaMock.orderItem.create.mockResolvedValue({ id: "item-1" });
    mockRecalcDependencies();

    await expect(
      addItem("order-1", "product-1", 2, [{ toppingId: "topping-1", price: 3 }]),
    ).resolves.toEqual({ id: "item-1" });

    expect(prismaMock.orderItem.create).toHaveBeenCalledWith({
      data: {
        orderId: "order-1",
        productId: "product-1",
        quantity: 2,
        unitPrice: 25,
        toppings: {
          create: [{ toppingId: "topping-1", price: 3 }],
        },
      },
      include: { product: true, toppings: { include: { topping: true } } },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/order");
  });

  it("updates guest count and item quantity", async () => {
    prismaMock.orderItem.update.mockResolvedValue({ id: "item-1" });
    prismaMock.orderItem.findUnique.mockResolvedValue({ id: "item-1", orderId: "order-1" });
    mockRecalcDependencies();

    await updateOrderGuest("order-1", 4);
    await updateItemQuantity("item-1", 3);

    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { guestCount: 4 },
    });
    expect(prismaMock.orderItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { quantity: 3 },
    });
  });

  it("throws when adding an unknown product", async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);

    await expect(addItem("order-1", "missing-product")).rejects.toThrow("Product not found");
    expect(prismaMock.orderItem.create).not.toHaveBeenCalled();
  });

  it("removes an item and recalculates its order", async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue({ id: "item-1", orderId: "order-1" });
    prismaMock.orderItem.delete.mockResolvedValue({ id: "item-1" });
    mockRecalcDependencies();

    await removeItem("item-1");

    expect(prismaMock.orderItem.delete).toHaveBeenCalledWith({ where: { id: "item-1" } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/order");
  });

  it("cancels an item and preserves existing note when no new note is passed", async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue({ id: "item-1", note: "keep" });
    prismaMock.orderItem.update.mockResolvedValue({ id: "item-1", orderId: "order-1" });
    mockRecalcDependencies();

    await cancelItem("item-1", "user-1");

    expect(prismaMock.orderItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: {
        status: "CANCELLED",
        cancelledBy: "user-1",
        cancelledAt: expect.any(Date),
        note: "keep",
      },
    });
  });

  it("sends pending non-karaoke items and creates an order print job", async () => {
    prismaMock.product.findMany.mockResolvedValue([{ id: "karaoke-product" }]);
    prismaMock.orderItem.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });

    await sendOrder("order-1", "area-1");

    expect(prismaMock.orderItem.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        status: "PENDING",
        productId: { notIn: ["karaoke-product"] },
      },
      data: { status: "SENT" },
    });
    expect(createPrintJobMock).toHaveBeenCalledWith({ orderId: "order-1", type: "ORDER" });
  });

  it("merges source orders into a target table order", async () => {
    prismaMock.order.findFirst.mockResolvedValue({ id: "target-order" });
    prismaMock.order.update.mockResolvedValue({ id: "target-order" });
    prismaMock.orderItem.updateMany.mockResolvedValue({ count: 1 });
    mockRecalcDependencies();

    await mergeTables(["source-order"], "table-1");

    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "source-order" },
      data: { status: "MERGED", parentOrderId: "target-order", closedAt: expect.any(Date) },
    });
    expect(prismaMock.orderItem.updateMany).toHaveBeenCalledWith({
      where: { orderId: "source-order" },
      data: { orderId: "target-order" },
    });
  });

  it("splits selected items into a new split order", async () => {
    prismaMock.order.findUnique.mockImplementation(async (args: unknown) => {
      const query = args as {
        select?: { orderNumber?: boolean };
        include?: { table?: { include?: { area?: boolean } } };
      };
      if (query.select?.orderNumber) return { orderNumber: 7 };
      if (query.include?.table?.include?.area) {
        return {
          id: "order-1",
          status: "OPEN",
          table: { isKaraoke: false, area: { type: "RESTAURANT" } },
        };
      }
      return {
        id: "order-1",
        guestCount: 1,
        discountAmount: 0,
        table: { areaId: "area-1" },
        items: [],
      };
    });
    prismaMock.order.count.mockResolvedValue(1);
    prismaMock.order.create.mockResolvedValue({ id: "split-order" });
    prismaMock.orderItem.findMany.mockResolvedValue([]);
    prismaMock.serviceCharge.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });

    await splitItems("order-1", ["item-1"], "table-2");

    expect(prismaMock.order.create).toHaveBeenCalledWith({
      data: {
        orderNumber: 7,
        orderNumberSuffix: "2",
        tableId: "table-2",
        guestCount: 1,
        status: "SPLIT",
        parentOrderId: "order-1",
        splitFrom: "order-1",
        type: "NORMAL",
      },
    });
    expect(prismaMock.orderItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { orderId: "split-order" },
    });
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "SPLIT", closedAt: expect.any(Date) },
    });
  });

  it("checks out a paid order, records payments, income, inventory deduction and print job", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: 7,
      orderNumberSuffix: null,
      type: "NORMAL",
      totalAmount: 100,
      table: { areaId: "area-1" },
      items: [],
      payments: [],
      karaokeSessions: [],
      user: null,
    });
    prismaMock.payment.create.mockResolvedValue({ id: "payment-1" });
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });
    prismaMock.cashFlow.create.mockResolvedValue({ id: "cash-flow-1" });
    isSystemModuleEnabledMock.mockResolvedValue(true);
    autoDeductStockForOrderMock.mockResolvedValue(undefined);

    await checkoutOrder("order-1", [{ method: "CASH", amount: 100 }], "user-1");

    expect(prismaMock.payment.create).toHaveBeenCalledWith({
      data: {
        orderId: "order-1",
        method: "CASH",
        amount: 100,
        reference: undefined,
        status: "COMPLETED",
        paidAt: expect.any(Date),
      },
    });
    expect(autoDeductStockForOrderMock).toHaveBeenCalledWith("order-1");
    expect(prismaMock.cashFlow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "INCOME",
        categoryId: "inc-sales",
        amount: 100,
        referenceId: "order-1",
        userId: "user-1",
      }),
    });
    expect(createPrintJobMock).toHaveBeenCalledWith({ orderId: "order-1", type: "BILL" });
    expect(revalidatePathMock).toHaveBeenCalledWith("/cash");
  });

  it("skips cash flow and inventory deduction for a COMP order", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      orderNumber: 9,
      orderNumberSuffix: null,
      type: "COMP",
      totalAmount: 0,
      table: { areaId: "area-1" },
      items: [],
      payments: [],
      karaokeSessions: [],
      user: null,
    });
    prismaMock.payment.create.mockResolvedValue({ id: "payment-1" });
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });
    isSystemModuleEnabledMock.mockResolvedValue(false);

    await checkoutOrder("order-1", [{ method: "CASH", amount: 0 }]);

    expect(autoDeductStockForOrderMock).not.toHaveBeenCalled();
    expect(prismaMock.cashFlow.create).not.toHaveBeenCalled();
  });

  it("recalculates VAT, excise tax and service charges from real items", async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: "p1", price: 100 });
    prismaMock.orderItem.create.mockResolvedValue({ id: "item-1" });
    // syncKaraokeTime bails (non-karaoke table)
    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order-1",
      status: "OPEN",
      table: { isKaraoke: false, area: { type: "RESTAURANT" } },
    });
    // recalc reads items
    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order-1",
      guestCount: 4,
      discountAmount: 10,
      table: { areaId: "area-1" },
      items: [
        {
          unitPrice: 100,
          quantity: 2,
          product: { vatId: "v1", vat: { rate: 0.1 }, exciseTaxId: "e1", exciseTax: { rate: 0.05 } },
          toppings: [{ price: 5 }],
        },
      ],
    });
    prismaMock.serviceCharge.findMany.mockResolvedValue([
      { type: "PERCENTAGE", value: 10, scope: "ALL", applyCondition: "ALL_DAYS" },
      { type: "PER_GUEST", value: 2, scope: "ALL", applyCondition: "GUEST_COUNT", minGuestCount: 2 },
      { type: "FIXED", value: 20, scope: "AREA", areaId: "area-1", applyCondition: "MIN_ORDER", minOrderValue: 0 },
      { type: "FIXED", value: 99, scope: "AREA", areaId: "other", applyCondition: "ALL_DAYS" },
      { type: "PERCENTAGE", value: 5, scope: "ALL", applyCondition: "HOLIDAY" },
      { type: "FIXED", value: 7, scope: "ALL", applyCondition: "DATE_RANGE", startDate: "2000-01-01", endDate: "2000-01-02" },
    ]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });

    await addItem("order-1", "p1", 2, [{ toppingId: "t1", price: 5 }]);

    const finalUpdate = prismaMock.order.update.mock.calls.at(-1)![0] as {
      data: { subtotal: number; vatAmount: number; exciseTaxAmount: number; serviceCharge: number; totalAmount: number };
    };
    // subtotal = 100*2 + topping 5*2 = 210
    expect(finalUpdate.data.subtotal).toBe(210);
    expect(finalUpdate.data.vatAmount).toBeCloseTo(20); // 100*2*0.1
    expect(finalUpdate.data.exciseTaxAmount).toBeCloseTo(10); // 100*2*0.05
    // service: 10% of 210 (21) + per-guest 2*4 (8) + fixed area 20 = 49
    expect(finalUpdate.data.serviceCharge).toBeCloseTo(49);
  });

  it("applies holiday, date-range and service-fee charges", async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: "p1", price: 50 });
    prismaMock.orderItem.create.mockResolvedValue({ id: "item-1" });
    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order-1",
      status: "OPEN",
      table: { isKaraoke: false, area: { type: "RESTAURANT" } },
    });
    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order-1",
      guestCount: 1,
      discountAmount: 0,
      table: { areaId: "area-1" },
      items: [
        { unitPrice: 50, quantity: 1, product: { vatId: "v1", vat: { rate: 0 }, exciseTaxId: null, exciseTax: null }, toppings: [] },
      ],
    });
    prismaMock.serviceCharge.findMany.mockResolvedValue([
      { type: "SERVICE_FEE", value: 10, scope: "ALL", applyCondition: "HOLIDAY" },
      { type: "FIXED", value: 3, scope: "ALL", applyCondition: "DATE_RANGE", startDate: "2000-01-01", endDate: "2999-01-01" },
    ]);
    prismaMock.holiday.findMany.mockResolvedValue([{ id: "h1" }]);
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });

    await addItem("order-1", "p1", 1);

    const finalUpdate = prismaMock.order.update.mock.calls.at(-1)![0] as {
      data: { serviceCharge: number };
    };
    // service fee 10% of 50 (5) + fixed in-range 3 = 8
    expect(finalUpdate.data.serviceCharge).toBeCloseTo(8);
  });

  it("opens a karaoke table and attaches karaoke pricing", async () => {
    prismaMock.order.findFirst.mockResolvedValueOnce(null); // no existing open order
    prismaMock.order.findFirst.mockResolvedValueOnce({ orderNumber: 5 }); // last order number
    prismaMock.table.findUnique.mockResolvedValue({
      id: "t1",
      isKaraoke: true,
      areaId: "a1",
      area: { type: "KARAOKE" },
    });
    prismaMock.order.create.mockResolvedValue({ id: "order-1" });
    prismaMock.karaokePricing.findFirst.mockResolvedValue({ id: "pricing-1" });
    // recalc/sync: bail early (table null) then empty recalc
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ status: "OPEN", table: null })
      .mockResolvedValueOnce({ guestCount: 1, discountAmount: 0, table: { areaId: "a1" }, items: [] });
    prismaMock.serviceCharge.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });

    await openTable("t1", 1);

    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "KARAOKE" }) }),
    );
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { karaokePricingId: "pricing-1" },
    });
  });

  it("syncs a karaoke time item when recalculating a karaoke order", async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: "p1", price: 30 });
    prismaMock.orderItem.create.mockResolvedValue({ id: "item-1" });
    // syncKaraokeTime: karaoke order, no pricing yet
    prismaMock.order.findUnique
      .mockResolvedValueOnce({
        status: "OPEN",
        karaokePricingId: null,
        openedAt: new Date(Date.now() - 3_600_000),
        table: { isKaraoke: true, areaId: "a1", area: { type: "KARAOKE" } },
      })
      .mockResolvedValueOnce({ guestCount: 1, discountAmount: 0, table: { areaId: "a1" }, items: [] });
    prismaMock.karaokePricing.findFirst.mockResolvedValue({ id: "pr1" });
    prismaMock.karaokePricing.findUnique.mockResolvedValue({
      id: "pr1",
      timeUnit: "HOUR",
      pricePerHour: 50,
      name: "Std",
      startTime: "00:00",
      endTime: "23:59",
    });
    prismaMock.category.upsert.mockResolvedValue({ id: "cat1" });
    prismaMock.unit.findFirst.mockResolvedValue({ id: "u1" });
    prismaMock.product.findFirst.mockResolvedValue(null); // time product not created yet
    prismaMock.vat.findFirst.mockResolvedValue({ id: "v1" });
    prismaMock.product.create.mockResolvedValue({ id: "timeprod" });
    prismaMock.orderItem.findFirst.mockResolvedValue(null);
    prismaMock.serviceCharge.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });

    await addItem("order-1", "p1", 1);

    // A karaoke time product + time line item were created.
    expect(prismaMock.product.create).toHaveBeenCalled();
    expect(prismaMock.orderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ productId: "timeprod" }) }),
    );
  });

  it("splits items evenly into a new order in the same area", async () => {
    prismaMock.order.findUnique.mockImplementation(async (a: unknown) => {
      const q = a as { include?: { items?: unknown; table?: { include?: { area?: boolean } } } };
      if (q.include?.table?.include?.area) return { status: "OPEN", table: null }; // sync bail
      if (q.include?.items) return { guestCount: 1, discountAmount: 0, table: { areaId: "a1" }, items: [] }; // recalc
      return { orderNumber: 3, type: "NORMAL", table: { areaId: "a1" } }; // originalOrder
    });
    prismaMock.table.findFirst.mockResolvedValue({ id: "t2" });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.create.mockResolvedValue({ id: "new-order" });
    prismaMock.orderItem.findUnique.mockImplementation(async (a: unknown) => {
      const id = (a as { where: { id: string } }).where.id;
      if (id === "multi") return { id: "multi", orderId: "order-1", quantity: 3, productId: "p1", unitPrice: 10 };
      if (id === "single") return { id: "single", orderId: "order-1", quantity: 1 };
      return { id: "foreign", orderId: "other" }; // skipped
    });
    prismaMock.orderItem.update.mockResolvedValue({});
    prismaMock.orderItem.create.mockResolvedValue({});
    prismaMock.serviceCharge.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.order.update.mockResolvedValue({});

    const result = await splitItemsEvenly("order-1", ["multi", "single", "foreign"]);

    expect(result).toEqual({ id: "new-order" });
    // multi-qty item splits: stay 2, move 1 → a create on the new order
    expect(prismaMock.orderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: "new-order", quantity: 1 }) }),
    );
  });

  it("keeps the source order open when items remain after a split", async () => {
    prismaMock.order.findUnique.mockImplementation(async (a: unknown) => {
      const q = a as { select?: { orderNumber?: boolean }; include?: { items?: unknown; table?: { include?: { area?: boolean } } } };
      if (q.select?.orderNumber) return { orderNumber: 4 };
      if (q.include?.table?.include?.area) return { status: "OPEN", table: null };
      return { guestCount: 1, discountAmount: 0, table: { areaId: "a1" }, items: [] };
    });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.create.mockResolvedValue({ id: "split-order" });
    prismaMock.orderItem.update.mockResolvedValue({});
    prismaMock.orderItem.findMany.mockResolvedValue([{ id: "leftover" }]); // items remain
    prismaMock.serviceCharge.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.order.update.mockResolvedValue({});

    await splitItems("order-1", ["item-1"], "table-2");

    // Source order must NOT be marked SPLIT/closed when items remain.
    const splitCloseCall = prismaMock.order.update.mock.calls.find(
      (c) => (c[0] as { data?: { status?: string } }).data?.status === "SPLIT",
    );
    expect(splitCloseCall).toBeUndefined();
  });

  it("logs but does not throw when the print job fails on send", async () => {
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.orderItem.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });
    createPrintJobMock.mockResolvedValue({ success: false, error: "printer offline" });

    await expect(sendOrder("order-1", "area-1")).resolves.toBeUndefined();
    expect(createPrintJobMock).toHaveBeenCalled();
  });

  it("updates an existing karaoke time item instead of creating a new one", async () => {
    prismaMock.product.findUnique.mockResolvedValue({ id: "p1", price: 30 });
    prismaMock.orderItem.create.mockResolvedValue({ id: "item-1" });
    prismaMock.order.findUnique
      .mockResolvedValueOnce({
        status: "SENT",
        karaokePricingId: "pr1", // pricing already attached
        openedAt: new Date(Date.now() - 7_200_000),
        table: { isKaraoke: true, areaId: "a1", area: { type: "KARAOKE" } },
      })
      .mockResolvedValueOnce({ guestCount: 1, discountAmount: 0, table: { areaId: "a1" }, items: [] });
    prismaMock.karaokePricing.findUnique.mockResolvedValue({
      id: "pr1", timeUnit: "MINUTE", pricePerHour: 1, name: "Std", startTime: "00:00", endTime: "23:59",
    });
    prismaMock.category.upsert.mockResolvedValue({ id: "cat1" });
    prismaMock.unit.findFirst.mockResolvedValue({ id: "u1" });
    prismaMock.product.findFirst.mockResolvedValue({ id: "timeprod" }); // product already exists
    prismaMock.orderItem.findFirst.mockResolvedValue({ id: "ktime-1" }); // existing time item
    prismaMock.serviceCharge.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });

    await addItem("order-1", "p1", 1);

    expect(prismaMock.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ktime-1" } }),
    );
    expect(prismaMock.product.create).not.toHaveBeenCalled();
  });

  it("throws when splitting evenly with no empty table available", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      orderNumber: 3,
      type: "NORMAL",
      table: { areaId: "a1" },
    });
    prismaMock.table.findFirst.mockResolvedValue(null);

    await expect(splitItemsEvenly("order-1", ["x"])).rejects.toThrow("No empty tables");
  });

  it("getActiveAreasWithTables delegates to getAreasWithTables", async () => {
    prismaMock.area.findMany.mockResolvedValue([{ id: "area-1" }]);

    await expect(getActiveAreasWithTables()).resolves.toEqual([{ id: "area-1" }]);
    expect(prismaMock.area.findMany).toHaveBeenCalledTimes(1);
  });

  it("refreshKaraokeTime recalculates order and revalidates path", async () => {
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ status: "OPEN", table: { isKaraoke: false, area: { type: "RESTAURANT" } } })
      .mockResolvedValueOnce({ guestCount: 1, discountAmount: 0, table: { areaId: "area-1" }, items: [] });
    prismaMock.serviceCharge.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.order.update.mockResolvedValue({ id: "order-1" });

    await refreshKaraokeTime("order-1");

    expect(prismaMock.order.update).toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/order");
  });

  it("getTempBill returns order detail", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ id: "order-1" });

    await expect(getTempBill("order-1")).resolves.toEqual({ id: "order-1" });
    expect(prismaMock.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1" } }),
    );
  });

  it("printTempBill sends a TEMP_BILL print job", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order-1",
      table: { areaId: "area-1" },
      items: [],
      payments: [],
      karaokeSessions: [],
      user: null,
    });
    createPrintJobMock.mockResolvedValue({ success: true, jobId: "print-2" });

    await printTempBill("order-1");

    expect(createPrintJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", type: "TEMP_BILL" }),
    );
  });

  it("printTempBill returns early when order not found", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await printTempBill("missing-order");

    expect(createPrintJobMock).not.toHaveBeenCalled();
  });

  it("cancelItem overrides note when explicit note is provided", async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue({ id: "item-1", note: "old note" });
    prismaMock.orderItem.update.mockResolvedValue({ id: "item-1", orderId: "order-1" });
    mockRecalcDependencies();

    await cancelItem("item-1", "user-1", "new note");

    expect(prismaMock.orderItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: {
        status: "CANCELLED",
        cancelledBy: "user-1",
        cancelledAt: expect.any(Date),
        note: "new note",
      },
    });
  });

  it("openTable creates a COMP order on a non-karaoke table", async () => {
    prismaMock.order.findFirst.mockResolvedValueOnce(null);
    prismaMock.order.findFirst.mockResolvedValueOnce({ orderNumber: 3 });
    prismaMock.table.findUnique.mockResolvedValue({ id: "t1", isKaraoke: false, areaId: "a1", area: { type: "RESTAURANT" } });
    prismaMock.order.create.mockResolvedValue({ id: "order-comp" });
    prismaMock.order.findUnique
      .mockResolvedValueOnce({ status: "OPEN", table: { isKaraoke: false, area: { type: "RESTAURANT" } } })
      .mockResolvedValueOnce({ guestCount: 1, discountAmount: 0, table: { areaId: "a1" }, items: [] });
    prismaMock.serviceCharge.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.order.update.mockResolvedValue({ id: "order-comp" });

    await openTable("t1", 1, "COMP");

    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "COMP" }) }),
    );
  });

  it("checkoutOrder throws when order is not found", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(checkoutOrder("missing", [{ method: "CASH", amount: 0 }])).rejects.toThrow("Order not found");
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });
});
