import { describe, expect, it } from "vitest";

import { prismaMock } from "@/test/prisma-mock";
import {
  getIngredientReport,
  getInvoiceReport,
  getRevenueReport,
  getSoldItemsReport,
  getWarehouseReport,
} from "./actions";
import {
  exportIngredientsToExcel,
  exportInvoicesToExcel,
  exportRevenueToExcel,
  exportSoldItemsToExcel,
  exportWarehouseToExcel,
} from "./excel";
import { getPrintJobs, getPrintJobStats } from "./print-actions";

describe("report server actions", () => {
  it("maps invoice report rows and summary totals", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "order-1",
        orderNumber: 7,
        orderNumberSuffix: "1",
        table: { name: "T1" },
        guestCount: 2,
        type: "NORMAL",
        subtotal: 80,
        vatAmount: 8,
        exciseTaxAmount: 2,
        discountAmount: 5,
        serviceCharge: 15,
        totalAmount: 100,
        payments: [{ method: "CASH", amount: 100 }],
        user: { name: "Admin" },
        items: [{ product: { name: "Coffee" }, quantity: 2, unitPrice: 40 }],
        openedAt: new Date("2026-06-16T10:00:00.000Z"),
        closedAt: new Date("2026-06-16T11:00:00.000Z"),
      },
    ]);

    await expect(getInvoiceReport("day", "2026-06-16")).resolves.toMatchObject({
      orders: [
        {
          id: "order-1",
          orderNumber: 7,
          table: "T1",
          paymentMethods: "CASH: 100",
          staff: "Admin",
          items: "Coffee x2",
        },
      ],
      summary: {
        totalOrders: 1,
        totalRevenue: 100,
        totalVat: 8,
        totalDiscount: 5,
      },
    });
  });

  it("groups sold items by product including toppings revenue", async () => {
    prismaMock.orderItem.findMany.mockResolvedValue([
      {
        productId: "product-1",
        product: { name: "Coffee", category: { name: "Drinks" } },
        quantity: 2,
        unitPrice: 20,
        toppings: [{ price: 3, topping: { name: "Milk" } }],
        order: {
          orderNumber: 5,
          orderNumberSuffix: null,
          closedAt: new Date("2026-06-16T11:00:00.000Z"),
          table: { name: "T1" },
        },
      },
    ]);

    await expect(getSoldItemsReport("day", "2026-06-16")).resolves.toMatchObject({
      items: [
        {
          productName: "Coffee",
          toppings: "Milk",
          totalAmount: 46,
          orderNumber: "5",
        },
      ],
      byProduct: [{ name: "Coffee", category: "Drinks", quantity: 2, revenue: 46 }],
      summary: { totalItems: 1, totalQuantity: 2, totalRevenue: 46 },
    });
  });

  it("builds revenue report grouped by day and cash flow category", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        closedAt: new Date("2026-06-16T11:00:00.000Z"),
        subtotal: 80,
        vatAmount: 8,
        exciseTaxAmount: 2,
        discountAmount: 0,
        serviceCharge: 10,
        totalAmount: 100,
        type: "NORMAL",
        payments: [{ method: "CASH", amount: 100 }],
      },
      {
        closedAt: new Date("2026-06-16T12:00:00.000Z"),
        subtotal: 50,
        vatAmount: 5,
        exciseTaxAmount: 0,
        discountAmount: 0,
        serviceCharge: 0,
        totalAmount: 55,
        type: "COMP",
        payments: [{ method: "CARD", amount: 55 }],
      },
    ]);
    prismaMock.cashFlow.findMany.mockResolvedValue([
      { type: "EXPENSE", amount: 20, category: { name: "Stock" } },
      { type: "INCOME", amount: 5, category: { name: "Other" } },
    ]);

    await expect(getRevenueReport("day", "2026-06-16")).resolves.toMatchObject({
      days: [
        {
          date: "2026-06-16",
          orders: 2,
          revenue: 155,
          normalCount: 1,
          compCount: 1,
          payments: { CASH: 100, CARD: 55 },
        },
      ],
      summary: {
        totalOrders: 2,
        totalRevenue: 155,
        totalExpenses: 20,
        totalOtherIncome: 5,
        profit: -15,
        byPaymentMethod: { CASH: 100, CARD: 55 },
      },
      expensesByCategory: { Stock: 20 },
      incomeByCategory: { Other: 5 },
    });
  });

  it("summarizes ingredient and warehouse reports", async () => {
    prismaMock.stockIn.findMany.mockResolvedValue([
      { totalAmount: 100, supplier: "Supplier A", items: [{ id: "item-1" }] },
    ]);
    prismaMock.stockOut.findMany.mockResolvedValue([
      { quantity: 3, totalCost: 30, reason: "WASTE" },
    ]);
    prismaMock.ingredient.findMany.mockResolvedValueOnce([{ id: "ingredient-1" }]);

    await expect(getIngredientReport("day", "2026-06-16")).resolves.toMatchObject({
      stockInSummary: {
        totalStockIns: 1,
        totalAmount: 100,
        totalItems: 1,
        bySupplier: { "Supplier A": 100 },
      },
      stockOutSummary: {
        totalStockOuts: 1,
        totalQuantity: 3,
        totalCost: 30,
        byReason: { WASTE: 3 },
      },
    });

    prismaMock.ingredient.findMany.mockResolvedValueOnce([
      { id: "ingredient-1", currentStock: 2, minStock: 5 },
      { id: "ingredient-2", currentStock: 0, minStock: 1 },
    ]);
    prismaMock.inventoryBatch.findMany.mockResolvedValue([
      { remainingQuantity: 2, unitCost: 5 },
      { remainingQuantity: 3, unitCost: 4 },
    ]);
    prismaMock.product.count.mockResolvedValue(4);
    prismaMock.category.count.mockResolvedValue(2);
    prismaMock.supplier.count.mockResolvedValue(1);

    await expect(getWarehouseReport()).resolves.toMatchObject({
      summary: {
        totalIngredients: 2,
        totalStockValue: 22,
        totalProducts: 4,
        totalCategories: 2,
        totalSuppliers: 1,
        lowStockCount: 2,
        outOfStockCount: 1,
      },
    });
  });

  it("queries print jobs with filters and summarizes print stats", async () => {
    prismaMock.printJob.findMany.mockResolvedValue([{ id: "print-job-1" }]);
    await expect(getPrintJobs("2026-06-16", "BILL")).resolves.toEqual([{ id: "print-job-1" }]);
    expect(prismaMock.printJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "BILL" }),
        take: 200,
      }),
    );

    prismaMock.printJob.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(6);

    await expect(getPrintJobStats()).resolves.toEqual({
      orderCount: 3,
      billCount: 2,
      failedCount: 1,
      totalToday: 6,
    });
  });

  it("exports invoice and warehouse reports to non-empty Excel buffers", async () => {
    const invoicesBuffer = await exportInvoicesToExcel(
      [
        {
          orderNumber: 1,
          orderNumberSuffix: null,
          table: "T1",
          guestCount: 2,
          type: "NORMAL",
          staff: "Admin",
          subtotal: 80,
          vatAmount: 8,
          exciseTaxAmount: 2,
          discountAmount: 0,
          serviceCharge: 10,
          totalAmount: 100,
          paymentMethods: "CASH: 100",
          items: "Coffee x2",
          closedAt: "2026-06-16T11:00:00.000Z",
        },
      ],
      {
        totalOrders: 1,
        totalRevenue: 100,
        totalSubtotal: 80,
        totalVat: 8,
        totalExciseTax: 2,
        totalDiscount: 0,
        totalServiceCharge: 10,
      },
      "2026-06-16",
      "2026-06-16",
    );

    const warehouseBuffer = await exportWarehouseToExcel(
      [{ name: "Rice", currentStock: 2, baseUnit: "kg", minStock: 5, costPerBaseUnit: 10 }],
      {
        totalIngredients: 1,
        totalStockValue: 20,
        totalProducts: 1,
        totalCategories: 1,
        totalSuppliers: 1,
        lowStockCount: 1,
        outOfStockCount: 0,
      },
      [{ name: "Rice", currentStock: 2, minStock: 5, baseUnit: "kg" }],
      [],
      [{ batchCode: "B1", ingredient: { name: "Rice", baseUnit: "kg" }, receivedAt: "2026-06-16T10:00:00.000Z", remainingQuantity: 2, unitCost: 10 }],
    );

    expect(invoicesBuffer.byteLength).toBeGreaterThan(0);
    expect(warehouseBuffer.byteLength).toBeGreaterThan(0);
  });

  it("exports sold items, revenue and ingredient reports to non-empty Excel buffers", async () => {
    const soldItemsBuffer = await exportSoldItemsToExcel(
      [
        {
          productName: "Coffee",
          category: "Drinks",
          quantity: 2,
          unitPrice: 20,
          toppings: "Milk",
          totalAmount: 46,
          orderNumber: "1",
          table: "T1",
          closedAt: "2026-06-16T11:00:00.000Z",
        },
      ],
      [{ name: "Coffee", category: "Drinks", quantity: 2, revenue: 46 }],
      { totalItems: 1, totalQuantity: 2, totalRevenue: 46 },
      "2026-06-16",
      "2026-06-16",
    );

    const revenueBuffer = await exportRevenueToExcel(
      [{ date: "2026-06-16", orders: 1, subtotal: 80, vat: 8, excise: 2, discount: 0, service: 10, revenue: 100 }],
      {
        totalOrders: 1,
        totalRevenue: 100,
        totalSubtotal: 80,
        totalVat: 8,
        totalExciseTax: 2,
        totalDiscount: 0,
        totalServiceCharge: 10,
        totalExpenses: 20,
        totalOtherIncome: 5,
        profit: -15,
        byPaymentMethod: { CASH: 100 },
      },
      { Stock: 20 },
      { Other: 5 },
      "2026-06-16",
      "2026-06-16",
    );

    const ingredientsBuffer = await exportIngredientsToExcel(
      [{ code: "SI-1", supplier: "Supplier", totalAmount: 100, createdAt: "2026-06-16T10:00:00.000Z", items: [] }],
      [{ ingredient: { name: "Rice" }, quantity: 2, totalCost: 20, reason: "WASTE", createdAt: "2026-06-16T10:00:00.000Z" }],
      { totalStockIns: 1, totalAmount: 100, totalItems: 0, bySupplier: { Supplier: 100 } },
      { totalStockOuts: 1, totalQuantity: 2, totalCost: 20 },
      [{ name: "Rice", currentStock: 2, baseUnit: "kg", minStock: 5, costPerBaseUnit: 10 }],
      "2026-06-16",
      "2026-06-16",
    );

    expect(soldItemsBuffer.byteLength).toBeGreaterThan(0);
    expect(revenueBuffer.byteLength).toBeGreaterThan(0);
    expect(ingredientsBuffer.byteLength).toBeGreaterThan(0);
  });

  it.each(["week", "month", "year"] as const)(
    "computes the %s date range for the revenue report",
    async (mode) => {
      prismaMock.order.findMany.mockResolvedValue([]);
      prismaMock.cashFlow.findMany.mockResolvedValue([]);
      await expect(getRevenueReport(mode, "2026-06-16")).resolves.toMatchObject({
        summary: { totalOrders: 0 },
      });
    },
  );

  it("computes a custom date range and falls back to now when no date is given", async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    await expect(
      getInvoiceReport("custom", undefined, "2026-06-01", "2026-06-16"),
    ).resolves.toMatchObject({ summary: { totalOrders: 0 } });

    prismaMock.orderItem.findMany.mockResolvedValue([]);
    await expect(getSoldItemsReport("month")).resolves.toMatchObject({
      summary: { totalItems: 0 },
    });
  });

  it("exports invoices/revenue covering complimentary, suffix and empty-section branches", async () => {
    const invoicesBuffer = await exportInvoicesToExcel(
      [
        {
          orderNumber: 2,
          orderNumberSuffix: "1", // suffix branch
          table: "T2",
          guestCount: 1,
          type: "COMP", // complimentary branch
          staff: "Staff",
          subtotal: 50,
          vatAmount: 0,
          exciseTaxAmount: 0,
          discountAmount: 0,
          serviceCharge: 0,
          totalAmount: 50,
          paymentMethods: "CARD",
          items: "Tea x1",
          closedAt: null, // falsy closedAt branch
        },
      ],
      {
        totalOrders: 1, totalRevenue: 50, totalSubtotal: 50, totalVat: 0,
        totalExciseTax: 0, totalDiscount: 0, totalServiceCharge: 0,
      },
      "2026-06-16",
      "2026-06-16",
    );

    // Empty payment-method and expense sections (false branches).
    const revenueBuffer = await exportRevenueToExcel(
      [{ date: "2026-06-16", orders: 0, subtotal: 0, vat: 0, excise: 0, discount: 0, service: 0, revenue: 0, normalCount: 0, compCount: 0 }],
      {
        totalOrders: 0, totalRevenue: 0, totalSubtotal: 0, totalVat: 0, totalExciseTax: 0,
        totalDiscount: 0, totalServiceCharge: 0, totalExpenses: 0, totalOtherIncome: 0,
        profit: 0, byPaymentMethod: {},
      },
      {},
      {},
      "2026-06-16",
      "2026-06-16",
    );

    expect(invoicesBuffer.byteLength).toBeGreaterThan(0);
    expect(revenueBuffer.byteLength).toBeGreaterThan(0);
  });

  it("exports ingredients/warehouse covering multi-item, out-of-stock and fallback branches", async () => {
    const ingredientsBuffer = await exportIngredientsToExcel(
      [
        // Stock-in with multiple items → idx>0 branches; supplier/user null fallbacks.
        {
          code: "SI-2",
          supplier: null,
          user: null,
          createdAt: "2026-06-16T10:00:00.000Z",
          items: [
            { ingredient: { name: "Rice" }, quantity: 5, unitPrice: 2, totalPrice: 10 },
            { ingredient: { name: "Salt" }, quantity: 1, unitPrice: 1, totalPrice: 1 },
          ],
        },
        // Stock-in with no items → "(no items)" branch.
        { code: "SI-3", supplier: "S", user: { name: "U" }, createdAt: "2026-06-16T10:00:00.000Z", items: [] },
      ],
      [
        // Stock-out with FIFO batch layers + null fallbacks.
        {
          createdAt: "2026-06-16T10:00:00.000Z",
          ingredient: null,
          quantity: 2,
          reason: "WASTE",
          totalCost: null,
          batches: [{ quantity: 2, unitCost: 5, batch: { batchCode: "B1" } }],
          user: null,
          note: null,
        },
      ],
      { totalStockIns: 2, totalAmount: 11, totalItems: 2, bySupplier: {} },
      { totalStockOuts: 1, totalQuantity: 2, totalCost: 0 },
      [{ name: "Rice", purchaseUnit: "bag", baseUnit: "kg", conversionFactor: 10, currentStock: 2, minStock: 5, costPerBaseUnit: 10, recipes: [] }],
      "2026-06-16",
      "2026-06-16",
    );

    // lowStock empty, outOfStock present, batches empty.
    const warehouseBuffer = await exportWarehouseToExcel(
      [{ name: "Rice", purchaseUnit: "bag", baseUnit: "kg", conversionFactor: 10, currentStock: 0, minStock: 5, costPerBaseUnit: 10, recipes: [{ product: { name: "Pho" } }], supplier: "S" }],
      {
        totalIngredients: 1, totalStockValue: 0, totalProducts: 1, totalCategories: 1,
        totalSuppliers: 1, lowStockCount: 0, outOfStockCount: 1,
      },
      [], // no low stock
      [{ name: "Rice", currentStock: 0, minStock: 5, baseUnit: "kg", supplier: null }],
      [], // no batches
    );

    expect(ingredientsBuffer.byteLength).toBeGreaterThan(0);
    expect(warehouseBuffer.byteLength).toBeGreaterThan(0);
  });
});
