import { describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";

import { prismaMock } from "@/test/prisma-mock";
import { consumeFifoStock, createBatchForStockInItem } from "./fifo";
import {
  closeCashRegister,
  createCashFlow,
  createPettyTransaction,
  createStockIn,
  createStockOut,
  getCashFlowCategories,
  getCashRegisters,
  getCashFlow,
  getIngredientRecipes,
  getInventoryStatus,
  getLowStockIngredients,
  getPettyTransactions,
  getStockIns,
  getStockOuts,
  getDailyReport,
  getTopProducts,
  openCashRegister,
} from "./actions";
import {
  createSupplier,
  deleteSupplier,
  getLastStockInBySupplier,
  updateSupplier,
} from "./supplier-actions";

vi.mock("./fifo", () => ({
  consumeFifoStock: vi.fn(),
  createBatchForStockInItem: vi.fn(),
}));

const revalidatePathMock = vi.mocked(revalidatePath);
const consumeFifoStockMock = vi.mocked(consumeFifoStock);
const createBatchForStockInItemMock = vi.mocked(createBatchForStockInItem);

function mockTransaction() {
  const tx = {
    stockIn: { create: vi.fn() },
    stockInIngredient: { create: vi.fn() },
    stockOut: { create: vi.fn() },
    ingredient: { update: vi.fn() },
  };
  prismaMock.$transaction.mockImplementation(async (callback: (arg: typeof tx) => Promise<unknown>) => callback(tx));
  return tx;
}

describe("inventory server actions", () => {
  it("queries inventory and cash collections with expected delegates", async () => {
    prismaMock.stockIn.findMany.mockResolvedValue([]);
    prismaMock.stockOut.findMany.mockResolvedValue([]);
    prismaMock.ingredient.findMany.mockResolvedValue([]);
    prismaMock.ingredientRecipe.findMany.mockResolvedValue([]);
    prismaMock.cashRegister.findMany.mockResolvedValue([]);
    prismaMock.pettyTransaction.findMany.mockResolvedValue([]);
    prismaMock.cashFlowCategory.findMany.mockResolvedValue([]);

    await expect(getStockIns()).resolves.toEqual([]);
    await expect(getStockOuts()).resolves.toEqual([]);
    await expect(getInventoryStatus()).resolves.toEqual([]);
    await expect(getLowStockIngredients()).resolves.toEqual([]);
    await expect(getIngredientRecipes("ingredient-1")).resolves.toEqual([]);
    await expect(getCashRegisters()).resolves.toEqual([]);
    await expect(getPettyTransactions("register-1")).resolves.toEqual([]);
    await expect(getCashFlowCategories()).resolves.toEqual([]);

    expect(prismaMock.ingredientRecipe.findMany).toHaveBeenCalledWith({
      where: { ingredientId: "ingredient-1" },
      include: { product: true, unit: true },
    });
  });

  it("creates stock-in records, batches, ingredient updates and cash flow", async () => {
    vi.setSystemTime(new Date("2026-06-16T10:00:00.000Z"));
    const tx = mockTransaction();
    prismaMock.stockIn.count.mockResolvedValue(1);
    prismaMock.supplier.findUnique.mockResolvedValue({ name: "Supplier A" });
    tx.stockIn.create.mockResolvedValue({
      id: "stock-in-1",
      createdAt: new Date("2026-06-16T10:00:00.000Z"),
    });
    tx.stockInIngredient.create.mockResolvedValue({ id: "stock-in-item-1" });
    prismaMock.cashFlow.create.mockResolvedValue({ id: "cash-flow-1" });

    await expect(
      createStockIn({
        supplierId: "supplier-1",
        userId: "user-1",
        items: [
          { ingredientId: "ingredient-1", quantity: 2, unitPrice: 10 },
          { ingredientId: "", quantity: 3, unitPrice: 10 },
        ],
      }),
    ).resolves.toEqual({ id: "stock-in-1", createdAt: new Date("2026-06-16T10:00:00.000Z") });

    expect(tx.stockIn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "PN-20260616-002",
        supplier: "Supplier A",
        supplierId: "supplier-1",
        userId: "user-1",
        totalAmount: 20,
      }),
    });
    expect(createBatchForStockInItemMock).toHaveBeenCalledWith(tx, {
      ingredientId: "ingredient-1",
      stockInItemId: "stock-in-item-1",
      stockInCode: "PN-20260616-002",
      quantity: 2,
      unitCost: 10,
      receivedAt: new Date("2026-06-16T10:00:00.000Z"),
    });
    expect(prismaMock.cashFlow.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "EXPENSE",
        categoryId: "expense-stock",
        amount: 20,
        referenceId: "stock-in-1",
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/inventory");
  });

  it("creates stock-out through FIFO and decrements ingredient stock", async () => {
    const tx = mockTransaction();
    tx.stockOut.create.mockResolvedValue({ id: "stock-out-1" });

    await expect(
      createStockOut({
        ingredientId: "ingredient-1",
        quantity: 3,
        reason: "WASTE",
        userId: "user-1",
      }),
    ).resolves.toEqual({ id: "stock-out-1" });

    expect(consumeFifoStockMock).toHaveBeenCalledWith(tx, {
      stockOutId: "stock-out-1",
      ingredientId: "ingredient-1",
      quantity: 3,
    });
    expect(tx.ingredient.update).toHaveBeenCalledWith({
      where: { id: "ingredient-1" },
      data: { currentStock: { decrement: 3 } },
    });
  });

  it("closes cash register with computed expected balance and discrepancy", async () => {
    prismaMock.cashRegister.findUnique.mockResolvedValue({
      id: "register-1",
      openingBalance: 100,
      transactions: [
        { type: "INCOME", amount: 40 },
        { type: "EXPENSE", amount: 15 },
      ],
    });
    prismaMock.cashRegister.update.mockResolvedValue({ id: "register-1" });

    await closeCashRegister("register-1", { closingBalance: 150, closedBy: "user-1" });

    expect(prismaMock.cashRegister.update).toHaveBeenCalledWith({
      where: { id: "register-1" },
      data: expect.objectContaining({
        closingBalance: 150,
        expectedBalance: 125,
        discrepancy: 25,
        closedBy: "user-1",
        status: "CLOSED",
      }),
    });
  });

  it("opens cash register and creates petty transactions", async () => {
    prismaMock.cashRegister.create.mockResolvedValue({ id: "register-1" });

    await expect(
      openCashRegister({ openingBalance: 100, userId: "user-1", shiftId: "shift-1" }),
    ).resolves.toEqual({ id: "register-1" });
    await createPettyTransaction({
      cashRegisterId: "register-1",
      type: "EXPENSE",
      category: "Supplies",
      amount: 20,
      userId: "user-1",
    });

    expect(prismaMock.cashRegister.create).toHaveBeenCalledWith({
      data: {
        openingBalance: 100,
        userId: "user-1",
        shiftId: "shift-1",
        status: "OPEN",
      },
    });
    expect(prismaMock.pettyTransaction.create).toHaveBeenCalledWith({
      data: {
        cashRegisterId: "register-1",
        type: "EXPENSE",
        category: "Supplies",
        amount: 20,
        userId: "user-1",
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/cash");
  });

  it("throws when closing an unknown cash register", async () => {
    prismaMock.cashRegister.findUnique.mockResolvedValue(null);

    await expect(
      closeCashRegister("missing-register", { closingBalance: 0, closedBy: "user-1" }),
    ).rejects.toThrow("Cash register not found");
  });

  it("filters cash flow by day only when date is provided", async () => {
    prismaMock.cashFlow.findMany.mockResolvedValue([]);
    const start = new Date("2026-06-16");
    start.setHours(0, 0, 0, 0);
    const end = new Date("2026-06-16");
    end.setHours(23, 59, 59, 999);

    await getCashFlow("2026-06-16");
    expect(prismaMock.cashFlow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
    );

    await createCashFlow({
      type: "INCOME",
      categoryId: "cat-1",
      amount: 10,
      userId: "user-1",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/cash");
  });

  it("summarizes daily report and top products", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      { subtotal: 80, vatAmount: 8, exciseTaxAmount: 2, totalAmount: 100, discountAmount: 0 },
    ]);
    prismaMock.payment.findMany.mockResolvedValue([
      { method: "CASH", amount: 70 },
      { method: "CARD", amount: 30 },
    ]);
    prismaMock.cashFlow.findMany
      .mockResolvedValueOnce([{ amount: 20, category: { name: "Stock" } }])
      .mockResolvedValueOnce([{ amount: 5, category: { name: "Other" } }]);

    await expect(getDailyReport("2026-06-16")).resolves.toMatchObject({
      orders: 1,
      revenue: 100,
      totalIncome: 5,
      totalExpense: 20,
      profit: -15,
      paymentMethods: { CASH: 70, CARD: 30 },
      expensesByCategory: { Stock: 20 },
    });

    prismaMock.orderItem.findMany.mockResolvedValue([
      { productId: "p1", product: { name: "Coffee" }, quantity: 2, unitPrice: 10 },
      { productId: "p1", product: { name: "Coffee" }, quantity: 1, unitPrice: 10 },
      { productId: "p2", product: { name: "Tea" }, quantity: 1, unitPrice: 50 },
    ]);

    await expect(getTopProducts("2026-06-16")).resolves.toEqual([
      { name: "Tea", quantity: 1, revenue: 50 },
      { name: "Coffee", quantity: 3, revenue: 30 },
    ]);
  });
});

describe("supplier server actions", () => {
  it("creates, updates and deletes suppliers with settings and inventory revalidation", async () => {
    prismaMock.supplier.create.mockResolvedValue({ id: "supplier-1" });
    prismaMock.supplier.update.mockResolvedValue({ id: "supplier-1", name: "Updated" });

    await expect(createSupplier({ name: "Supplier A" })).resolves.toEqual({ id: "supplier-1" });
    await expect(updateSupplier("supplier-1", { name: "Updated" })).resolves.toEqual({
      id: "supplier-1",
      name: "Updated",
    });
    await deleteSupplier("supplier-1");

    expect(prismaMock.supplier.delete).toHaveBeenCalledWith({ where: { id: "supplier-1" } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings");
    expect(revalidatePathMock).toHaveBeenCalledWith("/inventory");
  });

  it("returns unique last stock-in ingredients by supplier", async () => {
    prismaMock.stockIn.findFirst.mockResolvedValue({
      items: [
        {
          ingredientId: "ingredient-1",
          unitPrice: 10,
          ingredient: {
            name: "Rice",
            purchaseUnit: "kg",
            baseUnit: "g",
            purchasePrice: 9,
          },
        },
        {
          ingredientId: "ingredient-1",
          unitPrice: 12,
          ingredient: {
            name: "Rice",
            purchaseUnit: "kg",
            baseUnit: "g",
            purchasePrice: 9,
          },
        },
      ],
    });

    await expect(getLastStockInBySupplier("supplier-1")).resolves.toEqual([
      {
        ingredientId: "ingredient-1",
        ingredientName: "Rice",
        purchaseUnit: "kg",
        baseUnit: "g",
        unitPrice: 10,
      },
    ]);
  });
});
