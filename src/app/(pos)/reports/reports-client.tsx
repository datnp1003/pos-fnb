"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDailyReport, getTopProducts } from "@/server/inventory/actions";
import { getInvoiceReport, getSoldItemsReport, getRevenueReport, getIngredientReport, getWarehouseReport } from "@/server/reports/actions";
import { useI18n } from "@/i18n/context";
import type { Locale } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries";
import { useDeviceInfo } from "@/components/shared/device-provider";
import { Download, DollarSign, FileText, ShoppingBag, TrendingUp, Package, AlertTriangle } from "lucide-react";

function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(n || 0); }

const DATE_LOCALE_BY_APP_LOCALE: Record<Locale, string> = {
  en: "en-US",
  pt: "pt-BR",
  vi: "vi-VN",
  zh: "zh-CN",
  ko: "ko-KR",
  ja: "ja-JP",
};

function dateLocale(locale: Locale) { return DATE_LOCALE_BY_APP_LOCALE[locale]; }

// Scaffold compartilhado das tabelas de relatório. DOM idêntico aos blocos inline:
// <table.w-full.text-sm><thead><tr.bg-gray-50...>{head}</tr></thead><tbody>{children}</tbody>.
function ReportTable({ head, children }: Readonly<{ head: ReactNode; children: ReactNode }>) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">{head}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

type InvoiceReport = Awaited<ReturnType<typeof getInvoiceReport>>;
type SoldItemsReport = Awaited<ReturnType<typeof getSoldItemsReport>>;
type RevenueReport = Awaited<ReturnType<typeof getRevenueReport>>;
type IngredientReport = Awaited<ReturnType<typeof getIngredientReport>>;
type WarehouseReport = Awaited<ReturnType<typeof getWarehouseReport>>;
type DailyReport = Awaited<ReturnType<typeof getDailyReport>>;
type TopProducts = Awaited<ReturnType<typeof getTopProducts>>;

type PeriodState = {
  mode: string;
  setMode: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
};

type SummaryCard = {
  label: string;
  value: string | number;
  highlight?: boolean;
  sub?: string;
  icon?: typeof DollarSign;
  color?: string;
  bg?: string;
};

type KeyValueSummaryProps = Readonly<{
  title: string;
  emptyText: string;
  entries: Array<{
    key: string;
    label: string;
    value: string | number;
    valueClassName?: string;
  }>;
}>;

function useReportPeriod(today: string, initialMode = "day"): PeriodState {
  const [mode, setMode] = useState(initialMode);
  const [date, setDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  return { mode, setMode, date, setDate, startDate, setStartDate, endDate, setEndDate };
}

function exportExcel(type: string, mode: string, date: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({ type, mode });

  if (mode === "custom") {
    params.set("startDate", startDate);
    params.set("endDate", endDate);
  } else {
    params.set("date", date);
  }

  globalThis.open(`/api/reports?${params.toString()}`, "_blank");
}

function exportWithFeedback(
  setExporting: (value: boolean) => void,
  type: string,
  mode: string,
  date: string,
  startDate: string,
  endDate: string,
) {
  setExporting(true);
  exportExcel(type, mode, date, startDate, endDate);
  globalThis.setTimeout(() => setExporting(false), 2000);
}

async function loadOverviewData(today: string) {
  return Promise.all([getDailyReport(today), getTopProducts(today)]);
}

async function loadInvoiceData(mode: string, date: string, startDate: string, endDate: string) {
  return getInvoiceReport(mode, date, startDate, endDate);
}

async function loadSoldItemsData(mode: string, date: string, startDate: string, endDate: string) {
  return getSoldItemsReport(mode, date, startDate, endDate);
}

async function loadRevenueData(mode: string, date: string, startDate: string, endDate: string) {
  return getRevenueReport(mode, date, startDate, endDate);
}

async function loadIngredientData(mode: string, date: string, startDate: string, endDate: string) {
  return getIngredientReport(mode, date, startDate, endDate);
}

function LoadingState({ text }: Readonly<{ text: string }>) {
  return <p className="text-center text-gray-400 py-16">{text}</p>;
}

function EmptyState({ text, className = "text-center text-gray-400 py-16" }: Readonly<{ text: string; className?: string }>) {
  return <p className={className}>{text}</p>;
}

function SummaryCardsGrid({ columnsClassName, cards, ringClassName = "ring-2 ring-amber-200" }: Readonly<{
  columnsClassName: string;
  cards: SummaryCard[];
  ringClassName?: string;
}>) {
  return (
    <div className={columnsClassName}>
      {cards.map((card, index) => (
        <div key={`${card.label}-${index}`} className={`stat-card ${card.highlight ? ringClassName : ""}`}>
          {card.icon && card.color && card.bg ? (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
          ) : null}
          <div>
            <p className="text-xs font-medium text-gray-500">{card.label}</p>
            <p className="text-xl font-bold text-gray-900">{card.value}</p>
            {card.sub ? <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyValueSummary({ title, emptyText, entries }: Readonly<KeyValueSummaryProps>) {
  return (
    <div className="section-amber">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {entries.length === 0 ? (
        <EmptyState text={emptyText} className="text-sm text-gray-400" />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.key} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-sm font-medium">{entry.label}</span>
              <span className={`text-sm font-mono font-bold ${entry.valueClassName ?? ""}`}>{entry.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getOverviewCards(report: DailyReport, t: Dictionary): SummaryCard[] {
  return [
    { label: t.reports.revenue, value: fmt(report.revenue) + (t.common.d || ""), sub: `${report.orders} ${t.dashboard.orders_unit}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: t.reports.expenseLabel, value: fmt(report.totalExpense) + (t.common.d || ""), sub: t.reports.expenseSub, icon: TrendingUp, color: "text-red-500", bg: "bg-red-50" },
    { label: t.reports.profitLabel, value: fmt(report.profit) + (t.common.d || ""), sub: report.profit >= 0 ? t.reports.profitSub : t.reports.lossSub, icon: TrendingUp, color: report.profit >= 0 ? "text-emerald-600" : "text-red-500", bg: report.profit >= 0 ? "bg-emerald-50" : "bg-red-50" },
    { label: t.reports.taxLabel, value: fmt(report.vatTotal + report.exciseTaxTotal) + (t.common.d || ""), sub: t.reports.taxSub, icon: FileText, color: "text-amber-600", bg: "bg-amber-50" },
  ];
}

function getInvoiceCards(data: InvoiceReport, t: Dictionary): SummaryCard[] {
  return [
    { label: t.reports.totalInvoice, value: data.summary.totalOrders },
    { label: t.reports.subtotalLabel, value: fmt(data.summary.totalSubtotal) + (t.common.d || "") },
    { label: t.reports.taxTotalLabel, value: fmt(data.summary.totalVat + data.summary.totalExciseTax) + (t.common.d || "") },
    { label: t.reports.totalRevenue, value: fmt(data.summary.totalRevenue) + (t.common.d || ""), highlight: true },
  ];
}

function getSoldItemCards(data: SoldItemsReport, t: Dictionary): SummaryCard[] {
  return [
    { label: t.reports.totalSoldItems, value: data.summary.totalItems },
    { label: t.reports.totalSoldQty, value: data.summary.totalQuantity },
    { label: t.reports.totalRevenue, value: fmt(data.summary.totalRevenue) + (t.common.d || ""), highlight: true },
  ];
}

function getRevenueCards(data: RevenueReport, t: Dictionary): SummaryCard[] {
  return [
    { label: t.reports.revenue, value: fmt(data.summary.totalRevenue) + (t.common.d || "") },
    { label: t.reports.subtotalLabel, value: fmt(data.summary.totalSubtotal) + (t.common.d || "") },
    { label: t.reports.taxLabel, value: fmt(data.summary.totalVat + data.summary.totalExciseTax) + (t.common.d || "") },
    { label: t.reports.expenseLabel, value: fmt(data.summary.totalExpenses) + (t.common.d || "") },
    { label: t.reports.profitLabel, value: fmt(data.summary.profit) + (t.common.d || ""), highlight: true },
  ];
}

function getIngredientCards(data: IngredientReport, t: Dictionary): SummaryCard[] {
  return [
    { label: t.reports.stockInNote, value: data.stockInSummary.totalStockIns, icon: Package, color: "text-amber-600", bg: "bg-amber-50" },
    { label: t.reports.totalMoneyIn, value: fmt(data.stockInSummary.totalAmount) + (t.common.d || ""), highlight: true },
    { label: t.reports.stockOutNote, value: data.stockOutSummary.totalStockOuts, icon: ShoppingBag, color: "text-amber-600", bg: "bg-amber-50" },
    { label: t.reports.totalQtyOut, value: data.stockOutSummary.totalQuantity },
  ];
}

function getWarehouseCards(data: WarehouseReport, t: Dictionary): SummaryCard[] {
  return [
    { label: t.reports.ingredientCount, value: data.summary.totalIngredients },
    { label: t.reports.stockValue, value: fmt(data.summary.totalStockValue) + (t.common.d || ""), highlight: true },
    { label: t.reports.productsCount, value: data.summary.totalProducts },
    { label: t.reports.suppliersCount, value: data.summary.totalSuppliers },
  ];
}

function OverviewTopProducts({ products, t }: Readonly<{ products: TopProducts; t: Dictionary }>) {
  return (
    <div className="section-amber">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.dashboard.topProduct}</h3>
      {products.length === 0 ? (
        <EmptyState text={t.reports.noData} className="text-sm text-gray-400" />
      ) : (
        <div className="space-y-2">
          {products.map((product, index) => (
            <div key={`${product.name}-${index}`} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-3">
                <span className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: index < 3 ? "#d97706" : "#9ca3af" }}>
                  {index + 1}
                </span>
                <span className="text-sm font-medium">{product.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">{product.quantity} {t.inventory.items}</span>
                <span className="text-sm font-mono font-bold">{fmt(product.revenue)}{t.common.d}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceOrdersTable({ data, t, locale }: Readonly<{ data: InvoiceReport; t: Dictionary; locale: Locale }>) {
  return (
    <div className="section-amber overflow-hidden">
      <div className="overflow-x-auto">
        <ReportTable
          head={
            <>
              <th className="text-left p-3 font-semibold">{t.order.orderNumber}</th>
              <th className="text-left p-3">{t.settings.tables}</th>
              <th className="text-center p-3">{t.order.guestCount}</th>
              <th className="text-left p-3">{t.inventory.staff}</th>
              <th className="text-right p-3">{t.reports.subtotalLabel}</th>
              <th className="text-right p-3">{t.order.vat}</th>
              <th className="text-right p-3">{t.order.exciseTax}</th>
              <th className="text-right p-3">{t.order.discount}</th>
              <th className="text-right p-3">{t.settings.serviceCharges}</th>
              <th className="text-right p-3">{t.order.total}</th>
              <th className="text-left p-3">{t.reports.paymentMethods}</th>
              <th className="text-left p-3">{t.inventory.date}</th>
            </>
          }
        >
            {data.orders.map((order, index) => (
              <tr key={`${order.orderNumber}-${index}`} className="border-b border-gray-100 hover:bg-amber-50/30">
                <td className="p-3 font-mono text-xs text-amber-700 font-semibold">{order.orderNumber}{order.orderNumberSuffix ? `-${order.orderNumberSuffix}` : ""}</td>
                <td className="p-3 font-medium">{order.table}</td>
                <td className="p-3 text-center">{order.guestCount}</td>
                <td className="p-3">{order.staff}</td>
                <td className="p-3 text-right font-mono">{fmt(order.subtotal)}</td>
                <td className="p-3 text-right font-mono">{fmt(order.vatAmount)}</td>
                <td className="p-3 text-right font-mono">{fmt(order.exciseTaxAmount)}</td>
                <td className="p-3 text-right font-mono">{fmt(order.discountAmount)}</td>
                <td className="p-3 text-right font-mono">{fmt(order.serviceCharge)}</td>
                <td className="p-3 text-right font-mono font-bold">{fmt(order.totalAmount)}</td>
                <td className="p-3 text-xs text-gray-500 max-w-40 truncate">{order.paymentMethods}</td>
                <td className="p-3">{order.closedAt ? new Date(order.closedAt).toLocaleDateString(dateLocale(locale)) : ""}</td>
              </tr>
            ))}
        </ReportTable>
      </div>
      {data.orders.length === 0 ? <EmptyState text={t.reports.noData} className="text-center text-gray-400 py-12" /> : null}
    </div>
  );
}

function SoldByProductTable({ data, t }: Readonly<{ data: SoldItemsReport; t: Dictionary }>) {
  return (
    <div className="section-amber">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.reports.byProduct}</h3>
      <ReportTable
        head={
          <>
            <th className="text-left p-3 text-xs text-gray-400">#</th>
            <th className="text-left p-3 font-semibold">{t.settings.products}</th>
            <th className="text-left p-3">{t.settings.categories}</th>
            <th className="text-right p-3">{t.inventory.quantity}</th>
            <th className="text-right p-3">{t.reports.revenue}</th>
          </>
        }
      >
          {data.byProduct.map((product, index) => (
            <tr key={`${product.name}-${index}`} className="border-b border-gray-100">
              <td className="p-3 text-gray-400">{index + 1}</td>
              <td className="p-3 font-medium">{product.name}</td>
              <td className="p-3 text-gray-500">{product.category}</td>
              <td className="p-3 text-right font-mono">{product.quantity}</td>
              <td className="p-3 text-right font-mono font-bold">{fmt(product.revenue)}</td>
            </tr>
          ))}
      </ReportTable>
    </div>
  );
}

function SoldDetailTable({ data, t }: Readonly<{ data: SoldItemsReport; t: Dictionary }>) {
  return (
    <div className="section-amber">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.reports.detail}</h3>
      <div className="max-h-96 overflow-y-auto">
        <ReportTable
          head={
            <>
              <th className="text-left p-3 font-semibold">{t.inventory.dish}</th>
              <th className="text-right p-3">{t.inventory.quantity}</th>
              <th className="text-right p-3">{t.inventory.unitPrice}</th>
              <th className="text-right p-3">{t.inventory.totalPrice}</th>
              <th className="text-left p-3">{t.order.orderNumber}</th>
              <th className="text-left p-3">{t.settings.tables}</th>
            </>
          }
        >
            {data.items.slice(0, 50).map((item, index) => (
              <tr key={`${item.orderNumber}-${index}`} className="border-b border-gray-100">
                <td className="p-3 text-xs">{item.productName} {item.toppings ? `(+${item.toppings})` : ""}</td>
                <td className="p-3 text-right font-mono">{item.quantity}</td>
                <td className="p-3 text-right font-mono text-xs">{fmt(item.unitPrice)}</td>
                <td className="p-3 text-right font-mono font-bold text-xs">{fmt(item.totalAmount)}</td>
                <td className="p-3 font-mono text-xs">{item.orderNumber}</td>
                <td className="p-3 text-xs">{item.table}</td>
              </tr>
            ))}
        </ReportTable>
      </div>
    </div>
  );
}

function RevenueDailyBreakdown({ data, t, locale }: Readonly<{ data: RevenueReport; t: Dictionary; locale: Locale }>) {
  return (
    <div className="section-amber overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.reports.byDay}</h3>
      <div className="overflow-x-auto">
        <ReportTable
          head={
            <>
              <th className="text-left p-3 font-semibold">{t.inventory.date}</th>
              <th className="text-right p-3">{t.order.orderNumber}</th>
              <th className="text-right p-3">{t.reports.subtotalLabel}</th>
              <th className="text-right p-3">{t.order.vat}</th>
              <th className="text-right p-3">{t.order.exciseTax}</th>
              <th className="text-right p-3">{t.order.discount}</th>
              <th className="text-right p-3">{t.settings.serviceCharges}</th>
              <th className="text-right p-3 font-semibold">{t.reports.revenue}</th>
            </>
          }
        >
            {data.days.map((day, index) => (
              <tr key={`${day.date}-${index}`} className="border-b border-gray-100 hover:bg-amber-50/30">
                <td className="p-3 font-medium">{new Date(day.date).toLocaleDateString(dateLocale(locale), { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                <td className="p-3 text-right">{day.orders}</td>
                <td className="p-3 text-right font-mono">{fmt(day.subtotal)}</td>
                <td className="p-3 text-right font-mono">{fmt(day.vat)}</td>
                <td className="p-3 text-right font-mono">{fmt(day.excise)}</td>
                <td className="p-3 text-right font-mono">{fmt(day.discount)}</td>
                <td className="p-3 text-right font-mono">{fmt(day.service)}</td>
                <td className="p-3 text-right font-mono font-bold">{fmt(day.revenue)}</td>
              </tr>
            ))}
        </ReportTable>
      </div>
    </div>
  );
}

function IngredientStockInTable({ data, t, locale }: Readonly<{ data: IngredientReport; t: Dictionary; locale: Locale }>) {
  return (
    <div className="section-amber overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.reports.detail} {t.reports.stockInNote.toLowerCase()}</h3>
      <div className="overflow-x-auto max-h-96">
        <ReportTable
          head={
            <>
              <th className="text-left p-3 font-semibold">{t.inventory.code}</th>
              <th className="text-left p-3">{t.inventory.date}</th>
              <th className="text-left p-3">{t.settings.suppliers}</th>
              <th className="text-left p-3">{t.settings.ingredients}</th>
              <th className="text-right p-3">{t.inventory.quantity}</th>
              <th className="text-right p-3">{t.inventory.unitPrice}</th>
              <th className="text-right p-3">{t.inventory.totalPrice}</th>
            </>
          }
        >
            {data.stockIns.slice(0, 100).flatMap((stockIn) => (
              stockIn.items.map((item, index) => (
                <tr key={`${stockIn.id}-${index}`} className="border-b border-gray-100 hover:bg-amber-50/30">
                  <td className="p-3 font-mono text-xs text-amber-700">{index === 0 ? stockIn.code : ""}</td>
                  <td className="p-3">{index === 0 ? new Date(stockIn.createdAt).toLocaleDateString(dateLocale(locale)) : ""}</td>
                  <td className="p-3">{index === 0 ? (stockIn.supplier || "—") : ""}</td>
                  <td className="p-3">{item.ingredient.name}</td>
                  <td className="p-3 text-right font-mono">{item.quantity}</td>
                  <td className="p-3 text-right font-mono">{fmt(item.unitPrice)}</td>
                  <td className="p-3 text-right font-mono font-bold">{fmt(item.totalPrice)}</td>
                </tr>
              ))
            ))}
        </ReportTable>
      </div>
      {data.stockIns.length === 0 ? <EmptyState text={t.reports.noData} className="text-center text-gray-400 py-8" /> : null}
    </div>
  );
}

function IngredientStockOutTable({ data, t, locale }: Readonly<{ data: IngredientReport; t: Dictionary; locale: Locale }>) {
  return (
    <div className="section-amber overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.reports.detail} {t.reports.stockOutNote.toLowerCase()}</h3>
      <div className="overflow-x-auto max-h-72">
        <ReportTable
          head={
            <>
              <th className="text-left p-3 font-semibold">{t.inventory.date}</th>
              <th className="text-left p-3">{t.settings.ingredients}</th>
              <th className="text-right p-3">{t.inventory.quantity}</th>
              <th className="text-left p-3">{t.inventory.reason}</th>
              <th className="text-left p-3">{t.inventory.staff}</th>
              <th className="text-left p-3">{t.inventory.note}</th>
            </>
          }
        >
            {data.stockOuts.map((stockOut) => (
              <tr key={stockOut.id} className="border-b border-gray-100 hover:bg-amber-50/30">
                <td className="p-3">{new Date(stockOut.createdAt).toLocaleDateString(dateLocale(locale))}</td>
                <td className="p-3">{stockOut.ingredient?.name || "—"}</td>
                <td className="p-3 text-right font-mono">{stockOut.quantity}</td>
                <td className="p-3"><span className="inline-flex text-xs bg-gray-100 rounded-lg px-2.5 py-1 font-medium">{stockOut.reason}</span></td>
                <td className="p-3">{stockOut.user?.name || "—"}</td>
                <td className="p-3 text-xs text-gray-500">{stockOut.note || ""}</td>
              </tr>
            ))}
        </ReportTable>
      </div>
      {data.stockOuts.length === 0 ? <EmptyState text={t.reports.noData} className="text-center text-gray-400 py-8" /> : null}
    </div>
  );
}

function IngredientCurrentStockTable({ data, t }: Readonly<{ data: IngredientReport; t: Dictionary }>) {
  return (
    <div className="section-amber overflow-hidden">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t.inventory.currentStock} ({t.settings.ingredients.toLowerCase()})</h3>
      <div className="overflow-x-auto max-h-80">
        <ReportTable
          head={
            <>
              <th className="text-left p-3 font-semibold">{t.settings.name}</th>
              <th className="text-left p-3">{t.inventory.purchaseUnit}</th>
              <th className="text-left p-3">{t.inventory.baseUnit}</th>
              <th className="text-right p-3">{t.inventory.conversionFactor}</th>
              <th className="text-right p-3">{t.inventory.currentStock}</th>
              <th className="text-right p-3">{t.inventory.minStock}</th>
              <th className="text-right p-3">{t.inventory.costPrice}</th>
              <th className="text-left p-3">{t.inventory.usedIn}</th>
            </>
          }
        >
            {data.ingredients.map((ingredient) => (
              <tr key={ingredient.id} className={`border-b border-gray-100 hover:bg-amber-50/30 ${ingredient.currentStock <= ingredient.minStock && ingredient.minStock > 0 ? "bg-amber-50" : ""}`}>
                <td className="p-3 font-medium flex items-center gap-1.5">
                  {ingredient.name}
                  {ingredient.currentStock <= ingredient.minStock && ingredient.minStock > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : null}
                </td>
                <td className="p-3 text-gray-500">{ingredient.purchaseUnit}</td>
                <td className="p-3 text-gray-500">{ingredient.baseUnit}</td>
                <td className="p-3 text-right text-gray-500">{fmt(ingredient.conversionFactor)}</td>
                <td className={`p-3 text-right font-mono font-bold ${ingredient.currentStock <= ingredient.minStock && ingredient.minStock > 0 ? "text-amber-600" : ""}`}>{fmt(ingredient.currentStock)}</td>
                <td className="p-3 text-right text-gray-500">{fmt(ingredient.minStock)}</td>
                <td className="p-3 text-right font-mono">{fmt(ingredient.costPerBaseUnit)}</td>
                <td className="p-3 text-xs text-gray-500">{ingredient.recipes?.map((recipe) => recipe.product.name).join(", ") || "—"}</td>
              </tr>
            ))}
        </ReportTable>
      </div>
    </div>
  );
}

function WarehouseAlerts({ data, t }: Readonly<{ data: WarehouseReport; t: Dictionary }>) {
  return (
    <>
      {data.lowStock.length > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-amber-800">⚠️ {data.lowStock.length} {t.reports.lowStockAlert.toLowerCase()}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.lowStock.map((ingredient) => (
                <span key={ingredient.id} className="inline-flex text-xs bg-white border border-amber-200 text-amber-700 rounded-lg px-2.5 py-1 font-medium">{ingredient.name} ({fmt(ingredient.currentStock)} {ingredient.baseUnit})</span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {data.outOfStock.length > 0 ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-red-800">🚫 {data.outOfStock.length} {t.reports.outOfStockAlert.toLowerCase()}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {data.outOfStock.map((ingredient) => (
                <span key={ingredient.id} className="inline-flex text-xs bg-white border border-red-200 text-red-700 rounded-lg px-2.5 py-1 font-medium">{ingredient.name}</span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function WarehouseIngredientsTable({ data, t }: Readonly<{ data: WarehouseReport; t: Dictionary }>) {
  return (
    <div className="section-amber overflow-hidden">
      <div className="overflow-x-auto">
        <ReportTable
          head={
            <>
              <th className="text-left p-3 font-semibold">{t.settings.name}</th>
              <th className="text-left p-3">{t.inventory.purchaseUnit}</th>
              <th className="text-left p-3">{t.inventory.baseUnit}</th>
              <th className="text-right p-3">{t.inventory.conversionFactor}</th>
              <th className="text-right p-3">{t.inventory.currentStock}</th>
              <th className="text-right p-3">{t.inventory.minStock}</th>
              <th className="text-right p-3">{t.inventory.costPrice}</th>
              <th className="text-right p-3">{t.inventory.stockValue}</th>
              <th className="text-left p-3">{t.inventory.usedIn}</th>
              <th className="text-left p-3">{t.settings.suppliers}</th>
            </>
          }
        >
            {data.ingredients.map((ingredient) => {
              let rowBg = "";
              if (ingredient.currentStock <= ingredient.minStock && ingredient.minStock > 0) rowBg = "bg-amber-50";
              else if (ingredient.currentStock <= 0) rowBg = "bg-red-50";

              let stockColor = "";
              if (ingredient.currentStock <= 0 && ingredient.minStock > 0) stockColor = "text-red-600";
              else if (ingredient.currentStock <= ingredient.minStock) stockColor = "text-amber-600";
              return (
              <tr key={ingredient.id} className={`border-b border-gray-100 hover:bg-amber-50/30 ${rowBg}`}>
                <td className="p-3 font-medium">{ingredient.name}</td>
                <td className="p-3 text-gray-500">{ingredient.purchaseUnit}</td>
                <td className="p-3 text-gray-500">{ingredient.baseUnit}</td>
                <td className="p-3 text-right text-gray-500">{fmt(ingredient.conversionFactor)}</td>
                <td className={`p-3 text-right font-mono font-bold ${stockColor}`}>{fmt(ingredient.currentStock)}</td>
                <td className="p-3 text-right text-gray-500">{fmt(ingredient.minStock)}</td>
                <td className="p-3 text-right font-mono">{fmt(ingredient.costPerBaseUnit)}</td>
                <td className="p-3 text-right font-mono font-bold">{fmt(ingredient.currentStock * ingredient.costPerBaseUnit)}</td>
                <td className="p-3 text-xs text-gray-500">{ingredient.recipes?.map((recipe) => recipe.product.name).join(", ") || "—"}</td>
                <td className="p-3 text-xs">{ingredient.supplier || "—"}</td>
              </tr>
              );
            })}
        </ReportTable>
      </div>
      {data.ingredients.length === 0 ? <EmptyState text={t.reports.noData} className="text-center text-gray-400 py-12" /> : null}
    </div>
  );
}

export function ReportsClientWrapper({ today }: Readonly<{ today: string }>) {
  return <ReportsClient today={today} />;
}

export function ReportsClient({ today }: Readonly<{ today: string }>) {
  const { t, locale } = useI18n();
  const { isMobile } = useDeviceInfo();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className={`h-full overflow-y-auto space-y-6 ${isMobile ? "px-3 py-4" : "p-6"}`}>
      <div>
        <h2 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold text-gray-900`}>{t.reports.title}</h2>
        <p className="text-sm text-gray-500 mt-1">{t.dashboard.modules.reports}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 border border-gray-200 p-1 rounded-full flex flex-wrap">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium">{t.reports.overview}</TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium">{t.reports.invoices}</TabsTrigger>
          <TabsTrigger value="sold" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium">{t.reports.soldItems}</TabsTrigger>
          <TabsTrigger value="revenue" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium">{t.reports.revenue}</TabsTrigger>
          <TabsTrigger value="ingredients" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium">{t.reports.ingredients}</TabsTrigger>
          <TabsTrigger value="warehouse" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium">{t.reports.warehouse}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6"><OverviewTab today={today} t={t} locale={locale} /></TabsContent>
        <TabsContent value="invoices" className="mt-6"><InvoiceTab today={today} t={t} locale={locale} /></TabsContent>
        <TabsContent value="sold" className="mt-6"><SoldItemsTab today={today} t={t} /></TabsContent>
        <TabsContent value="revenue" className="mt-6"><RevenueTab today={today} t={t} locale={locale} /></TabsContent>
        <TabsContent value="ingredients" className="mt-6"><IngredientTab today={today} t={t} locale={locale} /></TabsContent>
        <TabsContent value="warehouse" className="mt-6"><WarehouseTab t={t} /></TabsContent>
      </Tabs>
    </div>
  );
}

function ModeSelector({ mode, setMode, date, setDate, startDate, setStartDate, endDate, setEndDate, onExport, exporting, label, t }: Readonly<{
  mode: string;
  setMode: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  onExport: () => void;
  exporting: boolean;
  label: string;
  t: Dictionary;
}>) {
  const shouldShowCustomRange = mode === "custom";

  return (
    <div className="section-amber space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500 uppercase tracking-wider">{t.reports.filter}</Label>
          <Select value={mode} onValueChange={(value) => setMode(value ?? "day")}>
            <SelectTrigger className="h-10 rounded-lg w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t.reports.today}</SelectItem>
              <SelectItem value="week">{t.reports.thisWeek}</SelectItem>
              <SelectItem value="month">{t.reports.thisMonth}</SelectItem>
              <SelectItem value="year">{t.reports.thisYear}</SelectItem>
              <SelectItem value="custom">{t.reports.custom}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {shouldShowCustomRange ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">{t.reports.fromDate}</Label>
              <Input type="date" className="h-10 rounded-lg w-44" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500 uppercase tracking-wider">{t.reports.toDate}</Label>
              <Input type="date" className="h-10 rounded-lg w-44" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">{t.reports.referenceDate}</Label>
            <Input type="date" className="h-10 rounded-lg w-44" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        )}

        <button onClick={onExport} disabled={exporting} className="btn-pos-primary h-10 ml-auto">
          <Download className="h-4 w-4" />
          {exporting ? t.reports.exporting : `${t.reports.export} ${label}`}
        </button>
      </div>
    </div>
  );
}

function OverviewTab({ today, t, locale }: Readonly<{ today: string; t: Dictionary; locale: Locale }>) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [topProducts, setTopProducts] = useState<TopProducts>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      setLoading(true);
      const [dailyReport, products] = await loadOverviewData(today);
      setReport(dailyReport);
      setTopProducts(products);
      setLoading(false);
    }

    void run();
  }, [today]);

  if (loading) return <LoadingState text={t.reports.loading} />;
  if (!report) return <EmptyState text={t.reports.noData} />;

  const paymentEntries = Object.entries(report.paymentMethods).map(([method, amount]) => ({
    key: method,
    label: method,
    value: `${fmt(amount as number)}${t.common.d}`,
  }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">{new Date(today).toLocaleDateString(dateLocale(locale), { weekday: "long", day: "numeric", month: "numeric", year: "numeric" })}</p>

      <SummaryCardsGrid columnsClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" cards={getOverviewCards(report, t)} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KeyValueSummary title={t.reports.byPaymentMethod} emptyText={t.reports.noData} entries={paymentEntries} />
        <OverviewTopProducts products={topProducts} t={t} />
      </div>
    </div>
  );
}

function InvoiceTab({ today, t, locale }: Readonly<{ today: string; t: Dictionary; locale: Locale }>) {
  const period = useReportPeriod(today);
  const [data, setData] = useState<InvoiceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const invoiceData = await loadInvoiceData(period.mode, period.date, period.startDate, period.endDate);
    setData(invoiceData);
    setLoading(false);
  }, [period.date, period.endDate, period.mode, period.startDate]);

  // Data-fetch effect: load() sets loading/data state — intentional reactive fetch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleExport = () => exportWithFeedback(setExporting, "invoices", period.mode, period.date, period.startDate, period.endDate);

  return (
    <div className="space-y-6">
      <ModeSelector {...period} onExport={handleExport} exporting={exporting} label={t.reports.invoices} t={t} />

      {loading ? <LoadingState text={t.reports.loading} /> : null}
      {!loading && !data ? <EmptyState text={t.reports.noData} /> : null}
      {!loading && data ? (
        <>
          <SummaryCardsGrid columnsClassName="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" cards={getInvoiceCards(data, t)} />
          <InvoiceOrdersTable data={data} t={t} locale={locale} />
        </>
      ) : null}
    </div>
  );
}

function SoldItemsTab({ today, t }: Readonly<{ today: string; t: Dictionary }>) {
  const period = useReportPeriod(today);
  const [data, setData] = useState<SoldItemsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const soldItemsData = await loadSoldItemsData(period.mode, period.date, period.startDate, period.endDate);
    setData(soldItemsData);
    setLoading(false);
  }, [period.date, period.endDate, period.mode, period.startDate]);

  // Data-fetch effect: load() sets loading/data state — intentional reactive fetch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleExport = () => exportWithFeedback(setExporting, "sold-items", period.mode, period.date, period.startDate, period.endDate);

  return (
    <div className="space-y-6">
      <ModeSelector {...period} onExport={handleExport} exporting={exporting} label={t.reports.soldItems} t={t} />

      {loading ? <LoadingState text={t.reports.loading} /> : null}
      {!loading && !data ? <EmptyState text={t.reports.noData} /> : null}
      {!loading && data ? (
        <>
          <SummaryCardsGrid columnsClassName="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" cards={getSoldItemCards(data, t)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SoldByProductTable data={data} t={t} />
            <SoldDetailTable data={data} t={t} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function RevenueTab({ today, t, locale }: Readonly<{ today: string; t: Dictionary; locale: Locale }>) {
  const period = useReportPeriod(today);
  const [data, setData] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const revenueData = await loadRevenueData(period.mode, period.date, period.startDate, period.endDate);
    setData(revenueData);
    setLoading(false);
  }, [period.date, period.endDate, period.mode, period.startDate]);

  // Data-fetch effect: load() sets loading/data state — intentional reactive fetch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleExport = () => exportWithFeedback(setExporting, "revenue", period.mode, period.date, period.startDate, period.endDate);

  return (
    <div className="space-y-6">
      <ModeSelector {...period} onExport={handleExport} exporting={exporting} label={t.reports.revenue} t={t} />

      {loading ? <LoadingState text={t.reports.loading} /> : null}
      {!loading && !data ? <EmptyState text={t.reports.noData} /> : null}
      {!loading && data ? (
        <>
          <SummaryCardsGrid columnsClassName="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4" cards={getRevenueCards(data, t)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KeyValueSummary
              title={t.reports.byPaymentMethod}
              emptyText={t.reports.noData}
              entries={Object.entries(data.summary.byPaymentMethod).map(([method, amount]) => ({
                key: method,
                label: method,
                value: `${fmt(amount as number)}${t.common.d}`,
              }))}
            />
            <KeyValueSummary
              title={`${t.reports.expenseLabel} ${t.reports.byCategory.toLowerCase()}`}
              emptyText={t.reports.noData}
              entries={Object.entries(data.expensesByCategory).map(([category, amount]) => ({
                key: category,
                label: category,
                value: `${fmt(amount as number)}${t.common.d}`,
                valueClassName: "text-red-600",
              }))}
            />
          </div>
          <RevenueDailyBreakdown data={data} t={t} locale={locale} />
        </>
      ) : null}
    </div>
  );
}

function IngredientTab({ today, t, locale }: Readonly<{ today: string; t: Dictionary; locale: Locale }>) {
  const period = useReportPeriod(today, "month");
  const [data, setData] = useState<IngredientReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const ingredientData = await loadIngredientData(period.mode, period.date, period.startDate, period.endDate);
    setData(ingredientData);
    setLoading(false);
  }, [period.date, period.endDate, period.mode, period.startDate]);

  // Data-fetch effect: load() sets loading/data state — intentional reactive fetch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleExport = () => exportWithFeedback(setExporting, "ingredients", period.mode, period.date, period.startDate, period.endDate);

  return (
    <div className="space-y-6">
      <ModeSelector {...period} onExport={handleExport} exporting={exporting} label={t.reports.ingredients} t={t} />

      {loading ? <LoadingState text={t.reports.loading} /> : null}
      {!loading && !data ? <EmptyState text={t.reports.noData} /> : null}
      {!loading && data ? (
        <>
          <SummaryCardsGrid columnsClassName="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" cards={getIngredientCards(data, t)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KeyValueSummary
              title={`${t.inventory.stockIn} ${t.settings.suppliers.toLowerCase()}`}
              emptyText={t.reports.noData}
              entries={Object.entries(data.stockInSummary.bySupplier).map(([supplier, amount]) => ({
                key: supplier,
                label: supplier,
                value: `${fmt(amount as number)}${t.common.d}`,
              }))}
            />
            <KeyValueSummary
              title={`${t.inventory.stockOut} ${t.inventory.reason.toLowerCase()}`}
              emptyText={t.reports.noData}
              entries={Object.entries(data.stockOutSummary.byReason).map(([reason, quantity]) => ({
                key: reason,
                label: reason,
                value: quantity as number,
              }))}
            />
          </div>
          <IngredientStockInTable data={data} t={t} locale={locale} />
          <IngredientStockOutTable data={data} t={t} locale={locale} />
          <IngredientCurrentStockTable data={data} t={t} />
        </>
      ) : null}
    </div>
  );
}

function WarehouseTab({ t }: Readonly<{ t: Dictionary }>) {
  const [data, setData] = useState<WarehouseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function run() {
      setLoading(true);
      const warehouseData = await getWarehouseReport();
      setData(warehouseData);
      setLoading(false);
    }

    void run();
  }, []);

  const handleExport = () => {
    setExporting(true);
    globalThis.open("/api/reports?type=warehouse", "_blank");
    globalThis.setTimeout(() => setExporting(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">{t.reports.warehouse} {t.reports.overview.toLowerCase()}</h3>
        <button onClick={handleExport} disabled={exporting} className="btn-pos-primary h-10">
          <Download className="h-4 w-4" />
          {exporting ? t.reports.exporting : t.reports.export}
        </button>
      </div>

      {loading ? <LoadingState text={t.reports.loading} /> : null}
      {!loading && !data ? <EmptyState text={t.reports.noData} /> : null}
      {!loading && data ? (
        <>
          <SummaryCardsGrid columnsClassName="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" cards={getWarehouseCards(data, t)} />
          <WarehouseAlerts data={data} t={t} />
          <WarehouseIngredientsTable data={data} t={t} />
        </>
      ) : null}
    </div>
  );
}
