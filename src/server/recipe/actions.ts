"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { consumeFifoStock } from "@/server/inventory/fifo";

// ============ GET RECIPE FOR A PRODUCT ============
export async function getProductRecipe(productId: string) {
  return db.ingredientRecipe.findMany({
    where: { productId },
    include: {
      ingredient: true,
      unit: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

// ============ ADD INGREDIENT TO PRODUCT RECIPE ============
export async function addRecipeItem(data: {
  productId: string;
  ingredientId: string;
  quantity: number;
  unitId?: string;
}) {
  // Check if already exists
  const existing = await db.ingredientRecipe.findFirst({
    where: {
      productId: data.productId,
      ingredientId: data.ingredientId,
    },
  });
  
  if (existing) {
    // Update quantity instead
    await db.ingredientRecipe.update({
      where: { id: existing.id },
      data: { quantity: data.quantity },
    });
  } else {
    await db.ingredientRecipe.create({
      data: {
        productId: data.productId,
        ingredientId: data.ingredientId,
        quantity: data.quantity,
        unitId: data.unitId || undefined,
      },
    });
  }

  // Recalculate product cost from recipe
  await recalcProductCost(data.productId);
  revalidatePath("/settings/products");
}

// ============ UPDATE RECIPE ITEM ============
export async function updateRecipeItem(id: string, data: {
  quantity?: number;
  unitId?: string;
}) {
  await db.ingredientRecipe.update({ where: { id }, data });
  const recipe = await db.ingredientRecipe.findUnique({ where: { id } });
  if (recipe) await recalcProductCost(recipe.productId);
  revalidatePath("/settings/products");
}

// ============ REMOVE RECIPE ITEM ============
export async function removeRecipeItem(id: string) {
  const recipe = await db.ingredientRecipe.findUnique({ where: { id } });
  if (!recipe) return;
  await db.ingredientRecipe.delete({ where: { id } });
  await recalcProductCost(recipe.productId);
  revalidatePath("/settings/products");
}

// ============ AUTO-DEDUCT STOCK WHEN SENDING ORDER ============
export async function autoDeductStockForOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: { status: { not: "CANCELLED" } },
        include: { product: { include: { recipes: { include: { ingredient: true } } } } },
      },
    },
  });

  if (!order) return;

  for (const item of order.items) {
    if (!item.product) continue;
    
    for (const recipe of item.product.recipes) {
      const totalDeduct = recipe.quantity * item.quantity;
      
      if (totalDeduct <= 0) continue;

      // Check stock
      const ingredient = recipe.ingredient;
      if (ingredient.currentStock < totalDeduct) {
        console.warn(`⚠️ [INVENTORY] Insufficient ${ingredient.name}: need ${totalDeduct}${ingredient.baseUnit}, have ${ingredient.currentStock}${ingredient.baseUnit}`);
        // Deduct anyway but log warning
      }

      await db.$transaction(async (tx) => {
        const stockOut = await tx.stockOut.create({
          data: {
            ingredientId: recipe.ingredientId,
            quantity: totalDeduct,
            reason: "ORDER_COMPLETED",
            referenceId: item.id,
            userId: order.userId || null,
            note: `Order #${order.orderNumber} - ${item.product.name} x${item.quantity}`,
          },
        });

        await consumeFifoStock(tx, {
          stockOutId: stockOut.id,
          ingredientId: recipe.ingredientId,
          quantity: totalDeduct,
        });

        await tx.ingredient.update({
          where: { id: recipe.ingredientId },
          data: { currentStock: { decrement: totalDeduct } },
        });
      });
    }
  }
  
  console.log(`📦 [INVENTORY] Deducted stock for Order #${order.orderNumber} (${order.items.length} items)`);
}

// ============ RECALCULATE PRODUCT COST FROM RECIPE ============
async function recalcProductCost(productId: string) {
  const recipes = await db.ingredientRecipe.findMany({
    where: { productId },
    include: { ingredient: true },
  });

  let totalCost = 0;
  for (const r of recipes) {
    totalCost += r.quantity * (r.ingredient.costPerBaseUnit || 0);
  }

  await db.product.update({
    where: { id: productId },
    data: { costPrice: Math.ceil(totalCost) },
  });
}
