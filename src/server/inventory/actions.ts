"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { consumeFifoStock, createBatchForStockInItem } from "./fifo";

// ============ STOCK IN ============

export async function getStockIns() {
  return db.stockIn.findMany({
    select: {
      id: true, code: true, supplier: true, totalAmount: true, note: true, createdAt: true,
      user: { select: { name: true } },
      items: { include: { ingredient: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createStockIn(data: {
  supplier?: string;
  supplierId?: string;
  note?: string;
  userId: string;
  items: { ingredientId: string; quantity: number; unitPrice: number }[];
}) {
  // Generate stock-in code: PN-YYYYMMDD-XXX
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replaceAll("-", "");
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayCount = await db.stockIn.count({
    where: { createdAt: { gte: todayStart } },
  });
  const code = `PN-${dateStr}-${String(todayCount + 1).padStart(3, "0")}`;

  // If supplierId provided but no supplier name, fetch supplier name
  let supplierName = data.supplier;
  if (data.supplierId && !supplierName) {
    const sup = await db.supplier.findUnique({ where: { id: data.supplierId } });
    supplierName = sup?.name;
  }

  const validItems = data.items.filter((it) => it.ingredientId && it.quantity > 0);
  const totalAmount = validItems.reduce((s, it) => s + it.quantity * it.unitPrice, 0);

  const stockIn = await db.$transaction(async (tx) => {
    const created = await tx.stockIn.create({
      data: {
        code,
        supplier: supplierName,
        supplierId: data.supplierId,
        note: data.note,
        userId: data.userId,
        totalAmount,
      },
    });

    for (const it of validItems) {
      const price = it.quantity * it.unitPrice;
      const stockInItem = await tx.stockInIngredient.create({
        data: {
          stockInId: created.id,
          ingredientId: it.ingredientId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: price,
        },
      });

      await createBatchForStockInItem(tx, {
        ingredientId: it.ingredientId,
        stockInItemId: stockInItem.id,
        stockInCode: code,
        quantity: it.quantity,
        unitCost: it.unitPrice,
        receivedAt: created.createdAt,
      });

      await tx.ingredient.update({
        where: { id: it.ingredientId },
        data: {
          currentStock: { increment: it.quantity },
          purchasePrice: it.unitPrice,
          costPerBaseUnit: it.unitPrice,
        },
      });
    }

    return created;
  });

  // Add to cash flow (expense)
  if (totalAmount > 0) {
    await db.cashFlow.create({
      data: {
        type: "EXPENSE",
        categoryId: "expense-stock",
        amount: totalAmount,
        description: `Stock in #${data.supplier || "Supplier"}`,
        referenceId: stockIn.id,
        userId: data.userId,
      },
    });
  }

  revalidatePath("/inventory");
  return stockIn;
}

// ============ STOCK OUT ============

export async function getStockOuts() {
  return db.stockOut.findMany({
    include: { ingredient: true, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createStockOut(data: {
  ingredientId: string;
  quantity: number;
  reason: string;
  userId: string;
  note?: string;
}) {
  const stockOut = await db.$transaction(async (tx) => {
    const created = await tx.stockOut.create({ data });
    await consumeFifoStock(tx, {
      stockOutId: created.id,
      ingredientId: data.ingredientId,
      quantity: data.quantity,
    });
    await tx.ingredient.update({
      where: { id: data.ingredientId },
      data: { currentStock: { decrement: data.quantity } },
    });
    return created;
  });
  revalidatePath("/inventory");
  return stockOut;
}

// ============ INVENTORY STATUS ============

export async function getInventoryStatus() {
  return db.ingredient.findMany({
    include: {
      recipes: { include: { product: { select: { name: true } } } },
      _count: { select: { stockIns: true, stockOuts: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getLowStockIngredients() {
  return db.ingredient.findMany({
    where: {
      currentStock: { lte: db.ingredient.fields.minStock },
      minStock: { gt: 0 },
    },
  });
}

export async function getIngredientRecipes(ingredientId: string) {
  return db.ingredientRecipe.findMany({
    where: { ingredientId },
    include: { product: true, unit: true },
  });
}

// ============ CASH REGISTER ============

export async function getCashRegisters() {
  return db.cashRegister.findMany({
    include: {
      user: { select: { name: true } },
      shift: { select: { name: true } },
    },
    orderBy: { openingAt: "desc" },
  });
}

export async function openCashRegister(data: {
  openingBalance: number;
  userId: string;
  shiftId?: string;
}) {
  const register = await db.cashRegister.create({
    data: {
      openingBalance: data.openingBalance,
      userId: data.userId,
      shiftId: data.shiftId,
      status: "OPEN",
    },
  });
  revalidatePath("/cash");
  return register;
}

export async function closeCashRegister(registerId: string, data: {
  closingBalance: number;
  closedBy: string;
}) {
  const register = await db.cashRegister.findUnique({
    where: { id: registerId },
    include: { transactions: true },
  });
  if (!register) throw new Error("Cash register not found");

  // Calculate expected balance
  const pettyIncome = register.transactions.filter(t => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const pettyExpense = register.transactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  // Get sales revenue during this shift
  const salesRevenue = 0; 

  const expectedBalance = register.openingBalance + salesRevenue + pettyIncome - pettyExpense;
  const discrepancy = data.closingBalance - expectedBalance;

  await db.cashRegister.update({
    where: { id: registerId },
    data: {
      closingBalance: data.closingBalance,
      expectedBalance,
      discrepancy,
      closedBy: data.closedBy,
      closedAt: new Date(),
      status: "CLOSED",
    },
  });
  revalidatePath("/cash");
}

// ============ PETTY TRANSACTIONS ============

export async function getPettyTransactions(registerId: string) {
  return db.pettyTransaction.findMany({
    where: { cashRegisterId: registerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPettyTransaction(data: {
  cashRegisterId: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  description?: string;
  userId: string;
}) {
  await db.pettyTransaction.create({ data });
  revalidatePath("/cash");
}

// ============ CASH FLOW ============

export async function getCashFlow(date?: string) {
  const where: Prisma.CashFlowWhereInput = {};
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { gte: start, lte: end };
  }

  return db.cashFlow.findMany({
    include: { category: true, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    ...(date ? { where } : {}),
  });
}

export async function createCashFlow(data: {
  type: "INCOME" | "EXPENSE";
  categoryId: string;
  amount: number;
  description?: string;
  userId: string;
}) {
  await db.cashFlow.create({ data });
  revalidatePath("/cash");
}

export async function getCashFlowCategories() {
  return db.cashFlowCategory.findMany({ orderBy: { sortOrder: "asc" } });
}

// ============ REPORTS ============

export async function getDailyReport(date: string) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const [orders, payments, expenses, incomes] = await Promise.all([
    db.order.findMany({
      where: { createdAt: { gte: start, lte: end }, status: "PAID" },
      select: { subtotal: true, vatAmount: true, exciseTaxAmount: true, totalAmount: true, discountAmount: true },
    }),
    db.payment.findMany({
      where: { createdAt: { gte: start, lte: end }, status: "COMPLETED" },
    }),
    db.cashFlow.findMany({
      where: { createdAt: { gte: start, lte: end }, type: "EXPENSE" },
      include: { category: true },
    }),
    db.cashFlow.findMany({
      where: { createdAt: { gte: start, lte: end }, type: "INCOME" },
      include: { category: true },
    }),
  ]);

  const revenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);

  // Payment methods breakdown
  const paymentMethods: Record<string, number> = {};
  payments.forEach(p => { paymentMethods[p.method] = (paymentMethods[p.method] || 0) + p.amount; });

  return {
    orders: orders.length,
    revenue,
    totalIncome,
    totalExpense,
    profit: totalIncome - totalExpense,
    vatTotal: orders.reduce((s, o) => s + o.vatAmount, 0),
    exciseTaxTotal: orders.reduce((s, o) => s + o.exciseTaxAmount, 0),
    paymentMethods,
    expensesByCategory: expenses.reduce((acc, e) => {
      acc[e.category.name] = (acc[e.category.name] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>),
  };
}

export async function getTopProducts(date: string) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const items = await db.orderItem.findMany({
    where: {
      status: { not: "CANCELLED" },
      order: { createdAt: { gte: start, lte: end }, status: "PAID" },
    },
    include: { product: { select: { name: true } } },
  });

  const grouped: Record<string, { name: string; quantity: number; revenue: number }> = {};
  items.forEach(item => {
    const key = item.productId;
    if (!grouped[key]) grouped[key] = { name: item.product.name, quantity: 0, revenue: 0 };
    grouped[key].quantity += item.quantity;
    grouped[key].revenue += item.unitPrice * item.quantity;
  });

  return Object.values(grouped).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}
