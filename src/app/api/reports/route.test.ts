import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import * as reports from "@/server/reports/actions";
import * as excel from "@/server/reports/excel";
import { GET } from "./route";

vi.mock("@/server/reports/actions");
vi.mock("@/server/reports/excel");

function req(qs: string) {
  return new NextRequest(`http://localhost/api/reports${qs}`);
}

beforeEach(() => {
  vi.mocked(reports.getRevenueReport).mockResolvedValue({
    days: [], summary: {}, expensesByCategory: [], incomeByCategory: [], dateFrom: new Date(), dateTo: new Date(),
  } as never);
  vi.mocked(reports.getInvoiceReport).mockResolvedValue({
    orders: [], summary: {}, dateFrom: new Date(), dateTo: new Date(),
  } as never);
  vi.mocked(reports.getSoldItemsReport).mockResolvedValue({
    items: [], byProduct: [], summary: {}, dateFrom: new Date(), dateTo: new Date(),
  } as never);
  vi.mocked(reports.getIngredientReport).mockResolvedValue({
    stockIns: [], stockOuts: [], stockInSummary: {}, stockOutSummary: {}, ingredients: [], dateFrom: new Date(), dateTo: new Date(),
  } as never);
  vi.mocked(reports.getWarehouseReport).mockResolvedValue({
    ingredients: [], summary: {}, lowStock: [], outOfStock: [], batches: [],
  } as never);
  const buf = new Uint8Array([1, 2, 3]);
  vi.mocked(excel.exportRevenueToExcel).mockResolvedValue(buf as never);
  vi.mocked(excel.exportInvoicesToExcel).mockResolvedValue(buf as never);
  vi.mocked(excel.exportSoldItemsToExcel).mockResolvedValue(buf as never);
  vi.mocked(excel.exportIngredientsToExcel).mockResolvedValue(buf as never);
  vi.mocked(excel.exportWarehouseToExcel).mockResolvedValue(buf as never);
});

describe("GET /api/reports", () => {
  it.each([
    ["?type=revenue", reports.getRevenueReport],
    ["?type=invoices", reports.getInvoiceReport],
    ["?type=sold-items", reports.getSoldItemsReport],
    ["?type=ingredients", reports.getIngredientReport],
    ["?type=warehouse", reports.getWarehouseReport],
  ])("returns an xlsx response for %s", async (qs, fn) => {
    const res = await GET(req(qs));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(fn).toHaveBeenCalled();
  });

  it("defaults to revenue when type omitted", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(200);
    expect(reports.getRevenueReport).toHaveBeenCalled();
  });

  it("returns 400 for unknown type", async () => {
    const res = await GET(req("?type=bogus"));
    expect(res.status).toBe(400);
  });

  it("returns 500 when generation throws", async () => {
    vi.mocked(reports.getRevenueReport).mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("?type=revenue"));
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
