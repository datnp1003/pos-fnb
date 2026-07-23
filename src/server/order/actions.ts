"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { autoDeductStockForOrder } from "@/server/recipe/actions";
import { isSystemModuleEnabled } from "@/server/settings/actions";

// ============ TABLE VIEW ============

export async function getAreasWithTables() {
  return db.area.findMany({
    include: {
      tables: {
        include: {
          orders: {
            where: { status: { in: ["OPEN", "SENT"] } },
            select: { id: true, status: true, orderNumber: true, orderNumberSuffix: true, type: true, openedAt: true, guestCount: true, totalAmount: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getActiveAreasWithTables() {
  return getAreasWithTables();
}

// ============ UPDATE GUEST COUNT ============

export async function updateOrderGuest(orderId: string, guestCount: number) {
  await db.order.update({ where: { id: orderId }, data: { guestCount } });
  revalidatePath("/order");
}

// ============ KARAOKE REFRESH ============

export async function refreshKaraokeTime(orderId: string) {
  await recalcOrder(orderId);
  revalidatePath("/order");
}

// ============ ORDER CRUD ============

export async function openTable(tableId: string, guestCount: number = 1, orderType: "NORMAL" | "COMP" = "NORMAL") {
  const existing = await db.order.findFirst({
    where: { tableId, status: { in: ["OPEN", "SENT"] } },
  });
  if (existing) return existing;

  const lastOrder = await db.order.findFirst({ orderBy: { orderNumber: "desc" } });
  const nextNumber = (lastOrder?.orderNumber ?? 0) + 1;

  const table = await db.table.findUnique({ where: { id: tableId }, include: { area: true } });
  const isKaraoke = table?.isKaraoke || table?.area?.type === "KARAOKE";

  const order = await db.order.create({
    data: {
      orderNumber: nextNumber,
      tableId,
      guestCount,
      status: "OPEN",
      type: isKaraoke ? "KARAOKE" : orderType,
    },
    include: { items: { include: { product: true, toppings: { include: { topping: true } } } } },
  });

  // Auto-add karaoke time item if karaoke table
  if (isKaraoke) {
    const pricing = await db.karaokePricing.findFirst({
      where: { areaId: table!.areaId },
      orderBy: { startTime: "asc" },
    });
    if (pricing) {
      await db.order.update({
        where: { id: order.id },
        data: { karaokePricingId: pricing.id },
      });
    }
  }

  revalidatePath("/order");
  await recalcOrder(order.id);
  return order;
}

export async function getOrder(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
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
}

// ============ ORDER ITEMS ============

export async function addItem(orderId: string, productId: string, quantity: number = 1, toppings?: { toppingId: string; price: number }[]) {
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");

  const item = await db.orderItem.create({
    data: {
      orderId,
      productId,
      quantity,
      unitPrice: product.price,
      toppings: toppings ? {
        create: toppings.map(t => ({ toppingId: t.toppingId, price: t.price })),
      } : undefined,
    },
    include: { product: true, toppings: { include: { topping: true } } },
  });

  await recalcOrder(orderId);
  revalidatePath("/order");
  return item;
}

export async function updateItemQuantity(itemId: string, quantity: number) {
  await db.orderItem.update({ where: { id: itemId }, data: { quantity } });
  const item = await db.orderItem.findUnique({ where: { id: itemId } });
  if (item) await recalcOrder(item.orderId);
  revalidatePath("/order");
}

export async function removeItem(itemId: string) {
  const item = await db.orderItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  await db.orderItem.delete({ where: { id: itemId } });
  await recalcOrder(item.orderId);
  revalidatePath("/order");
}

export async function cancelItem(itemId: string, userId: string, note?: string) {
  const existing = await db.orderItem.findUnique({ where: { id: itemId } });
  if (!existing) return;
  const item = await db.orderItem.update({
    where: { id: itemId },
    data: { status: "CANCELLED", cancelledBy: userId, cancelledAt: new Date(), note: note || existing.note },
  });
  await recalcOrder(item.orderId);
  revalidatePath("/order");
}

// ============ SEND ORDER ============

export async function sendOrder(orderId: string, areaId: string) {
  // Only send non-karaoke items to kitchen
  const karaokeSlugs = await db.product.findMany({
    where: { slug: { startsWith: "karaoke-" } },
    select: { id: true },
  });
  const karaokeProductIds = karaokeSlugs.map(p => p.id);

  await db.orderItem.updateMany({
    where: { orderId, status: "PENDING", productId: { notIn: karaokeProductIds } },
    data: { status: "SENT" },
  });
  await db.order.update({ where: { id: orderId }, data: { status: "SENT" } });

  try { await printOrderTicket(orderId, areaId, "ORDER"); } catch (e) { console.error("Print error:", e); }
  revalidatePath("/order");
}

// ============ MERGE / SPLIT ============

export async function mergeTables(orderIds: string[], targetTableId: string) {
  const targetOrder = await db.order.findFirst({
    where: { tableId: targetTableId, status: { in: ["OPEN", "SENT"] } },
  });
  if (!targetOrder) throw new Error("Target order not found");

  const mergedIds: string[] = [];
  for (const orderId of orderIds) {
    if (orderId === targetOrder.id) continue;
    await db.order.update({
      where: { id: orderId },
      data: { status: "MERGED", parentOrderId: targetOrder.id, closedAt: new Date() },
    });
    await db.orderItem.updateMany({ where: { orderId }, data: { orderId: targetOrder.id } });
    mergedIds.push(orderId);
  }

  await db.order.update({
    where: { id: targetOrder.id },
    data: { mergedFrom: JSON.stringify(mergedIds) },
  });
  await recalcOrder(targetOrder.id);
  revalidatePath("/order");
}

export async function splitItems(orderId: string, itemIds: string[], newTableId: string) {
  const originalOrder = await db.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true },
  });
  const existingSplits = await db.order.count({
    where: { parentOrderId: orderId, status: "SPLIT" },
  });

  const newOrder = await db.order.create({
    data: {
      orderNumber: originalOrder?.orderNumber ?? 0,
      orderNumberSuffix: String(existingSplits + 1),
      tableId: newTableId,
      guestCount: 1,
      status: "SPLIT",
      parentOrderId: orderId,
      splitFrom: orderId,
      type: "NORMAL",
    },
  });

  for (const itemId of itemIds) {
    await db.orderItem.update({ where: { id: itemId }, data: { orderId: newOrder.id } });
  }

  const remainingItems = await db.orderItem.findMany({
    where: { orderId, status: { not: "CANCELLED" } },
  });
  if (remainingItems.length === 0) {
    await db.order.update({
      where: { id: orderId },
      data: { status: "SPLIT", closedAt: new Date() },
    });
  }

  await recalcOrder(orderId);
  await recalcOrder(newOrder.id);
  revalidatePath("/order");
}

export async function splitItemsEvenly(orderId: string, itemIds: string[]) {
  const originalOrder = await db.order.findUnique({
    where: { id: orderId },
    include: { table: { select: { areaId: true } } },
  });
  if (!originalOrder) throw new Error("Order not found");

  const emptyTable = await db.table.findFirst({
    where: { areaId: originalOrder.table.areaId, orders: { none: { status: { in: ["OPEN", "SENT"] } } } },
  });
  if (!emptyTable) throw new Error("No empty tables in this area");

  const existingSplits = await db.order.count({
    where: { parentOrderId: orderId, status: "SPLIT" },
  });

  const newOrder = await db.order.create({
    data: {
      orderNumber: originalOrder.orderNumber,
      orderNumberSuffix: String(existingSplits + 1),
      tableId: emptyTable.id,
      guestCount: 1,
      status: "OPEN",
      parentOrderId: orderId,
      splitFrom: orderId,
      type: originalOrder.type,
    },
  });

  for (const itemId of itemIds) {
    const item = await db.orderItem.findUnique({ where: { id: itemId } });
    if (item?.orderId !== orderId) continue;
    if (item.quantity > 1) {
      const stay = Math.ceil(item.quantity / 2);
      const move = item.quantity - stay;
      await db.orderItem.update({ where: { id: itemId }, data: { quantity: stay } });
      await db.orderItem.create({
        data: { orderId: newOrder.id, productId: item.productId, quantity: move, unitPrice: item.unitPrice },
      });
    } else {
      await db.orderItem.update({ where: { id: itemId }, data: { orderId: newOrder.id } });
    }
  }

  await recalcOrder(orderId);
  await recalcOrder(newOrder.id);
  revalidatePath("/order");
  return newOrder;
}

// ============ TEMPORARY BILL ============

export async function getTempBill(orderId: string) {
  return getOrder(orderId);
}

export async function printTempBill(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) return;
  try { await printOrderTicket(orderId, order.table.areaId, "TEMP_BILL"); } catch (e) { console.error("Print error:", e); }
}

// ============ FINAL BILL + PAYMENT ============

export async function checkoutOrder(orderId: string, payments: { method: string; amount: number; reference?: string }[], userId?: string) {
  const order = await getOrder(orderId);
  if (!order) throw new Error("Order not found");

  for (const p of payments) {
    await db.payment.create({
      data: { orderId, method: p.method, amount: p.amount, reference: p.reference, status: "COMPLETED", paidAt: new Date() },
    });
  }

  await db.order.update({
    where: { id: orderId },
    data: { status: "PAID", closedAt: new Date(), userId },
  });

  if (await isSystemModuleEnabled("inventory")) {
    try { await autoDeductStockForOrder(orderId); } catch (e) { console.error("Stock deduction error:", e); }
  }

  if (order.type !== "COMP") {
    await db.cashFlow.create({
      data: {
        type: "INCOME",
        categoryId: "inc-sales",
        amount: order.totalAmount,
        description: `Order #${String(order.orderNumber).padStart(8, "0")}${order.orderNumberSuffix ? "-" + order.orderNumberSuffix : ""}`,
        referenceId: orderId,
        userId: userId || null,
      },
    });
  }

  try { await printOrderTicket(orderId, order.table.areaId, "BILL"); } catch (e) { console.error("Print error:", e); }
  revalidatePath("/order");
  revalidatePath("/cash");
}

// ============ PRINTER ============

async function printOrderTicket(orderId: string, areaId: string, printType: string) {
  try {
    const { createPrintJob } = await import("@/server/reports/print-actions");
    const result = await createPrintJob({
      orderId,
      type: (printType === "ORDER" || printType === "TEMP_BILL" ? printType : "BILL") as "ORDER" | "TEMP_BILL" | "BILL",
    });
    if (result.success) console.log(`[PRINT] Job #${result.jobId} sent successfully`);
    else console.error(`[PRINT] Failed: ${result.error}`);
  } catch (e) {
    console.error("[PRINT] Error:", e);
  }
}

// ============ KARAOKE TIME SYNC ============

async function syncKaraokeTime(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { table: { include: { area: true } } },
  });
  if (!order?.table) return;
  if (!order.table.isKaraoke && order.table.area.type !== "KARAOKE") return;
  if (order.status !== "OPEN" && order.status !== "SENT") return;

  // Use saved pricing ID, or find first matching
  let pricingId = order.karaokePricingId;
  if (!pricingId) {
    const p = await db.karaokePricing.findFirst({
      where: { areaId: order.table.areaId },
      orderBy: { startTime: "asc" },
    });
    if (!p) return;
    pricingId = p.id;
    await db.order.update({ where: { id: orderId }, data: { karaokePricingId: pricingId } });
  }

  const pricing = await db.karaokePricing.findUnique({ where: { id: pricingId } });
  if (!pricing) return;

  const now = new Date();
  const startTime = new Date(order.openedAt);
  const diffMs = now.getTime() - startTime.getTime();
  if (diffMs < 0) return;

  // Time unit mapping
  const unitLabel: Record<string, string> = { HOUR: "hours", MINUTE: "minutes", DAY: "days", MONTH: "months" };
  const msPerUnit: Record<string, number> = { MINUTE: 60000, HOUR: 3600000, DAY: 86400000, MONTH: 2592000000 };
  const unitMs = msPerUnit[pricing.timeUnit] || msPerUnit.HOUR;
  const units = Math.max(1, Math.ceil(diffMs / unitMs));

  // Ensure "Karaoke Time" category + product
  const karaokeCat = await db.category.upsert({
    where: { slug: "gio-karaoke" },
    update: {},
    create: { name: "Karaoke Time", slug: "gio-karaoke", sortOrder: 99 },
  });
  const unit = await db.unit.findFirst();

  const productSlug = `karaoke-${pricing.id}`;
  let timeProduct = await db.product.findFirst({ where: { slug: productSlug } });
  if (!timeProduct) {
    const label = unitLabel[pricing.timeUnit] || "hours";
    const vat = await db.vat.findFirst({ orderBy: { rate: "asc" } });
    timeProduct = await db.product.create({
      data: {
        name: `Tính ${label} - ${pricing.name}`,
        slug: productSlug,
        price: pricing.pricePerHour,
        costPrice: 0,
        categoryId: karaokeCat.id,
        unitId: unit?.id ?? "unit-gio",
        vatId: vat?.id ?? "vat-5",
        isAvailable: false,
      },
    });
  }

  // Upsert karaoke time item
  const existingItem = await db.orderItem.findFirst({
    where: { orderId, productId: timeProduct.id, status: { not: "CANCELLED" } },
  });
  if (existingItem) {
    await db.orderItem.update({
      where: { id: existingItem.id },
      data: { quantity: units, unitPrice: pricing.pricePerHour },
    });
  } else {
    await db.orderItem.create({
      data: {
        orderId,
        productId: timeProduct.id,
        quantity: units,
        unitPrice: pricing.pricePerHour,
        note: `${pricing.startTime}–${pricing.endTime}`,
        status: "PENDING",
      },
    });
  }
}

// ============ CALCULATIONS ============

type ChargeRow = {
  applyCondition: string | null; startDate: Date | null; endDate: Date | null;
  minOrderValue: number | null; minGuestCount: number | null;
  scope: string | null; areaId: string | null; type: string; value: number;
};

function calcChargeAmount(sc: ChargeRow, subtotal: number, guestCount: number, areaId: string | undefined, now: Date, isHoliday: boolean): number {
  const cond = sc.applyCondition || "ALL_DAYS";
  let applicable = false;
  switch (cond) {
    case "ALL_DAYS": applicable = true; break;
    case "DATE_RANGE":
      if (sc.startDate && sc.endDate) applicable = now >= new Date(sc.startDate) && now <= new Date(sc.endDate);
      break;
    case "HOLIDAY": applicable = isHoliday; break;
    case "MIN_ORDER": applicable = subtotal >= (sc.minOrderValue || 0); break;
    case "GUEST_COUNT": applicable = guestCount >= (sc.minGuestCount || 0); break;
  }
  if (applicable && sc.scope === "AREA" && sc.areaId) applicable = areaId === sc.areaId;
  if (!applicable) return 0;
  if (sc.type === "PERCENTAGE" || sc.type === "SERVICE_FEE") return subtotal * (sc.value / 100);
  if (sc.type === "PER_GUEST") return sc.value * guestCount;
  return sc.value;
}

async function recalcOrder(orderId: string) {
  // Sync karaoke time first (for karaoke orders)
  await syncKaraokeTime(orderId);

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: { status: { not: "CANCELLED" } },
        include: {
          product: { include: { vat: true, exciseTax: true } },
          toppings: true,
        },
      },
      table: { select: { areaId: true } },
    },
  });

  if (!order) return;

  let subtotal = 0;
  let toppingTotal = 0;

  for (const item of order.items) {
    subtotal += item.unitPrice * item.quantity;
    for (const t of item.toppings) {
      toppingTotal += t.price * item.quantity;
    }
  }

  subtotal += toppingTotal;

  // Group by tax
  const taxByVat: Record<string, number> = {};
  const taxByExcise: Record<string, number> = {};

  for (const item of order.items) {
    const k = `${item.product.vatId}:${item.product.vat.rate}`;
    taxByVat[k] = (taxByVat[k] || 0) + item.unitPrice * item.quantity * item.product.vat.rate;

    if (item.product.exciseTax) {
      const ek = `${item.product.exciseTaxId}:${item.product.exciseTax.rate}`;
      taxByExcise[ek] = (taxByExcise[ek] || 0) + item.unitPrice * item.quantity * item.product.exciseTax.rate;
    }
  }

  const vatAmount = Object.values(taxByVat).reduce((a, b) => a + b, 0);
  const exciseTaxAmount = Object.values(taxByExcise).reduce((a, b) => a + b, 0);

  // Auto-calculate service charges
  let serviceCharge = 0;
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const activeCharges = await db.serviceCharge.findMany({ where: { isActive: true } });
  const todayHolidays = await db.holiday.findMany({
    where: {
      date: {
        gte: new Date(todayISO + "T00:00:00.000Z"),
        lte: new Date(todayISO + "T23:59:59.999Z"),
      },
    },
  });
  const isHoliday = todayHolidays.length > 0;

  for (const sc of activeCharges) {
    serviceCharge += calcChargeAmount(sc, subtotal, order.guestCount, order.table?.areaId, now, isHoliday);
  }

  const totalAmount = subtotal + vatAmount + exciseTaxAmount - order.discountAmount + serviceCharge;

  await db.order.update({
    where: { id: orderId },
    data: { subtotal, vatAmount, exciseTaxAmount, serviceCharge, totalAmount },
  });
}

// ============ CATEGORIES & PRODUCTS FOR ORDER ============
export async function getCategoriesWithProducts() {
  return db.category.findMany({
    include: {
      products: {
        where: { isAvailable: true },
        include: {
          vat: true,
          exciseTax: true,
          unit: true,
          toppingGroups: {
            include: { toppingGroup: { include: { toppings: { orderBy: { sortOrder: "asc" } } } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}
