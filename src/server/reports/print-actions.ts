"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import * as net from "node:net";

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n || 0);
}

// ======================== PARSE TEMPLATE CONFIG ========================

// ORDER config
interface OrderCfg {
  showSequence: boolean; showTable: boolean; showTime: boolean; showQuantity: boolean; showTopping: boolean; showNote: boolean;
}
const defaultOrderCfg: OrderCfg = {
  showSequence: true, showTable: true, showTime: true, showQuantity: true, showTopping: true, showNote: true,
};

// BILL config
interface BillCfg {
  header: { showLogo: boolean; showAddress: boolean; showPhone: boolean; showTaxCode: boolean; showDateTime: boolean };
  body: { showTable: boolean; showGuestCount: boolean; showQuantity: boolean; showUnitPrice: boolean; showAmount: boolean; showTopping: boolean; showNote: boolean; showOrderNumber: boolean };
  footer: { showSubtotal: boolean; showVat: boolean; showDiscount: boolean; showServiceCharge: boolean; showTotal: boolean; showPaymentMethod: boolean; showCashier: boolean; thankYou: string };
}
const defaultBillCfg: BillCfg = {
  header: { showLogo: true, showAddress: true, showPhone: true, showTaxCode: false, showDateTime: true },
  body: { showTable: true, showGuestCount: true, showQuantity: true, showUnitPrice: true, showAmount: true, showTopping: true, showNote: false, showOrderNumber: true },
  footer: { showSubtotal: true, showVat: true, showDiscount: true, showServiceCharge: true, showTotal: true, showPaymentMethod: true, showCashier: true, thankYou: "Thank you!" },
};

function parseTplConfig(raw: string): { order: OrderCfg; bill: BillCfg } {
  try {
    const parsed = JSON.parse(raw) as Partial<{ _version: number; order: OrderCfg; bill: BillCfg }>;
    if (parsed._version === 2) {
      return {
        order: { ...defaultOrderCfg, ...parsed.order },
        bill: { ...defaultBillCfg, header: { ...defaultBillCfg.header, ...parsed.bill?.header }, body: { ...defaultBillCfg.body, ...parsed.bill?.body }, footer: { ...defaultBillCfg.footer, ...parsed.bill?.footer } },
      };
    }
  } catch {
    // Malformed config JSON — fall through to defaults
  }
  return { order: defaultOrderCfg, bill: defaultBillCfg };
}

// ======================== BUILD ORDER TICKET CONTENT (SIMPLE: SEQ + TABLE + ITEM x QTY) ========================

async function buildOrderContent(orderId: string, orderCfg: OrderCfg, sequence: number): Promise<string> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      table: { select: { name: true } },
      items: {
        where: { status: { not: "CANCELLED" } },
        include: {
          product: { select: { name: true, slug: true } },
          toppings: { include: { topping: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order) return "";

  const now = new Date();
  const lines: string[] = [];

  lines.push("\x1B\x40");

  if (orderCfg.showSequence) {
    lines.push("\x1B\x61\x01", "\x1B\x21\x30", `#${sequence}`, "\x1B\x21\x00", "\x1B\x61\x00");
  }

  if (orderCfg.showTable) lines.push(`Ban: ${order.table.name}`);
  if (orderCfg.showTime) lines.push(now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
  lines.push("------------------------");

  const foodItems = order.items.filter(i => !i.product.slug.startsWith("karaoke-"));
  for (const item of foodItems) {
    const prefix = orderCfg.showQuantity ? `  ${item.quantity}x ` : "  ";
    lines.push(prefix + item.product.name);
    if (orderCfg.showTopping && item.toppings.length > 0) {
      lines.push("    + " + item.toppings.map(t => t.topping.name).join(", "));
    }
  }

  if (orderCfg.showNote && order.note) {
    lines.push("------------------------", "* " + order.note);
  }

  lines.push("------------------------", "\n\n\n\n", "\x1D\x56\x00");

  return lines.join("\n");
}

// ======================== BUILD BILL CONTENT ========================

type BillItem = {
  quantity: number;
  unitPrice: number;
  product: { name: string; slug: string };
  toppings: { topping: { name: string } }[];
};

type BillOrderData = {
  orderNumber: number;
  orderNumberSuffix: string | null;
  guestCount: number;
  note: string | null;
  subtotal: number;
  vatAmount: number;
  exciseTaxAmount: number;
  discountAmount: number;
  serviceCharge: number;
  totalAmount: number;
  table: { name: string };
  items: BillItem[];
  payments: { method: string; amount: number }[];
  user: { name: string } | null;
};

type GenCfgData = { restaurantName?: string | null; address?: string | null; phone?: string | null; taxCode?: string | null } | null;

function pushBillHeader(lines: string[], cfg: BillCfg, genCfg: GenCfgData, now: Date): void {
  lines.push("\x1B\x40", "\x1B\x61\x01", "\x1B\x21\x10");
  if (cfg.header.showLogo) lines.push("🍽️");
  lines.push((genCfg?.restaurantName || "RESTAURANT").toUpperCase(), "\x1B\x21\x00");

  const addrParts: string[] = [];
  if (cfg.header.showAddress && genCfg?.address) addrParts.push(genCfg.address);
  if (cfg.header.showPhone && genCfg?.phone) addrParts.push("📞 " + genCfg.phone);
  if (addrParts.length > 0) lines.push(addrParts.join(" - "));
  if (cfg.header.showTaxCode && genCfg?.taxCode) lines.push("MST: " + genCfg.taxCode);
  if (cfg.header.showDateTime) lines.push(now.toLocaleDateString("vi-VN") + " " + now.toLocaleTimeString("vi-VN"));

  lines.push("\x1B\x61\x00", "========================================", "             HOA DON BAN HANG             ", "========================================");
}

function pushBillMeta(lines: string[], cfg: BillCfg, order: BillOrderData, now: Date): void {
  if (cfg.body.showOrderNumber) {
    lines.push(`So HD: #${String(order.orderNumber).padStart(4, "0")}${order.orderNumberSuffix ? "-" + order.orderNumberSuffix : ""}`);
  }
  if (cfg.body.showTable) lines.push(`Ban: ${order.table.name}`);
  if (cfg.body.showGuestCount) lines.push(`So khach: ${order.guestCount}`);
  lines.push("Ngay: " + now.toLocaleDateString("vi-VN") + " " + now.toLocaleTimeString("vi-VN"));
  if (order.user?.name) lines.push(`Thu ngan: ${order.user.name}`);
  lines.push("----------------------------------------");

  let colHeader = "Ten mon".padEnd(22);
  if (cfg.body.showQuantity) colHeader += "SL".padStart(4);
  if (cfg.body.showUnitPrice) colHeader += "DG".padStart(12);
  if (cfg.body.showAmount) colHeader += "TT".padStart(12);
  lines.push(colHeader, "----------------------------------------");
}

function pushBillItems(lines: string[], cfg: BillCfg, items: BillItem[]): void {
  for (const item of items) {
    lines.push(item.product.name);
    if (cfg.body.showTopping && item.toppings.length > 0) {
      lines.push("  + " + item.toppings.map(t => t.topping.name).join(", "));
    }
    const qty = cfg.body.showQuantity ? String(item.quantity) : "";
    const price = cfg.body.showUnitPrice ? fmt(item.unitPrice) : "";
    const amount = cfg.body.showAmount ? fmt(item.unitPrice * item.quantity) : "";
    if (qty || price || amount) lines.push(`${qty.padStart(3)}  ${price.padStart(12)}${amount.padStart(12)}`);
  }
  lines.push("----------------------------------------");
}

function pushBillTotals(lines: string[], cfg: BillCfg, order: BillOrderData): void {
  if (cfg.footer.showSubtotal) lines.push(`Tien hang:`.padEnd(28) + fmt(order.subtotal).padStart(18));
  if (cfg.footer.showVat && order.vatAmount > 0) lines.push(`Thue VAT:`.padEnd(28) + fmt(order.vatAmount).padStart(18));
  if (order.exciseTaxAmount > 0) lines.push(`Thue TTDB:`.padEnd(28) + fmt(order.exciseTaxAmount).padStart(18));
  if (cfg.footer.showDiscount && order.discountAmount > 0) lines.push(`Giam gia:`.padEnd(28) + ("-" + fmt(order.discountAmount)).padStart(18));
  if (cfg.footer.showServiceCharge && order.serviceCharge > 0) lines.push(`Phi dich vu:`.padEnd(28) + fmt(order.serviceCharge).padStart(18));

  lines.push("========================================");
  if (cfg.footer.showTotal) lines.push("\x1B\x21\x10", `TONG CONG:`.padEnd(28) + fmt(order.totalAmount).padStart(18), "\x1B\x21\x00");
  lines.push("========================================");
}

function pushBillFooter(lines: string[], cfg: BillCfg, order: BillOrderData): void {
  if (cfg.footer.showPaymentMethod && order.payments.length > 0) {
    lines.push("Thanh toan:");
    for (const p of order.payments) lines.push(`  ${p.method}: ${fmt(p.amount)}`);
  }
  if (cfg.footer.thankYou) lines.push("\x1B\x61\x01", cfg.footer.thankYou);
}

async function buildBillContent(orderId: string, billCfg: BillCfg): Promise<string> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      table: { select: { name: true } },
      items: {
        where: { status: { not: "CANCELLED" } },
        include: {
          product: { select: { name: true, slug: true } },
          toppings: { include: { topping: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      payments: { select: { method: true, amount: true } },
      user: { select: { name: true } },
    },
  });
  if (!order) return "";

  const genCfg = await db.generalConfig.findFirst({ where: { id: "default" } });
  const now = new Date();
  const lines: string[] = [];

  pushBillHeader(lines, billCfg, genCfg, now);
  pushBillMeta(lines, billCfg, order, now);
  pushBillItems(lines, billCfg, order.items);
  pushBillTotals(lines, billCfg, order);
  pushBillFooter(lines, billCfg, order);

  lines.push("\n\n\n\n", "\x1D\x56\x00");
  return lines.join("\n");
}

// ======================== BUILD TEMP BILL CONTENT ========================

async function buildTempBillContent(orderId: string, billCfg: BillCfg): Promise<string> {
  return buildBillContent(orderId, billCfg);
}

// ======================== TCP SEND TO PRINTER ========================

async function sendToPrinter(ip: string, port: number, content: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const client = new net.Socket();

    function finish(result: { success: boolean; error?: string }) {
      client.destroy();
      resolve(result);
    }

    const timeout = setTimeout(() => finish({ success: false, error: "Timeout connecting to printer" }), 5000);

    function onWrite(err?: Error | null) {
      if (err) {
        finish({ success: false, error: err.message });
      } else {
        // Give printer time to process
        setTimeout(() => finish({ success: true }), 500);
      }
    }

    client.connect(port, ip, () => {
      clearTimeout(timeout);
      client.write(content, "utf-8", onWrite);
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      finish({ success: false, error: err.message });
    });
  });
}

// ======================== CREATE PRINT JOB ========================

export async function createPrintJob(params: {
  orderId: string;
  type: "ORDER" | "TEMP_BILL" | "BILL";
  userId?: string;
}): Promise<{ success: boolean; jobId?: string; content?: string; error?: string }> {
  const { orderId, type, userId } = params;

  // Get order + area
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { table: { select: { areaId: true } } },
  });
  if (!order) return { success: false, error: "Order not found" };

  const areaId = order.table.areaId;

  // Find printer
  let printer = await db.printer.findFirst({
    where: {
      isActive: true,
      areas: { some: { areaId } },
      type: type === "ORDER" ? { in: ["KITCHEN", "BAR"] } : "BILL",
    },
    include: { printTemplates: { where: { type, isDefault: true } } },
  });

  if (!printer) {
    printer = await db.printer.findFirst({
      where: { isActive: true, type: type === "ORDER" ? { in: ["KITCHEN", "BAR"] } : "BILL" },
      include: { printTemplates: { where: { type, isDefault: true } } },
    });
  }

  if (!printer) {
    return { success: false, error: "No active printer found" };
  }

  const template = printer.printTemplates[0] || null;
  const { order: orderCfg, bill: billCfg } = parseTplConfig(template?.config || "{}");

  // Get sequence number for today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const count = await db.printJob.count({
    where: { type, createdAt: { gte: todayStart } },
  });
  const sequence = count + 1;

  // Build content based on type
  let content: string;
  if (type === "ORDER") {
    content = await buildOrderContent(orderId, orderCfg, sequence);
  } else if (type === "BILL") {
    content = await buildBillContent(orderId, billCfg);
  } else {
    content = await buildTempBillContent(orderId, billCfg);
  }

  // Send to printer based on mode
  let result: { success: boolean; error?: string };
  if (printer.printMode === "SERVER") {
    result = await sendToPrinter(printer.ipAddress, printer.port, content);
  } else {
    // CLIENT mode: don't send TCP, just build content for client to print
    result = { success: true };
  }

  // Save job
  const job = await db.printJob.create({
    data: {
      sequence,
      type,
      status: result.success ? "SUCCESS" : "FAILED",
      orderId,
      printerId: printer.id,
      templateId: template?.id,
      content,
      error: result.error,
      userId: userId || null,
    },
  });

  return { success: result.success, jobId: job.id, content: printer.printMode === "CLIENT" ? content : undefined, error: result.error };
}

// ======================== GET PRINT JOBS ========================

export async function getPrintJobs(date?: string, type?: string) {
  const where: Prisma.PrintJobWhereInput = {};
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { gte: start, lte: end };
  }
  if (type) where.type = type;

  return db.printJob.findMany({
    where,
    include: {
      printer: { select: { name: true } },
      template: { select: { name: true } },
      user: { select: { name: true } },
      order: { select: { orderNumber: true, orderNumberSuffix: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getPrintJobStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [orderCount, billCount, failedCount, totalToday] = await Promise.all([
    db.printJob.count({ where: { type: "ORDER", createdAt: { gte: today }, status: "SUCCESS" } }),
    db.printJob.count({ where: { type: { in: ["BILL", "TEMP_BILL"] }, createdAt: { gte: today }, status: "SUCCESS" } }),
    db.printJob.count({ where: { createdAt: { gte: today }, status: "FAILED" } }),
    db.printJob.count({ where: { createdAt: { gte: today } } }),
  ]);

  return { orderCount, billCount, failedCount, totalToday };
}
