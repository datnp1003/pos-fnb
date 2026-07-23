import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, userEvent } from "@/test/render";
import { getDailyReport, getTopProducts } from "@/server/inventory/actions";
import {
  getIngredientReport,
  getInvoiceReport,
  getRevenueReport,
  getSoldItemsReport,
  getWarehouseReport,
} from "@/server/reports/actions";
import { ReportsClient, ReportsClientWrapper } from "./reports-client";

vi.mock("@/server/reports/actions", () => ({
  getInvoiceReport: vi.fn(),
  getSoldItemsReport: vi.fn(),
  getRevenueReport: vi.fn(),
  getIngredientReport: vi.fn(),
  getWarehouseReport: vi.fn(),
}));

vi.mock("@/server/inventory/actions", () => ({
  getDailyReport: vi.fn(),
  getTopProducts: vi.fn(),
}));

const getDailyReportMock = vi.mocked(getDailyReport);
const getTopProductsMock = vi.mocked(getTopProducts);
const getInvoiceReportMock = vi.mocked(getInvoiceReport);
const getSoldItemsReportMock = vi.mocked(getSoldItemsReport);
const getRevenueReportMock = vi.mocked(getRevenueReport);
const getIngredientReportMock = vi.mocked(getIngredientReport);
const getWarehouseReportMock = vi.mocked(getWarehouseReport);

function mockReportData() {
  getDailyReportMock.mockResolvedValue({
    revenue: 120000,
    orders: 3,
    totalExpense: 40000,
    profit: 80000,
    vatTotal: 8000,
    exciseTaxTotal: 2000,
    paymentMethods: { CASH: 70000, CARD: 50000 },
  } as never);
  getTopProductsMock.mockResolvedValue([{ name: "Coffee", quantity: 4, revenue: 100000 }] as never);
  getInvoiceReportMock.mockResolvedValue({
    summary: {
      totalOrders: 1,
      totalSubtotal: 100000,
      totalVat: 8000,
      totalExciseTax: 2000,
      totalRevenue: 110000,
    },
    orders: [{
      orderNumber: 7,
      orderNumberSuffix: "A",
      table: "T1",
      guestCount: 2,
      staff: "Admin",
      subtotal: 100000,
      vatAmount: 8000,
      exciseTaxAmount: 2000,
      discountAmount: 0,
      serviceCharge: 0,
      totalAmount: 110000,
      paymentMethods: "CASH",
      closedAt: new Date("2026-06-17T12:00:00Z"),
    }],
  } as never);
  getSoldItemsReportMock.mockResolvedValue({
    summary: { totalItems: 1, totalQuantity: 4, totalRevenue: 100000 },
    byProduct: [{ name: "Coffee", category: "Drinks", quantity: 4, revenue: 100000 }],
    items: [{
      productName: "Coffee",
      toppings: "Milk",
      quantity: 2,
      unitPrice: 25000,
      totalAmount: 50000,
      orderNumber: 7,
      table: "T1",
    }],
  } as never);
  getRevenueReportMock.mockResolvedValue({
    summary: {
      totalRevenue: 120000,
      totalSubtotal: 100000,
      totalVat: 8000,
      totalExciseTax: 2000,
      totalExpenses: 30000,
      profit: 90000,
      byPaymentMethod: { CASH: 120000 },
    },
    expensesByCategory: { Supplies: 30000 },
    days: [{
      date: "2026-06-17",
      orders: 3,
      subtotal: 100000,
      vat: 8000,
      excise: 2000,
      discount: 0,
      service: 10000,
      revenue: 120000,
    }],
  } as never);
  getIngredientReportMock.mockResolvedValue({
    stockInSummary: { totalStockIns: 1, totalAmount: 50000, bySupplier: { Farm: 50000 } },
    stockOutSummary: { totalStockOuts: 1, totalQuantity: 3, byReason: { WASTE: 3 } },
    stockIns: [{
      id: "si-1",
      code: "SI-001",
      createdAt: new Date("2026-06-17T09:00:00Z"),
      supplier: "Farm",
      items: [{ ingredient: { name: "Milk" }, quantity: 3, unitPrice: 10000, totalPrice: 30000 }],
    }],
    stockOuts: [{
      id: "so-1",
      createdAt: new Date("2026-06-17T10:00:00Z"),
      ingredient: { name: "Milk" },
      quantity: 1,
      reason: "WASTE",
      user: { name: "Admin" },
      note: "spilled",
    }],
    ingredients: [{
      id: "ing-1",
      name: "Milk",
      purchaseUnit: "box",
      baseUnit: "ml",
      conversionFactor: 1000,
      currentStock: 2,
      minStock: 5,
      costPerBaseUnit: 10,
      recipes: [{ product: { name: "Coffee" } }],
    }],
  } as never);
  getWarehouseReportMock.mockResolvedValue({
    summary: { totalIngredients: 2, totalStockValue: 20000, totalProducts: 4, totalSuppliers: 1 },
    lowStock: [{ id: "ing-1", name: "Milk", currentStock: 2, baseUnit: "ml" }],
    outOfStock: [{ id: "ing-2", name: "Sugar" }],
    ingredients: [{
      id: "ing-1",
      name: "Milk",
      purchaseUnit: "box",
      baseUnit: "ml",
      conversionFactor: 1000,
      currentStock: 2,
      minStock: 5,
      costPerBaseUnit: 10,
      recipes: [{ product: { name: "Coffee" } }],
      supplier: "Farm",
    }],
  } as never);
}

describe("ReportsClient", () => {
  it("renders overview totals and wrapper", async () => {
    mockReportData();

    const { container } = renderWithProviders(<ReportsClientWrapper today="2026-06-17" />);

    expect(container.firstChild).toBeTruthy();
    expect(await screen.findByText("Coffee")).toBeInTheDocument();
    expect(screen.getByText("120.000đ")).toBeInTheDocument();
    expect(screen.getByText("CASH")).toBeInTheDocument();
    expect(getDailyReportMock).toHaveBeenCalledWith("2026-06-17");
  });

  it("loads invoice report and exports with date params", async () => {
    mockReportData();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();

    renderWithProviders(<ReportsClient today="2026-06-17" />);
    await user.click(screen.getByRole("tab", { name: "Hóa đơn" }));

    expect(await screen.findByText("7-A")).toBeInTheDocument();
    expect(screen.getAllByText(/110.000/).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Xuất Excel Hóa đơn/ }));

    expect(openSpy).toHaveBeenCalledWith("/api/reports?type=invoices&mode=day&date=2026-06-17", "_blank");
  });

  it("switches across sold, revenue, ingredient, and warehouse reports", async () => {
    mockReportData();
    const user = userEvent.setup();

    renderWithProviders(<ReportsClient today="2026-06-17" />);

    await user.click(screen.getByRole("tab", { name: "Hàng đã bán" }));
    expect(await screen.findByText(/Milk/)).toBeInTheDocument();
    expect(getSoldItemsReportMock).toHaveBeenCalledWith("day", "2026-06-17", "2026-06-17", "2026-06-17");

    await user.click(screen.getByRole("tab", { name: "Doanh thu" }));
    expect(await screen.findByText("Supplies")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Nguyên liệu" }));
    expect(await screen.findByText("SI-001")).toBeInTheDocument();
    expect(screen.getAllByText("WASTE").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: "Kho" }));
    await waitFor(() => expect(getWarehouseReportMock).toHaveBeenCalled());
    expect(screen.getAllByText(/Milk/).length).toBeGreaterThan(0);
    expect(screen.getByText("Sugar")).toBeInTheDocument();
    expect(getWarehouseReportMock).toHaveBeenCalled();
  });

  it("renders empty states when reports return no rows", async () => {
    mockReportData();
    getInvoiceReportMock.mockResolvedValueOnce({
      summary: { totalOrders: 0, totalSubtotal: 0, totalVat: 0, totalExciseTax: 0, totalRevenue: 0 },
      orders: [],
    } as never);
    const user = userEvent.setup();

    renderWithProviders(<ReportsClient today="2026-06-17" />);
    await user.click(screen.getByRole("tab", { name: "Hóa đơn" }));

    expect(await screen.findByText("Không có dữ liệu")).toBeInTheDocument();
  });
});
