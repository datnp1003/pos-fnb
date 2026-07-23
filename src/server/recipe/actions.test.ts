import { describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";

import { prismaMock } from "@/test/prisma-mock";
import { consumeFifoStock } from "@/server/inventory/fifo";
import {
  addRecipeItem,
  autoDeductStockForOrder,
  getProductRecipe,
  removeRecipeItem,
  updateRecipeItem,
} from "./actions";

vi.mock("@/server/inventory/fifo", () => ({
  consumeFifoStock: vi.fn(),
}));

const revalidatePathMock = vi.mocked(revalidatePath);
const consumeFifoStockMock = vi.mocked(consumeFifoStock);

function mockRecalc(cost = 1) {
  prismaMock.ingredientRecipe.findMany.mockResolvedValue([
    { quantity: 2, ingredient: { costPerBaseUnit: cost } },
  ]);
  prismaMock.product.update.mockResolvedValue({} as never);
}

describe("recipe server actions", () => {
  it("getProductRecipe queries by product with joins", async () => {
    prismaMock.ingredientRecipe.findMany.mockResolvedValue([]);
    await getProductRecipe("product-1");
    expect(prismaMock.ingredientRecipe.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: "product-1" } }),
    );
  });

  it("addRecipeItem updates existing item when present", async () => {
    prismaMock.ingredientRecipe.findFirst.mockResolvedValue({ id: "rec-1" } as never);
    prismaMock.ingredientRecipe.update.mockResolvedValue({} as never);
    mockRecalc();

    await addRecipeItem({ productId: "p1", ingredientId: "i1", quantity: 5 });

    expect(prismaMock.ingredientRecipe.update).toHaveBeenCalledWith({
      where: { id: "rec-1" },
      data: { quantity: 5 },
    });
    expect(prismaMock.ingredientRecipe.create).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings/products");
  });

  it("addRecipeItem creates item when none exists", async () => {
    prismaMock.ingredientRecipe.findFirst.mockResolvedValue(null);
    prismaMock.ingredientRecipe.create.mockResolvedValue({} as never);
    mockRecalc(0);

    await addRecipeItem({ productId: "p1", ingredientId: "i1", quantity: 3, unitId: "u1" });

    expect(prismaMock.ingredientRecipe.create).toHaveBeenCalled();
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { costPrice: 0 },
    });
  });

  it("updateRecipeItem recalculates when recipe found", async () => {
    prismaMock.ingredientRecipe.update.mockResolvedValue({} as never);
    prismaMock.ingredientRecipe.findUnique.mockResolvedValue({ id: "rec-1", productId: "p1" } as never);
    mockRecalc();

    await updateRecipeItem("rec-1", { quantity: 2 });

    expect(prismaMock.product.update).toHaveBeenCalled();
  });

  it("removeRecipeItem returns early when item missing", async () => {
    prismaMock.ingredientRecipe.findUnique.mockResolvedValue(null);
    await removeRecipeItem("missing");
    expect(prismaMock.ingredientRecipe.delete).not.toHaveBeenCalled();
  });

  it("removeRecipeItem deletes and recalculates", async () => {
    prismaMock.ingredientRecipe.findUnique.mockResolvedValue({ id: "rec-1", productId: "p1" } as never);
    prismaMock.ingredientRecipe.delete.mockResolvedValue({} as never);
    mockRecalc();

    await removeRecipeItem("rec-1");

    expect(prismaMock.ingredientRecipe.delete).toHaveBeenCalledWith({ where: { id: "rec-1" } });
  });

  it("autoDeductStockForOrder returns early when order missing", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    await autoDeductStockForOrder("missing");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("autoDeductStockForOrder deducts stock per recipe and warns on shortage", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    prismaMock.order.findUnique.mockResolvedValue({
      orderNumber: 7,
      userId: "user-1",
      items: [
        {
          id: "item-1",
          quantity: 2,
          product: {
            name: "Latte",
            recipes: [
              {
                ingredientId: "ing-1",
                quantity: 10,
                ingredient: { name: "Milk", baseUnit: "ml", currentStock: 5 },
              },
            ],
          },
        },
      ],
    } as never);

    const tx = {
      stockOut: { create: vi.fn().mockResolvedValue({ id: "so-1" }) },
      ingredient: { update: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(
      async (cb: (arg: typeof tx) => Promise<unknown>) => cb(tx),
    );

    await autoDeductStockForOrder("order-1");

    expect(warn).toHaveBeenCalled();
    expect(tx.stockOut.create).toHaveBeenCalled();
    expect(consumeFifoStockMock).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ stockOutId: "so-1", ingredientId: "ing-1", quantity: 20 }),
    );
    warn.mockRestore();
  });
});
