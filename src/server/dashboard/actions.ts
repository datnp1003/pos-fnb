"use server";

import { db } from "@/lib/db";

function getOrderLabel(status: string, tableName: string): string {
  if (status === "PAID") return `Table ${tableName} checkout`;
  if (status === "SENT") return `Table ${tableName} preparing`;
  return `Table ${tableName} opened`;
}

function getOrderColor(status: string): string {
  if (status === "PAID") return "#10b981";
  if (status === "SENT") return "#d97706";
  return "#3b82f6";
}

export async function getDashboardStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);

  // Revenue today (paid orders)
  const paidOrders = await db.order.findMany({
    where: {
      status: "PAID",
      closedAt: { gte: today, lt: tomorrow },
    },
    select: { totalAmount: true },
  });
  const revenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Total orders today
  const orderCount = await db.order.count({
    where: {
      status: { in: ["PAID", "OPEN", "SENT"] },
      openedAt: { gte: today, lt: tomorrow },
    },
  });

  // Active tables
  const activeTables = await db.table.count();
  const occupiedTables = await db.order.count({
    where: { status: { in: ["OPEN", "SENT"] } },
  });

  // Recent activities (last 10 events)
  const recentOrders = await db.order.findMany({
    where: {
      status: { in: ["PAID", "OPEN", "SENT"] },
      closedAt: { gte: today, lt: tomorrow },
    },
    orderBy: { openedAt: "desc" },
    take: 6,
    include: {
      table: { select: { name: true } },
      payments: { select: { amount: true } },
    },
  });

  const timeline = recentOrders.map(o => ({
    id: o.id,
    label: getOrderLabel(o.status, o.table.name),
    amount: o.totalAmount,
    time: minutesAgo(o.closedAt ?? o.openedAt),
    color: getOrderColor(o.status),
  }));

  // Top selling product today
  const topItem = await db.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: { closedAt: { gte: today, lt: tomorrow } },
      status: { not: "CANCELLED" },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 1,
  });

  let topProduct = "—";
  let topQty = 0;
  if (topItem[0]) {
    const p = await db.product.findUnique({ where: { id: topItem[0].productId }, select: { name: true } });
    topProduct = p?.name ?? "—";
    topQty = topItem[0]._sum.quantity ?? 0;
  }

  return {
    revenue,
    orderCount,
    activeTables,
    occupiedTables,
    topProduct,
    topQty,
    timeline,
  };
}

function minutesAgo(date: Date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins`;
  return `${Math.floor(mins / 60)}h${mins % 60}m`;
}
