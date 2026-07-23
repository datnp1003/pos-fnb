import { NextRequest, NextResponse } from "next/server";
import { getInvoiceReport, getSoldItemsReport, getRevenueReport, getIngredientReport, getWarehouseReport } from "@/server/reports/actions";
import { exportInvoicesToExcel, exportSoldItemsToExcel, exportRevenueToExcel, exportIngredientsToExcel, exportWarehouseToExcel } from "@/server/reports/excel";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "revenue";
  const mode = searchParams.get("mode") || "day";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  let buffer: Buffer;
  let filename: string;

  try {
    switch (type) {
      case "invoices": {
        const { orders, summary, dateFrom, dateTo } = await getInvoiceReport(mode, date, startDate, endDate);
        buffer = Buffer.from(await exportInvoicesToExcel(orders, summary, dateFrom, dateTo));
        filename = `bao-cao-hoa-don-${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;
      }
      case "sold-items": {
        const { items, byProduct, summary, dateFrom, dateTo } = await getSoldItemsReport(mode, date, startDate, endDate);
        buffer = Buffer.from(await exportSoldItemsToExcel(items, byProduct, summary, dateFrom, dateTo));
        filename = `bao-cao-hang-da-ban-${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;
      }
      case "revenue": {
        const { days, summary, expensesByCategory, incomeByCategory, dateFrom, dateTo } = await getRevenueReport(mode, date, startDate, endDate);
        buffer = Buffer.from(await exportRevenueToExcel(days, summary, expensesByCategory, incomeByCategory, dateFrom, dateTo));
        filename = `bao-cao-doanh-thu-${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;
      }
      case "ingredients": {
        const { stockIns, stockOuts, stockInSummary, stockOutSummary, ingredients, dateFrom, dateTo } = await getIngredientReport(mode, date, startDate, endDate);
        buffer = Buffer.from(await exportIngredientsToExcel(stockIns, stockOuts, stockInSummary, stockOutSummary, ingredients, dateFrom, dateTo));
        filename = `bao-cao-nguyen-lieu-${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;
      }
      case "warehouse": {
        const { ingredients, summary, lowStock, outOfStock, batches } = await getWarehouseReport();
        buffer = Buffer.from(await exportWarehouseToExcel(ingredients, summary, lowStock, outOfStock, batches));
        filename = `bao-cao-kho-${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
    }

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
