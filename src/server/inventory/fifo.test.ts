import { beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";
import {
  consumeFifoStock,
  createBatchForStockInItem,
  createOpeningBatchesForExistingStock,
  getInventoryBatches,
} from "./fifo";

type Tx = Parameters<typeof consumeFifoStock>[0];

function makeTx() {
  return {
    ingredient: {
      findUnique: vi.fn(),
    },
    inventoryBatch: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    stockOut: {
      update: vi.fn(),
    },
    stockOutBatch: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}

describe("inventory FIFO helpers", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  it("creates opening batches only for stocked ingredients without batches", async () => {
    prismaMock.ingredient.findMany.mockResolvedValue([
      {
        id: "ingredient-1",
        currentStock: 5,
        costPerBaseUnit: 2,
        purchasePrice: 3,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        batches: [],
      },
      {
        id: "ingredient-2",
        currentStock: 7,
        costPerBaseUnit: 0,
        purchasePrice: 4,
        createdAt: new Date("2025-02-01T00:00:00.000Z"),
        batches: [{ id: "existing" }],
      },
    ]);

    await expect(createOpeningBatchesForExistingStock()).resolves.toEqual({ created: 1 });
    expect(prismaMock.inventoryBatch.create).toHaveBeenCalledWith({
      data: {
        ingredientId: "ingredient-1",
        batchCode: "OPENING",
        receivedAt: new Date("2025-01-01T00:00:00.000Z"),
        quantityIn: 5,
        remainingQuantity: 5,
        unitCost: 2,
        status: "OPEN",
      },
    });
  });

  it("creates a stock-in batch and offsets negative stock", async () => {
    const tx = makeTx();
    tx.inventoryBatch.create.mockResolvedValueOnce({ id: "batch-new" });
    tx.inventoryBatch.findMany.mockResolvedValueOnce([
      {
        id: "negative-1",
        remainingQuantity: -3,
      },
    ]);

    await createBatchForStockInItem(tx as unknown as Tx, {
      ingredientId: "ingredient-1",
      stockInItemId: "stock-in-item-1",
      stockInCode: "SI-001",
      quantity: 10,
      unitCost: 8,
      receivedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(tx.inventoryBatch.update).toHaveBeenNthCalledWith(1, {
      where: { id: "negative-1" },
      data: {
        remainingQuantity: { increment: 3 },
        status: "CLOSED",
      },
    });
    expect(tx.stockOutBatch.updateMany).toHaveBeenCalledWith({
      where: { negativeBatchId: "negative-1", batchId: "negative-1" },
      data: { batchId: "batch-new", unitCost: 8, totalCost: 24 },
    });
    expect(tx.inventoryBatch.update).toHaveBeenNthCalledWith(2, {
      where: { id: "batch-new" },
      data: {
        remainingQuantity: 7,
        status: "OPEN",
      },
    });
  });

  it("keeps a stock-in batch unchanged when there are no negative batches", async () => {
    const tx = makeTx();
    tx.inventoryBatch.create.mockResolvedValueOnce({ id: "batch-new" });
    tx.inventoryBatch.findMany.mockResolvedValueOnce([]);

    await expect(
      createBatchForStockInItem(tx as unknown as Tx, {
        ingredientId: "ingredient-1",
        stockInItemId: "stock-in-item-1",
        stockInCode: "SI-002",
        quantity: 0,
        unitCost: 8,
      }),
    ).resolves.toEqual({ id: "batch-new" });

    expect(tx.inventoryBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantityIn: 0,
        remainingQuantity: 0,
        status: "CLOSED",
      }),
    });
    expect(tx.inventoryBatch.update).not.toHaveBeenCalled();
  });

  it("partially offsets negative stock and closes the new batch when fully allocated", async () => {
    const tx = makeTx();
    tx.inventoryBatch.create.mockResolvedValueOnce({ id: "batch-new" });
    tx.inventoryBatch.findMany.mockResolvedValueOnce([
      {
        id: "negative-1",
        remainingQuantity: -10,
      },
    ]);

    await createBatchForStockInItem(tx as unknown as Tx, {
      ingredientId: "ingredient-1",
      stockInItemId: "stock-in-item-1",
      stockInCode: "SI-003",
      quantity: 4,
      unitCost: 8,
    });

    expect(tx.inventoryBatch.update).toHaveBeenNthCalledWith(1, {
      where: { id: "negative-1" },
      data: {
        remainingQuantity: { increment: 4 },
        status: "NEGATIVE",
      },
    });
    expect(tx.inventoryBatch.update).toHaveBeenNthCalledWith(2, {
      where: { id: "batch-new" },
      data: {
        remainingQuantity: 0,
        status: "CLOSED",
      },
    });
  });

  it("consumes stock in FIFO order and closes depleted batches", async () => {
    const tx = makeTx();
    tx.inventoryBatch.findMany.mockResolvedValueOnce([
      { id: "batch-1", remainingQuantity: 4, unitCost: 2 },
      { id: "batch-2", remainingQuantity: 10, unitCost: 3 },
    ]);

    await expect(
      consumeFifoStock(tx as unknown as Tx, {
        stockOutId: "stock-out-1",
        ingredientId: "ingredient-1",
        quantity: 6,
      }),
    ).resolves.toEqual({ totalCost: 14 });

    expect(tx.stockOutBatch.create).toHaveBeenNthCalledWith(1, {
      data: {
        stockOutId: "stock-out-1",
        batchId: "batch-1",
        quantity: 4,
        unitCost: 2,
        totalCost: 8,
      },
    });
    expect(tx.inventoryBatch.update).toHaveBeenNthCalledWith(1, {
      where: { id: "batch-1" },
      data: {
        remainingQuantity: { decrement: 4 },
        status: "CLOSED",
      },
    });
    expect(tx.inventoryBatch.update).toHaveBeenNthCalledWith(2, {
      where: { id: "batch-2" },
      data: {
        remainingQuantity: { decrement: 2 },
        status: "OPEN",
      },
    });
    expect(tx.stockOut.update).toHaveBeenCalledWith({
      where: { id: "stock-out-1" },
      data: { totalCost: 14 },
    });
  });

  it("creates a negative batch when stock is insufficient", async () => {
    const tx = makeTx();
    tx.inventoryBatch.findMany.mockResolvedValueOnce([]);
    tx.ingredient.findUnique.mockResolvedValueOnce({
      costPerBaseUnit: 0,
      purchasePrice: 5,
    });
    tx.inventoryBatch.create.mockResolvedValueOnce({ id: "negative-batch" });

    await expect(
      consumeFifoStock(tx as unknown as Tx, {
        stockOutId: "stock-out-1",
        ingredientId: "ingredient-1",
        quantity: 3,
      }),
    ).resolves.toEqual({ totalCost: 15 });

    expect(tx.inventoryBatch.create).toHaveBeenCalledWith({
      data: {
        ingredientId: "ingredient-1",
        batchCode: "NEGATIVE",
        receivedAt: new Date("2026-01-01T00:00:00.000Z"),
        quantityIn: 0,
        remainingQuantity: -3,
        unitCost: 5,
        status: "NEGATIVE",
      },
    });
    expect(tx.stockOutBatch.create).toHaveBeenCalledWith({
      data: {
        stockOutId: "stock-out-1",
        batchId: "negative-batch",
        negativeBatchId: "negative-batch",
        quantity: 3,
        unitCost: 5,
        totalCost: 15,
      },
    });
  });

  it("uses zero fallback cost when ingredient cost is unavailable", async () => {
    const tx = makeTx();
    tx.inventoryBatch.findMany.mockResolvedValueOnce([]);
    tx.ingredient.findUnique.mockResolvedValueOnce(null);
    tx.inventoryBatch.create.mockResolvedValueOnce({ id: "negative-batch" });

    await expect(
      consumeFifoStock(tx as unknown as Tx, {
        stockOutId: "stock-out-1",
        ingredientId: "ingredient-1",
        quantity: 2,
      }),
    ).resolves.toEqual({ totalCost: 0 });

    expect(tx.stockOutBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 2,
        unitCost: 0,
        totalCost: 0,
      }),
    });
  });

  it("queries inventory batches with expected relations and ordering", async () => {
    prismaMock.inventoryBatch.findMany.mockResolvedValue([]);

    await expect(getInventoryBatches()).resolves.toEqual([]);
    expect(prismaMock.inventoryBatch.findMany).toHaveBeenCalledWith({
      include: {
        ingredient: { select: { name: true, baseUnit: true } },
        stockInItem: {
          include: {
            stockIn: { select: { code: true, supplier: true, createdAt: true } },
          },
        },
      },
      orderBy: [
        { ingredient: { name: "asc" } },
        { remainingQuantity: "desc" },
        { receivedAt: "asc" },
      ],
    });
  });
});
