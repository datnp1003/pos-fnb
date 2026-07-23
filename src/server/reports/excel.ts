"use server";

import ExcelJS from "exceljs";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(n || 0);
}

// ─── Style helpers ───

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF59E0B" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF000000" }, size: 11 };
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 16, color: { argb: "FFD97706" } };
const SUBTITLE_FONT: Partial<ExcelJS.Font> = { bold: false, size: 11, color: { argb: "FF6B7280" } };
const SECTION_FONT: Partial<ExcelJS.Font> = { bold: true, size: 12, color: { argb: "FFD97706" } };
const DATA_FONT: Partial<ExcelJS.Font> = { size: 10 };
const AMOUNT_FONT: Partial<ExcelJS.Font> = { size: 10, bold: true };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

function addTitle(ws: ExcelJS.Worksheet, title: string) {
  ws.mergeCells("A1:L1");
  const cell = ws.getCell("A1");
  cell.value = title;
  cell.font = TITLE_FONT;
  cell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;
}

function addSubtitle(ws: ExcelJS.Worksheet, subtitle: string, row: number = 2) {
  ws.mergeCells(`A${row}:L${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = subtitle;
  cell.font = SUBTITLE_FONT;
  cell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(row).height = 22;
}

function addSection(ws: ExcelJS.Worksheet, label: string, row: number, col: number) {
  const cell = ws.getCell(row, col);
  cell.value = label;
  cell.font = SECTION_FONT;
  cell.alignment = { vertical: "middle" };
  ws.getRow(row).height = 24;
}

function addHeaderRow(ws: ExcelJS.Worksheet, headers: string[], row: number) {
  ws.getRow(row).height = 28;
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = BORDER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
}

function addDataRow(ws: ExcelJS.Worksheet, values: (string | number)[], row: number, startCol: number = 1) {
  values.forEach((v, i) => {
    const cell = ws.getCell(row, startCol + i);
    cell.value = v;
    cell.font = typeof v === "number" ? AMOUNT_FONT : DATA_FONT;
    cell.border = BORDER;
    cell.alignment = { vertical: "middle", horizontal: typeof v === "number" ? "right" : "left" };
    if (typeof v === "number") cell.numFmt = "#,##0";
  });
}

// Escreve pares "rótulo: valor" em duas colunas (col 1 rótulo em negrito, col 2 valor).
// Retorna o próximo `row` livre. Mantém o mesmo estilo dos blocos inline anteriores.
function addSummaryRows(
  ws: ExcelJS.Worksheet,
  rows: ReadonlyArray<ReadonlyArray<string | number>>,
  startRow: number,
): number {
  let row = startRow;
  rows.forEach(([k, v]) => {
    ws.getCell(row, 1).value = k;
    ws.getCell(row, 1).font = { bold: true, size: 10 };
    ws.getCell(row, 2).value = v;
    ws.getCell(row, 2).font = AMOUNT_FONT;
    row++;
  });
  return row;
}

function colWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

// ======================== ROW / SUMMARY TYPES ========================
// Structural subsets of the report query results — callers may pass richer objects.

type Dateish = string | Date;
type Money = Record<string, number>;

interface InvoiceRow {
  orderNumber: string | number; orderNumberSuffix?: string | number | null;
  table: string; guestCount: number; type: string; staff: string;
  subtotal: number; vatAmount: number; exciseTaxAmount: number; discountAmount: number;
  serviceCharge: number; totalAmount: number; paymentMethods: string; items: string;
  closedAt?: Dateish | null;
}
interface InvoiceSummary {
  totalOrders: number; totalRevenue: number; totalSubtotal: number; totalVat: number;
  totalExciseTax: number; totalDiscount: number; totalServiceCharge: number;
}
interface SoldItemRow {
  productName: string; category: string; quantity: number; unitPrice: number;
  toppings?: string | null; totalAmount: number; orderNumber: string | number; table: string; closedAt?: Dateish | null;
}
interface SoldByProduct { name: string; category: string; quantity: number; revenue: number; }
interface SoldSummary { totalItems: number; totalQuantity: number; totalRevenue: number; }
interface RevenueDay {
  date: Dateish; orders: number; subtotal: number; vat: number; excise: number;
  discount: number; service: number; revenue: number; normalCount?: number; compCount?: number;
  [key: string]: unknown;
}
interface RevenueSummary extends InvoiceSummary {
  totalOtherIncome: number; totalExpenses: number; profit: number; byPaymentMethod: Money;
}
interface StockInItem { ingredient: { name: string }; quantity: number; unitPrice: number; totalPrice: number; }
interface StockInRow { code: string; createdAt: Dateish; supplier?: string | null; user?: { name?: string | null } | null; items: StockInItem[]; [key: string]: unknown; }
interface StockOutBatch { quantity: number; unitCost: number; batch?: { batchCode?: string | null } | null; }
interface StockOutRow {
  createdAt: Dateish; ingredient?: { name?: string | null } | null; quantity: number; reason: string;
  totalCost?: number | null; batches?: StockOutBatch[]; user?: { name?: string | null } | null; note?: string | null;
}
interface IngredientRow {
  name: string; purchaseUnit?: string; baseUnit: string; conversionFactor?: number;
  currentStock: number; minStock: number; costPerBaseUnit: number;
  recipes?: { product: { name: string } }[]; supplier?: string | null;
  [key: string]: unknown;
}
interface StockInSummary { totalStockIns: number; totalItems: number; totalAmount: number; [key: string]: unknown; }
interface StockOutSummary { totalStockOuts: number; totalQuantity: number; totalCost?: number; }
interface WarehouseSummary {
  totalIngredients: number; totalStockValue: number; totalProducts: number; totalCategories: number;
  totalSuppliers: number; lowStockCount: number; outOfStockCount: number;
}
interface LowStockRow { name: string; currentStock: number; minStock: number; baseUnit: string; supplier?: string | null; }
interface BatchRow {
  ingredient?: { name?: string | null; baseUnit?: string | null } | null;
  batchCode?: string | null; stockInItem?: { stockIn?: { code?: string | null; supplier?: string | null } | null } | null;
  receivedAt: Dateish; remainingQuantity: number; unitCost: number;
}

// ======================== EXPORT FUNCTIONS ========================

export async function exportInvoicesToExcel(invoices: InvoiceRow[], summary: InvoiceSummary, dateFrom: string, dateTo: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Invoices");

  const d1 = new Date(dateFrom).toLocaleDateString("vi-VN");
  const d2 = new Date(dateTo).toLocaleDateString("vi-VN");
  addTitle(ws, "INVOICE REPORT");
  addSubtitle(ws, `From ${d1} to ${d2}`);

  // Summary
  let row = 4;
  addSection(ws, "📊 OVERVIEW", row, 1); row++;
  const summaryData = [
    ["Total Orders:", summary.totalOrders],
    ["Total Revenue:", `${fmt(summary.totalRevenue)}`],
    ["Total Subtotal:", `${fmt(summary.totalSubtotal)}`],
    ["Total VAT:", `${fmt(summary.totalVat)}`],
    ["Total Excise Tax:", `${fmt(summary.totalExciseTax)}`],
    ["Total Discount:", `${fmt(summary.totalDiscount)}`],
    ["Total Service Charge:", `${fmt(summary.totalServiceCharge)}`],
  ];
  row = addSummaryRows(ws, summaryData, row);
  row++;

  // Table
  addSection(ws, "📋 INVOICE LIST", row, 1); row++;
  const headers = ["Order #", "Table", "Guests", "Type", "Staff", "Subtotal", "VAT", "Excise", "Discount", "Service", "Total", "Pay Method", "Items", "Closed Date"];
  addHeaderRow(ws, headers, row); row++;

  invoices.forEach((inv) => {
    addDataRow(ws, [
      `${inv.orderNumber}${inv.orderNumberSuffix ? "-" + inv.orderNumberSuffix : ""}`,
      inv.table,
      inv.guestCount,
      inv.type === "COMP" ? "Complimentary" : "Normal",
      inv.staff,
      inv.subtotal,
      inv.vatAmount,
      inv.exciseTaxAmount,
      inv.discountAmount,
      inv.serviceCharge,
      inv.totalAmount,
      inv.paymentMethods,
      inv.items,
      inv.closedAt ? new Date(inv.closedAt).toLocaleDateString("vi-VN") : "",
    ], row);
    row++;
  });

  colWidths(ws, [10, 10, 8, 8, 14, 14, 14, 14, 14, 14, 16, 24, 36, 14]);

  const buf = await wb.xlsx.writeBuffer();
  return buf;
}

export async function exportSoldItemsToExcel(items: SoldItemRow[], byProduct: SoldByProduct[], summary: SoldSummary, dateFrom: string, dateTo: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sold Items");

  const d1 = new Date(dateFrom).toLocaleDateString("vi-VN");
  const d2 = new Date(dateTo).toLocaleDateString("vi-VN");
  addTitle(ws, "SOLD ITEMS REPORT");
  addSubtitle(ws, `From ${d1} to ${d2}`);

  let row = 4;
  addSection(ws, "📊 OVERVIEW", row, 1); row++;
  const summaryData = [
    ["Total Lines Sold:", summary.totalItems],
    ["Total Quantity:", summary.totalQuantity],
    ["Total Revenue:", `${fmt(summary.totalRevenue)}`],
  ];
  summaryData.forEach(([k, v]) => { ws.getCell(row, 1).value = k; ws.getCell(row, 1).font = { bold: true, size: 10 }; ws.getCell(row, 2).value = v; ws.getCell(row, 2).font = AMOUNT_FONT; row++; });
  row++;

  // By product
  addSection(ws, "📋 BY PRODUCT", row, 1); row++;
  const prodHeaders = ["#", "Product", "Category", "Qty Sold", "Revenue"];
  addHeaderRow(ws, prodHeaders, row); row++;
  byProduct.forEach((p, i) => {
    addDataRow(ws, [i + 1, p.name, p.category, p.quantity, p.revenue], row);
    row++;
  });
  row++;

  // Detail
  addSection(ws, "📋 ITEM DETAIL", row, 1); row++;
  const detailHeaders = ["Item", "Category", "Qty", "Unit Price", "Topping", "Amount", "Order", "Table", "Date"];
  addHeaderRow(ws, detailHeaders, row); row++;
  items.forEach((it) => {
    addDataRow(ws, [
      it.productName, it.category, it.quantity, it.unitPrice,
      it.toppings || "—", it.totalAmount, it.orderNumber, it.table,
      it.closedAt ? new Date(it.closedAt).toLocaleDateString("vi-VN") : "",
    ], row);
    row++;
  });

  colWidths(ws, [20, 14, 8, 14, 20, 16, 12, 8, 14]);

  const buf = await wb.xlsx.writeBuffer();
  return buf;
}

export async function exportRevenueToExcel(days: RevenueDay[], summary: RevenueSummary, expensesByCategory: Money, incomeByCategory: Money, dateFrom: string, dateTo: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Revenue");

  const d1 = new Date(dateFrom).toLocaleDateString("vi-VN");
  const d2 = new Date(dateTo).toLocaleDateString("vi-VN");
  addTitle(ws, "REVENUE REPORT");
  addSubtitle(ws, `From ${d1} to ${d2}`);

  let row = 4;
  addSection(ws, "📊 OVERVIEW", row, 1); row++;
  const summaryData = [
    ["Total Orders:", summary.totalOrders],
    ["Total Sales Revenue:", `${fmt(summary.totalRevenue)}`],
    ["Total Subtotal:", `${fmt(summary.totalSubtotal)}`],
    ["Total VAT:", `${fmt(summary.totalVat)}`],
    ["Total Excise Tax:", `${fmt(summary.totalExciseTax)}`],
    ["Total Discount:", `${fmt(summary.totalDiscount)}`],
    ["Total Service Charge:", `${fmt(summary.totalServiceCharge)}`],
    ["Total Other Income:", `${fmt(summary.totalOtherIncome)}`],
    ["Total Expenses:", `${fmt(summary.totalExpenses)}`],
    ["Profit:", `${fmt(summary.profit)}`],
  ];
  row = addSummaryRows(ws, summaryData, row);
  row++;

  // Payment methods
  if (Object.keys(summary.byPaymentMethod).length > 0) {
    addSection(ws, "💳 BY PAYMENT METHOD", row, 1); row++;
    row = addSummaryRows(
      ws,
      Object.entries(summary.byPaymentMethod).map(
        ([method, amount]) => [method, `${fmt(amount)}`] as const,
      ),
      row,
    );
    row++;
  }

  // Daily breakdown
  addSection(ws, "📅 DAILY REVENUE", row, 1); row++;
  const dayHeaders = ["Date", "Invoices", "Subtotal", "VAT", "Excise Tax", "Discount", "Service Charge", "Revenue", "Normal", "Complimentary"];
  addHeaderRow(ws, dayHeaders, row); row++;
  days.forEach((d) => {
    addDataRow(ws, [
      new Date(d.date).toLocaleDateString("vi-VN"), d.orders, d.subtotal, d.vat, d.excise,
      d.discount, d.service, d.revenue, d.normalCount ?? 0, d.compCount ?? 0,
    ], row);
    row++;
  });
  row++;

  // Expenses
  if (Object.keys(expensesByCategory).length > 0) {
    addSection(ws, "📉 EXPENSE BY CATEGORY", row, 1); row++;
    row = addSummaryRows(
      ws,
      Object.entries(expensesByCategory).map(
        ([cat, amount]) => [cat, `${fmt(amount)}`] as const,
      ),
      row,
    );
  }

  colWidths(ws, [14, 10, 14, 14, 14, 14, 14, 16, 8, 8]);

  const buf = await wb.xlsx.writeBuffer();
  return buf;
}

export async function exportIngredientsToExcel(stockIns: StockInRow[], stockOuts: StockOutRow[], stockInSummary: StockInSummary, stockOutSummary: StockOutSummary, ingredients: IngredientRow[], dateFrom: string, dateTo: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ingredients");

  const d1 = new Date(dateFrom).toLocaleDateString("vi-VN");
  const d2 = new Date(dateTo).toLocaleDateString("vi-VN");
  addTitle(ws, "INGREDIENT REPORT");
  addSubtitle(ws, `From ${d1} to ${d2}`);

  let row = 4;
  addSection(ws, "📊 STOCK IN OVERVIEW", row, 1); row++;
  const inSummary = [
    ["Total Stock Ins:", stockInSummary.totalStockIns],
    ["Total Items In:", stockInSummary.totalItems],
    ["Total Stock In Value:", `${fmt(stockInSummary.totalAmount)}`],
  ];
  row = addSummaryRows(ws, inSummary, row);
  row++;

  addSection(ws, "📊 STOCK OUT OVERVIEW", row, 1); row++;
  const outSummary = [
    ["Total Stock Outs:", stockOutSummary.totalStockOuts],
    ["Total Qty Out:", stockOutSummary.totalQuantity],
    ["FIFO Cost Out:", `${fmt(stockOutSummary.totalCost || 0)}`],
  ];
  row = addSummaryRows(ws, outSummary, row);
  row++;

  // Stock In table
  addSection(ws, "📥 STOCK IN DETAIL", row, 1); row++;
  const inHeaders = ["Ref #", "Date In", "Supplier", "Ingredient", "Qty", "Unit Price", "Total", "Staff"];
  addHeaderRow(ws, inHeaders, row); row++;
  stockIns.forEach((si) => {
    si.items.forEach((item, idx) => {
      const date = new Date(si.createdAt).toLocaleDateString("vi-VN");
      addDataRow(ws, [
        idx === 0 ? si.code : "",
        idx === 0 ? date : "",
        idx === 0 ? (si.supplier || "—") : "",
        item.ingredient.name,
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        idx === 0 ? (si.user?.name || "—") : "",
      ], row);
      row++;
    });
    if (si.items.length === 0) {
      addDataRow(ws, [si.code, new Date(si.createdAt).toLocaleDateString("vi-VN"), si.supplier || "—", "(no items)", 0, 0, 0, si.user?.name || "—"], row);
      row++;
    }
  });
  row++;

  // Stock Out table
  addSection(ws, "📤 STOCK OUT DETAIL", row, 1); row++;
  const outHeaders = ["Date Out", "Ingredient", "Quantity", "Reason", "FIFO Cost", "Batch Layers", "Staff", "Note"];
  addHeaderRow(ws, outHeaders, row); row++;
  stockOuts.forEach((so) => {
    const layers = so.batches?.map((b) => `${b.quantity} @ ${fmt(b.unitCost)} (${b.batch?.batchCode || "batch"})`).join("; ") || "";
    addDataRow(ws, [
      new Date(so.createdAt).toLocaleDateString("vi-VN"),
      so.ingredient?.name || "—",
      so.quantity,
      so.reason,
      so.totalCost || 0,
      layers,
      so.user?.name || "—",
      so.note || "",
    ], row);
    row++;
  });
  row++;

  // Current stock status
  addSection(ws, "📦 CURRENT STOCK", row, 1); row++;
  const invHeaders = ["Name", "Purchase Unit", "Base Unit", "Conv Factor", "Stock", "Min", "Cost", "Stock Value", "Used In"];
  addHeaderRow(ws, invHeaders, row); row++;
  ingredients.forEach((ing) => {
    addDataRow(ws, [
      ing.name,
      ing.purchaseUnit ?? "",
      ing.baseUnit,
      ing.conversionFactor ?? 0,
      ing.currentStock,
      ing.minStock,
      ing.costPerBaseUnit,
      ing.currentStock * ing.costPerBaseUnit,
      ing.recipes?.map((r) => r.product.name).join(", ") || "—",
    ], row);
    row++;
  });

  colWidths(ws, [14, 12, 16, 18, 10, 14, 14, 14, 14, 14, 14, 14, 14, 24]);

  const buf = await wb.xlsx.writeBuffer();
  return buf;
}

export async function exportWarehouseToExcel(ingredients: IngredientRow[], summary: WarehouseSummary, lowStock: LowStockRow[], outOfStock: LowStockRow[], batches: BatchRow[] = []) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Warehouse");

  addTitle(ws, "WAREHOUSE REPORT");
  addSubtitle(ws, `Updated: ${new Date().toLocaleDateString("vi-VN")} ${new Date().toLocaleTimeString("vi-VN")}`);

  let row = 4;
  addSection(ws, "📊 WAREHOUSE OVERVIEW", row, 1); row++;
  const summaryData = [
    ["Total Ingredients:", summary.totalIngredients],
    ["Total Stock Value:", `${fmt(summary.totalStockValue)}`],
    ["Total Products:", summary.totalProducts],
    ["Total Categories:", summary.totalCategories],
    ["Total Suppliers:", summary.totalSuppliers],
    ["Below Min Stock:", summary.lowStockCount],
    ["Out of Stock:", summary.outOfStockCount],
  ];
  row = addSummaryRows(ws, summaryData, row);
  row++;

  // Low stock alerts
  if (lowStock.length > 0) {
    addSection(ws, "⚠️ LOW STOCK INGREDIENTS", row, 1); row++;
    const lowHeaders = ["Name", "Stock", "Min", "Base Unit", "Supplier"];
    addHeaderRow(ws, lowHeaders, row); row++;
    lowStock.forEach((i) => {
      addDataRow(ws, [i.name, i.currentStock, i.minStock, i.baseUnit, i.supplier || "—"], row);
      row++;
    });
    row++;
  }

  if (outOfStock.length > 0) {
    addSection(ws, "🚫 OUT OF STOCK", row, 1); row++;
    const outHeaders = ["Name", "Stock", "Min", "Base Unit", "Supplier"];
    addHeaderRow(ws, outHeaders, row); row++;
    outOfStock.forEach((i) => {
      addDataRow(ws, [i.name, i.currentStock, i.minStock, i.baseUnit, i.supplier || "—"], row);
      row++;
    });
    row++;
  }

  // FIFO batch valuation
  if (batches.length > 0) {
    addSection(ws, "📚 FIFO BATCH BALANCE", row, 1); row++;
    const batchHeaders = ["Ingredient", "Batch", "Date In", "Supplier", "Qty Left", "Unit", "Unit Cost", "Stock Value"];
    addHeaderRow(ws, batchHeaders, row); row++;
    batches.forEach((b) => {
      addDataRow(ws, [
        b.ingredient?.name || "—",
        b.batchCode || b.stockInItem?.stockIn?.code || "—",
        new Date(b.receivedAt).toLocaleDateString("vi-VN"),
        b.stockInItem?.stockIn?.supplier || "—",
        b.remainingQuantity,
        b.ingredient?.baseUnit || "",
        b.unitCost,
        b.remainingQuantity * b.unitCost,
      ], row);
      row++;
    });
    row++;
  }

  // All ingredients
  addSection(ws, "📦 ALL INGREDIENTS", row, 1); row++;
  const invHeaders = ["Name", "Purchase Unit", "Base Unit", "Conv Factor", "Stock", "Min", "Cost / Base Unit", "Stock Value", "Used In", "Supplier"];
  addHeaderRow(ws, invHeaders, row); row++;
  ingredients.forEach((ing) => {
    addDataRow(ws, [
      ing.name,
      ing.purchaseUnit ?? "",
      ing.baseUnit,
      ing.conversionFactor ?? 0,
      ing.currentStock,
      ing.minStock,
      ing.costPerBaseUnit,
      ing.currentStock * ing.costPerBaseUnit,
      ing.recipes?.map((r) => r.product.name).join(", ") || "—",
      ing.supplier || "—",
    ], row);
    row++;
  });

  colWidths(ws, [18, 12, 12, 10, 10, 10, 16, 14, 30, 16]);

  const buf = await wb.xlsx.writeBuffer();
  return buf;
}
