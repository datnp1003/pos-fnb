"use server";

import { db } from "@/lib/db";

// ======================== HELPERS ========================

type ReportMode = "day" | "week" | "month" | "year" | "custom";

function dateRangeByMode(mode: ReportMode, date?: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (mode === "custom" && startDate && endDate) {
    start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const d = date ? new Date(date) : now;

  switch (mode) {
    case "week": {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      start = new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "month":
      start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "year":
      start = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;
    case "day":
    default:
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  return { start, end };
}

// ======================== 1. INVOICE REPORT ========================

export async function getInvoiceReport(mode: string, date?: string, startDate?: string, endDate?: string) {
  const { start, end } = dateRangeByMode(mode as ReportMode, date, startDate, endDate);

  const orders = await db.order.findMany({
    where: {
      closedAt: { gte: start, lte: end },
      status: "PAID",
    },
    include: {
      table: { select: { name: true } },
      user: { select: { name: true } },
      payments: { select: { method: true, amount: true } },
      items: {
        where: { status: { not: "CANCELLED" } },
        select: { product: { select: { name: true } }, quantity: true, unitPrice: true },
      },
    },
    orderBy: { closedAt: "desc" },
  });

  const mapped = orders.map(o => ({
    id: o.id,
    orderNumber: o.orderNumber,
    orderNumberSuffix: o.orderNumberSuffix,
    table: o.table.name,
    guestCount: o.guestCount,
    type: o.type,
    subtotal: o.subtotal,
    vatAmount: o.vatAmount,
    exciseTaxAmount: o.exciseTaxAmount,
    discountAmount: o.discountAmount,
    serviceCharge: o.serviceCharge,
    totalAmount: o.totalAmount,
    paymentMethods: o.payments.map(p => `${p.method}: ${p.amount.toLocaleString()}`).join("; "),
    staff: o.user?.name || "—",
    items: o.items.map(i => `${i.product.name} x${i.quantity}`).join(", "),
    openedAt: o.openedAt.toISOString(),
    closedAt: o.closedAt?.toISOString() || "",
  }));

  const summary = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((s, o) => s + o.totalAmount, 0),
    totalVat: orders.reduce((s, o) => s + o.vatAmount, 0),
    totalExciseTax: orders.reduce((s, o) => s + o.exciseTaxAmount, 0),
    totalDiscount: orders.reduce((s, o) => s + o.discountAmount, 0),
    totalServiceCharge: orders.reduce((s, o) => s + o.serviceCharge, 0),
    totalSubtotal: orders.reduce((s, o) => s + o.subtotal, 0),
  };

  return { orders: mapped, summary, dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

// ======================== 2. SOLD ITEMS REPORT ========================

export async function getSoldItemsReport(mode: string, date?: string, startDate?: string, endDate?: string) {
  const { start, end } = dateRangeByMode(mode as ReportMode, date, startDate, endDate);

  const items = await db.orderItem.findMany({
    where: {
      status: { not: "CANCELLED" },
      order: {
        closedAt: { gte: start, lte: end },
        status: "PAID",
      },
    },
    include: {
      product: {
        select: { name: true, slug: true, category: { select: { name: true } } },
      },
      toppings: {
        include: { topping: { select: { name: true } } },
      },
      order: { select: { orderNumber: true, orderNumberSuffix: true, closedAt: true, table: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = items.map(i => ({
    productName: i.product.name,
    category: i.product.category.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    toppings: i.toppings.map(t => t.topping.name).join(", "),
    toppingsPrice: i.toppings.reduce((s, t) => s + t.price, 0),
    totalAmount: i.unitPrice * i.quantity + i.toppings.reduce((s, t) => s + t.price * i.quantity, 0),
    orderNumber: `${i.order.orderNumber}${i.order.orderNumberSuffix ? "-" + i.order.orderNumberSuffix : ""}`,
    table: i.order.table.name,
    closedAt: i.order.closedAt?.toISOString() || "",
  }));

  // Group by product
  const byProduct: Record<string, { name: string; category: string; quantity: number; revenue: number }> = {};
  items.forEach(i => {
    const key = i.productId;
    if (!byProduct[key]) byProduct[key] = { name: i.product.name, category: i.product.category.name, quantity: 0, revenue: 0 };
    byProduct[key].quantity += i.quantity;
    byProduct[key].revenue += i.unitPrice * i.quantity + i.toppings.reduce((s, t) => s + t.price * i.quantity, 0);
  });

  const summary = {
    totalItems: items.length,
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    totalRevenue: items.reduce((s, i) => s + i.unitPrice * i.quantity + i.toppings.reduce((ss, t) => ss + t.price * i.quantity, 0), 0),
  };

  return { items: mapped, byProduct: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue), summary, dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

// ======================== 3. REVENUE REPORT ========================

export async function getRevenueReport(mode: string, date?: string, startDate?: string, endDate?: string) {
  const { start, end } = dateRangeByMode(mode as ReportMode, date, startDate, endDate);

  const orders = await db.order.findMany({
    where: {
      closedAt: { gte: start, lte: end },
      status: "PAID",
    },
    select: {
      closedAt: true,
      subtotal: true,
      vatAmount: true,
      exciseTaxAmount: true,
      discountAmount: true,
      serviceCharge: true,
      totalAmount: true,
      type: true,
      payments: { select: { method: true, amount: true } },
    },
    orderBy: { closedAt: "asc" },
  });

  // Group by day
  const byDay: Record<string, {
    date: string; orders: number; subtotal: number; vat: number; excise: number;
    discount: number; service: number; revenue: number; normalCount: number; compCount: number;
    payments: Record<string, number>;
  }> = {};

  orders.forEach(o => {
    const day = o.closedAt!.toISOString().slice(0, 10);
    if (!byDay[day]) {
      byDay[day] = { date: day, orders: 0, subtotal: 0, vat: 0, excise: 0, discount: 0, service: 0, revenue: 0, normalCount: 0, compCount: 0, payments: {} };
    }
    byDay[day].orders += 1;
    byDay[day].subtotal += o.subtotal;
    byDay[day].vat += o.vatAmount;
    byDay[day].excise += o.exciseTaxAmount;
    byDay[day].discount += o.discountAmount;
    byDay[day].service += o.serviceCharge;
    byDay[day].revenue += o.totalAmount;
    if (o.type === "COMP") byDay[day].compCount += 1;
    else byDay[day].normalCount += 1;
    o.payments.forEach(p => {
      byDay[day].payments[p.method] = (byDay[day].payments[p.method] || 0) + p.amount;
    });
  });

  const days = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

  const cashFlows = await db.cashFlow.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Expenses by category
  const expensesByCategory: Record<string, number> = {};
  const incomeByCategory: Record<string, number> = {};
  let totalExpenses = 0;
  let totalOtherIncome = 0;
  cashFlows.forEach(cf => {
    if (cf.type === "EXPENSE") {
      expensesByCategory[cf.category.name] = (expensesByCategory[cf.category.name] || 0) + cf.amount;
      totalExpenses += cf.amount;
    } else {
      incomeByCategory[cf.category.name] = (incomeByCategory[cf.category.name] || 0) + cf.amount;
      totalOtherIncome += cf.amount;
    }
  });

  const summary = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((s, o) => s + o.totalAmount, 0),
    totalSubtotal: orders.reduce((s, o) => s + o.subtotal, 0),
    totalVat: orders.reduce((s, o) => s + o.vatAmount, 0),
    totalExciseTax: orders.reduce((s, o) => s + o.exciseTaxAmount, 0),
    totalDiscount: orders.reduce((s, o) => s + o.discountAmount, 0),
    totalServiceCharge: orders.reduce((s, o) => s + o.serviceCharge, 0),
    totalExpenses,
    totalOtherIncome,
    profit: totalOtherIncome - totalExpenses,
    byPaymentMethod: orders.flatMap(o => o.payments).reduce<Record<string, number>>((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount;
      return acc;
    }, {}),
  };

  return {
    days,
    summary,
    expensesByCategory,
    incomeByCategory,
    cashFlows,
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
  };
}

// ======================== 4. INGREDIENTS REPORT ========================

export async function getIngredientReport(mode: string, date?: string, startDate?: string, endDate?: string) {
  const { start, end } = dateRangeByMode(mode as ReportMode, date, startDate, endDate);

  const [stockIns, stockOuts, ingredients] = await Promise.all([
    db.stockIn.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        user: { select: { name: true } },
        items: { include: { ingredient: { select: { name: true, baseUnit: true, purchaseUnit: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.stockOut.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        ingredient: { select: { name: true, baseUnit: true } },
        user: { select: { name: true } },
        batches: { include: { batch: { select: { batchCode: true, receivedAt: true, unitCost: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.ingredient.findMany({
      include: {
        recipes: { include: { product: { select: { name: true } } } },
        _count: { select: { stockIns: true, stockOuts: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const stockInSummary = {
    totalStockIns: stockIns.length,
    totalAmount: stockIns.reduce((s, si) => s + si.totalAmount, 0),
    totalItems: stockIns.reduce((s, si) => s + si.items.length, 0),
    bySupplier: stockIns.reduce<Record<string, number>>((acc, si) => {
      const key = si.supplier || "Unknown";
      acc[key] = (acc[key] || 0) + si.totalAmount;
      return acc;
    }, {}),
  };

  const stockOutSummary = {
    totalStockOuts: stockOuts.length,
    totalQuantity: stockOuts.reduce((s, so) => s + so.quantity, 0),
    totalCost: stockOuts.reduce((s, so) => s + so.totalCost, 0),
    byReason: stockOuts.reduce<Record<string, number>>((acc, so) => {
      acc[so.reason] = (acc[so.reason] || 0) + so.quantity;
      return acc;
    }, {}),
  };

  return {
    stockIns,
    stockOuts,
    ingredients,
    stockInSummary,
    stockOutSummary,
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
  };
}

// ======================== 5. WAREHOUSE REPORT ========================

export async function getWarehouseReport() {
  const ingredients = await db.ingredient.findMany({
    include: {
      recipes: { include: { product: { select: { name: true } } } },
      batches: {
        where: { remainingQuantity: { gt: 0 } },
        orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
      },
      _count: { select: { stockIns: true, stockOuts: true } },
    },
    orderBy: { name: "asc" },
  });

  const batches = await db.inventoryBatch.findMany({
    where: { remainingQuantity: { gt: 0 } },
    include: {
      ingredient: { select: { name: true, baseUnit: true } },
      stockInItem: { include: { stockIn: { select: { code: true, supplier: true, createdAt: true } } } },
    },
    orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
  });

  const totalValue = batches.reduce((s, b) => s + b.remainingQuantity * b.unitCost, 0);
  const totalProducts = await db.product.count({ where: { isAvailable: true } });
  const totalCategories = await db.category.count();
  const totalSuppliers = await db.supplier.count();

  const lowStock = ingredients.filter(i => i.currentStock <= i.minStock && i.minStock > 0);
  const outOfStock = ingredients.filter(i => i.currentStock <= 0 && i.minStock > 0);

  return {
    ingredients,
    summary: {
      totalIngredients: ingredients.length,
      totalStockValue: totalValue,
      totalProducts,
      totalCategories,
      totalSuppliers,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
    },
    lowStock,
    outOfStock,
    batches,
  };
}
