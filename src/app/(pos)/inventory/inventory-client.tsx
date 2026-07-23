"use client";

import { useState, useTransition, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getInventoryStatus, getStockIns, getStockOuts, createStockIn, getLowStockIngredients } from "@/server/inventory/actions";
import { getLastStockInBySupplier } from "@/server/inventory/supplier-actions";
import { getIngredients } from "@/server/settings/actions";
import { toast } from "sonner";
import { useI18n } from "@/i18n/context";
import { useDeviceInfo } from "@/components/shared/device-provider";
import { Package, AlertTriangle, Plus, Trash2, X, FileText, RefreshCw, Store } from "lucide-react";

type Ingredient = Awaited<ReturnType<typeof getInventoryStatus>>[0];
type StockIn = Awaited<ReturnType<typeof getStockIns>>[0];
type IngredientBasic = Awaited<ReturnType<typeof getIngredients>>[0];
type Supplier = { id: string; name: string; contact: string | null; phone: string | null; email: string | null; address: string | null; note: string | null };

type StockInItem = { uid: string; ingredientId: string; ingredientName: string; quantity: string; unitPrice: string; purchaseUnit: string; baseUnit: string };
type InventoryClientProps = Readonly<{
  ingredients: Ingredient[];
  stockIns: StockIn[];
  stockOuts: Awaited<ReturnType<typeof getStockOuts>>;
  lowStock: Awaited<ReturnType<typeof getLowStockIngredients>>;
  allIngredients: IngredientBasic[];
  suppliers: Supplier[];
}>;
type StockSortField = "name" | "stock" | "unit";
type SortDirection = "asc" | "desc";
type SortableStockTableProps = Readonly<{ ingredients: Ingredient[]; isMobile: boolean }>;
type StockInPanelProps = Readonly<{
  items: StockInItem[];
  setItems: React.Dispatch<React.SetStateAction<StockInItem[]>>;
  supplierId: string;
  setSupplierId: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  pending: boolean;
  loadingItems: boolean;
  suppliers: Supplier[];
  allIngredients: IngredientBasic[];
  onClose: () => void;
  onSubmit: () => void;
  addEmptyRow: () => void;
}>;
type StockInRowProps = Readonly<{
  item: StockInItem;
  idx: number;
  allIngredients: IngredientBasic[];
  ingredientLabel: string;
  quantityLabel: string;
  onIngredientChange: (idx: number, ingredientId: string) => void;
  onItemChange: (idx: number, field: keyof StockInItem, value: string) => void;
  onRemove: (idx: number) => void;
}>;

function fmt(n: number) { return new Intl.NumberFormat("vi-VN").format(n || 0); }

const DATE_LOCALES: Record<string, string> = { pt: "pt-BR", en: "en-US" };
function dateLocale(locale: string) { return DATE_LOCALES[locale] ?? "vi-VN"; }
function lineTotal(item: StockInItem) {
  return (Number.parseFloat(item.quantity) || 0) * (Number.parseFloat(item.unitPrice) || 0);
}

function totalQuantity(items: StockInItem[]) {
  return items.reduce((sum, item) => sum + (Number.parseFloat(item.quantity) || 0), 0);
}

function ingredientFields(ing: IngredientBasic | undefined) {
  return { ingredientName: ing?.name ?? "", purchaseUnit: ing?.purchaseUnit ?? "", baseUnit: ing?.baseUnit ?? "" };
}

export function InventoryClient({
  ingredients, stockIns, stockOuts, lowStock, allIngredients, suppliers
}: InventoryClientProps) {
  const { t, locale } = useI18n();
  const { isMobile } = useDeviceInfo();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StockInItem[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);
  const cellPad = isMobile ? "p-2.5" : "p-4";
  const secPad = isMobile ? "p-3" : "p-5";
  const supplierName = suppliers.find(s => s.id === supplierId)?.name || "";

  // This effect intentionally drives local async loading state and form rows
  // from the selected supplier.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!supplierId) { return; }

    setLoadingItems(true);
    getLastStockInBySupplier(supplierId).then(data => {
      if (data.length > 0) {
        setItems(data.map(d => ({
          uid: crypto.randomUUID(),
          ingredientId: d.ingredientId,
          ingredientName: d.ingredientName,
          quantity: "",
          unitPrice: String(d.unitPrice),
          purchaseUnit: d.purchaseUnit,
          baseUnit: d.baseUnit,
        })));
      } else {
        setItems([]);
      }
    }).catch(() => setItems([])).finally(() => setLoadingItems(false));
  }, [supplierId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function addEmptyRow() {
    setItems(p => [...p, { uid: crypto.randomUUID(), ingredientId: "", ingredientName: "", quantity: "", unitPrice: "", purchaseUnit: "", baseUnit: "" }]);
  }

  async function submit() {
    start(async () => {
      try {
        await createStockIn({
          supplier: supplierName || undefined,
          supplierId: supplierId || undefined,
          note: note || undefined,
          userId: "admin",
          items: items
            .filter(i => i.ingredientId && Number.parseFloat(i.quantity) > 0)
            .map(i => ({ ingredientId: i.ingredientId, quantity: Number.parseFloat(i.quantity), unitPrice: Number.parseFloat(i.unitPrice) || 0 })),
        });
        toast.success(t.inventory.stockIn + "!");
        setOpen(false);
        setItems([]);
        setSupplierId("");
        setNote("");
      } catch { toast.error(t.common.error); }
    });
  }

  return (
    <div className={`h-full overflow-y-auto space-y-6 ${isMobile ? "px-3 py-4" : "p-6"}`}>
      <div className={`flex items-center justify-between ${isMobile ? "flex-wrap gap-2" : ""}`}>
        <div><h2 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold text-gray-900`}>{t.inventory.title}</h2><p className="text-sm text-gray-500 mt-1">{t.inventory.stockInSubtitle}</p></div>
        <button onClick={() => setOpen(true)} className={`${isMobile ? "btn-pos-secondary text-sm" : "btn-pos-primary"}`}><Plus className="h-4 w-4" /> {isMobile ? t.inventory.stockIn : t.inventory.addStockIn}</button>
      </div>

      {!isMobile && lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div><p className="font-semibold text-sm text-amber-800">{t.inventory.lowStock}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">{lowStock.map(i => (
              <span key={i.id} className="inline-flex text-xs bg-white border border-amber-200 text-amber-700 rounded-lg px-2.5 py-1 font-medium">{i.name} ({fmt(i.currentStock)} {i.baseUnit})</span>
            ))}</div>
          </div>
        </div>
      )}

      <Tabs defaultValue="status">
        <TabsList className="bg-gray-100 border border-gray-200 p-1 rounded-full">
          <TabsTrigger value="status" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium">{t.inventory.stockStatus}</TabsTrigger>
          <TabsTrigger value="in" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium">{t.inventory.stockIn}</TabsTrigger>
          <TabsTrigger value="out" className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium">{t.inventory.stockOut}</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-4">
          <div className={`section-amber overflow-hidden ${secPad}`}><div className="overflow-x-auto">
            <SortableStockTable ingredients={ingredients} isMobile={isMobile} />
          </div></div>
        </TabsContent>
        <TabsContent value="in" className="mt-4">
          <div className={`section-amber overflow-hidden ${secPad}`}><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b border-gray-200"><th className={`${cellPad} text-left`}>{t.inventory.code}</th><th className={`${cellPad} text-left`}>{t.inventory.date}</th><th className={`${cellPad} text-left`}>{t.inventory.supplier}</th><th className={`${cellPad} text-center`}>{t.inventory.items}</th><th className={`${cellPad} text-right`}>{t.inventory.totalAmount}</th><th className={`${cellPad} text-left`}>{t.inventory.staff}</th></tr></thead>
            <tbody>{stockIns.map(si => (<tr key={si.id} className="border-b border-gray-100 hover:bg-amber-50/30"><td className={`${cellPad} font-mono text-xs text-amber-700 font-semibold`}>{si.code}</td><td className={`${cellPad} font-semibold text-xs`}>{new Date(si.createdAt).toLocaleDateString(dateLocale(locale))}</td><td className={`${cellPad} text-xs`}>{si.supplier || "—"}</td><td className={`${cellPad} text-center text-xs`}>{si.items.length}</td><td className={`${cellPad} text-right font-mono font-bold text-xs`}>{fmt(si.totalAmount)}{t.common.d}</td><td className={`${cellPad} text-xs`}>{si.user.name}</td></tr>))}</tbody></table>
            {stockIns.length === 0 && <p className="text-center text-gray-400 py-12">{t.reports.noData} {t.inventory.noStockIns}</p>}</div>
        </TabsContent>
        <TabsContent value="out" className="mt-4">
          <div className={`section-amber overflow-hidden ${secPad}`}><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b border-gray-200"><th className={`${cellPad} text-left`}>{t.inventory.date}</th><th className={`${cellPad} text-left`}>{t.inventory.ingredient}</th><th className={`${cellPad} text-right`}>SL</th><th className={`${cellPad} text-left`}>{t.inventory.reason}</th><th className={`${cellPad} text-left`}>{t.inventory.staff}</th></tr></thead>
            <tbody>{stockOuts.map(so => (<tr key={so.id} className="border-b border-gray-100"><td className={`${cellPad} font-semibold text-xs`}>{new Date(so.createdAt).toLocaleDateString(dateLocale(locale))}</td><td className={`${cellPad} text-xs`}>{so.ingredient?.name}</td><td className={`${cellPad} text-right font-mono text-xs`}>{so.quantity}</td><td className={`${cellPad} text-xs`}><span className="inline-flex text-xs bg-gray-100 rounded-lg px-2.5 py-1 font-medium">{so.reason}</span></td><td className={`${cellPad} text-xs`}>{so.user?.name}</td></tr>))}</tbody></table>
            {stockOuts.length === 0 && <p className="text-center text-gray-400 py-12">{t.reports.noData} {t.inventory.noStockOuts}</p>}</div>
        </TabsContent>
      </Tabs>

      {open && <StockInPanel
        items={items}
        setItems={setItems}
        supplierId={supplierId}
        setSupplierId={setSupplierId}
        note={note}
        setNote={setNote}
        pending={pending}
        loadingItems={loadingItems}
        suppliers={suppliers}
        allIngredients={allIngredients}
        onClose={() => setOpen(false)}
        onSubmit={submit}
        addEmptyRow={addEmptyRow}
      />}
    </div>
  );
}

// ===== SORTABLE STOCK STATUS TABLE =====
function SortableStockTable({ ingredients, isMobile }: SortableStockTableProps) {
  const { t } = useI18n();
  const [sortField, setSortField] = useState<StockSortField>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  function toggleSort(field: StockSortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = [...ingredients].sort((a, b) => {
    let cmp = 0;
    if (sortField === "name") cmp = a.name.localeCompare(b.name);
    else if (sortField === "stock") cmp = a.currentStock - b.currentStock;
    else if (sortField === "unit") cmp = a.baseUnit.localeCompare(b.baseUnit);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const sortArrow = (field: StockSortField) => {
    if (sortField !== field) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1 text-amber-500">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  if (ingredients.length === 0) {
    return <p className="text-center text-gray-400 py-12">{t.settings.noData}</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left p-0">
            <button
              type="button"
              onClick={() => toggleSort("name")}
              className="w-full p-3 text-left font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors"
            >
              {t.settings.name}{sortArrow("name")}
            </button>
          </th>
          {!isMobile && (
            <th className="text-left p-0">
              <button
                type="button"
                onClick={() => toggleSort("unit")}
                className="w-full p-3 text-left cursor-pointer select-none hover:bg-gray-100 transition-colors"
              >
                {t.inventory.baseUnit}{sortArrow("unit")}
              </button>
            </th>
          )}
          <th className="p-0">
            <button
              type="button"
              onClick={() => toggleSort("stock")}
              className={`w-full p-3 font-semibold cursor-pointer select-none hover:bg-gray-100 transition-colors ${isMobile ? "pr-4 text-right" : "text-right"}`}
            >
              {t.inventory.currentStock}{sortArrow("stock")}
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(i => (
          <tr key={i.id} className={`border-b border-gray-100 ${i.currentStock <= i.minStock && i.minStock > 0 ? "bg-amber-50" : ""}`}>
            <td className={`p-3 font-semibold ${isMobile ? "pl-4" : ""}`}>{i.name}</td>
            {!isMobile && <td className="p-3 text-gray-500">{i.baseUnit}</td>}
            <td className={`p-3 text-right font-mono font-bold ${isMobile ? "pr-4" : ""} ${i.currentStock <= i.minStock && i.minStock > 0 ? "text-amber-600" : ""}`}>
              {fmt(i.currentStock)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ===== FULL-WIDTH SLIDE-OVER STOCK-IN PANEL =====
function StockInPanel({
  items, setItems, supplierId, setSupplierId, note, setNote, pending, loadingItems, suppliers, allIngredients, onClose, onSubmit, addEmptyRow
}: StockInPanelProps) {
  const { t } = useI18n();
  const { isMobile } = useDeviceInfo();
  const total = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const hasValidItems = items.some(item => item.ingredientId && Number.parseFloat(item.quantity) > 0);

  function removeRow(idx: number) {
    setItems(p => p.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof StockInItem, value: string) {
    setItems(p => p.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function handleSupplierChange(nextSupplierId: string | null) {
    setSupplierId(nextSupplierId ?? "");
    if (!nextSupplierId) {
      setItems([]);
    }
  }

  function handleIngredientChange(idx: number, ingredientId: string) {
    const { ingredientName, purchaseUnit, baseUnit } = ingredientFields(allIngredients.find(ing => ing.id === ingredientId));
    setItems(prev => prev.map((it, i) => (
      i === idx ? { ...it, ingredientId, ingredientName, purchaseUnit, baseUnit } : it
    )));
  }

  const cls = isMobile
    ? { panel: "w-full", header: "px-4 py-3", iconBox: "w-8 h-8 rounded-lg", iconSize: "h-4 w-4", title: "text-lg", subtitle: "text-xs", meta: "px-4 py-3 grid grid-cols-1", items: "px-2 py-3", label: "text-xs", footer: "px-3 py-3 flex-wrap gap-2", footerGap: "gap-3 flex-wrap", totalSize: "text-base", amountLabel: "text-xs", cancelBtn: "h-10 px-4", submitBtn: "h-10 px-5" }
    : { panel: "w-full max-w-6xl", header: "px-8 py-5", iconBox: "w-10 h-10 rounded-xl", iconSize: "h-5 w-5", title: "text-xl", subtitle: "text-sm", meta: "px-8 py-4 grid grid-cols-1 md:grid-cols-2", items: "px-8 py-4", label: "text-sm", footer: "px-8 py-4", footerGap: "gap-8", totalSize: "text-lg", amountLabel: "text-sm", cancelBtn: "h-11 px-6", submitBtn: "h-11 px-8" };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" aria-label={t.inventory.cancel} onClick={onClose} className="absolute inset-0 bg-black/50 cursor-default" />
      <div
        className={`relative ml-auto ${cls.panel} bg-white h-full overflow-hidden flex flex-col shadow-2xl`}
      >
        {/* Header */}
        <div className={`shrink-0 flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-amber-50 to-white ${cls.header}`}>
          <div className="flex items-center gap-2.5">
            <div className={`${cls.iconBox} bg-amber-100 flex items-center justify-center`}>
              <FileText className={`${cls.iconSize} text-amber-600`} />
            </div>
            <div>
              <h2 className={`${cls.title} font-bold text-gray-900`}>{t.inventory.stockIn}</h2>
              <p className={`text-gray-500 ${cls.subtitle}`}>{t.inventory.selectSupplierToAutoFill}</p>
            </div>
          </div>
          <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Meta info */}
        <div className={`shrink-0 border-b border-gray-100 bg-white gap-4 ${cls.meta}`}>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">{t.inventory.supplier}</Label>
            <Select value={supplierId} onValueChange={handleSupplierChange}>
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue placeholder={t.inventory.selectSupplier}>{suppliers.find(s => s.id === supplierId)?.name}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-gray-400" />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {supplierId && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                <RefreshCw className="h-3 w-3" />
                {t.inventory.autoFillNotice}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500 uppercase tracking-wider">{t.inventory.note}</Label>
            <Input className="h-11 rounded-lg" value={note} onChange={e => setNote(e.target.value)} placeholder={t.inventory.notes} />
          </div>
        </div>

        {/* Items table */}
        <div className={`flex-1 overflow-y-auto ${cls.items}`}>
          <div className="flex items-center justify-between mb-3">
            <Label className={`font-semibold text-gray-700 ${cls.label}`}>
              {t.inventory.ingredientList} ({items.length})
              {loadingItems && <span className="ml-2 text-amber-500 font-normal animate-pulse">{t.common.loading}</span>}
            </Label>
            <button onClick={addEmptyRow} className="h-9 px-3 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors touch-manipulation">
              + {t.inventory.addRow}
            </button>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-3 pl-4 w-12 text-gray-400 text-xs">#</th>
                  <th className="text-left p-3 font-semibold text-gray-600">{t.inventory.ingredient}</th>
                  <th className="text-left p-3 w-24 text-gray-400 text-xs">{t.inventory.unit}</th>
                  <th className="text-left p-3 w-36 font-semibold text-gray-600">{t.inventory.quantity}</th>
                  <th className="text-left p-3 w-40 font-semibold text-gray-600">{t.inventory.unitPrice} ({t.common.d})</th>
                  <th className="text-right p-3 w-36 font-semibold text-gray-600">{t.inventory.totalPrice}</th>
                  <th className="text-center p-3 pr-4 w-16"><span className="sr-only">{t.inventory.cancel}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <StockInTableRow
                    key={item.uid}
                    item={item}
                    idx={idx}
                    allIngredients={allIngredients}
                    ingredientLabel={t.inventory.ingredient}
                    quantityLabel={t.inventory.quantity}
                    onIngredientChange={handleIngredientChange}
                    onItemChange={updateItem}
                    onRemove={removeRow}
                  />
                ))}
              </tbody>
            </table>
            {items.length === 0 && (
              <div className="py-16 text-center text-gray-400">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>{t.inventory.fillFromSupplier}</p>
                <button onClick={addEmptyRow} className="text-amber-500 text-sm mt-1 hover:underline">{t.inventory.manualAddRow}</button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`shrink-0 border-t border-gray-200 bg-gray-50 flex items-center justify-between ${cls.footer}`}>
          <div className={`flex items-center ${cls.footerGap}`}>
            <div className="text-xs">
              <span className="text-gray-500">{t.inventory.totalLines}</span>
              <span className="ml-1 font-bold text-gray-700">{items.length}</span>
            </div>
            <div className="text-xs">
              <span className="text-gray-500">{t.inventory.totalItems}</span>
              <span className="ml-1 font-bold text-gray-700">{fmt(totalQuantity(items))}</span>
            </div>
            <div className={cls.totalSize}>
              <span className={`text-gray-500 ${cls.amountLabel}`}>{t.inventory.totalAmount}:</span>
              <span className="ml-2 font-bold text-amber-600">{fmt(total)}{t.common.d}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className={`${cls.cancelBtn} rounded-lg border border-gray-200 font-medium text-sm text-gray-600 hover:bg-gray-100 transition-colors`}>{t.inventory.cancel}</button>
            <button
              onClick={onSubmit}
              disabled={pending || items.length === 0 || !hasValidItems}
              className={`${cls.submitBtn} rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors touch-manipulation`}
            >
              {pending ? t.common.saving : t.inventory.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StockInTableRow({
  item,
  idx,
  allIngredients,
  ingredientLabel,
  quantityLabel,
  onIngredientChange,
  onItemChange,
  onRemove,
}: StockInRowProps) {
  const itemLineTotal = lineTotal(item);

  return (
    <tr className={`hover:bg-amber-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
      <td className="p-2 pl-4 text-gray-400 text-xs font-mono">{idx + 1}</td>
      <td className="p-2">
        <Select value={item.ingredientId} onValueChange={value => onIngredientChange(idx, value ?? "")}>
          <SelectTrigger className="h-10 rounded-lg border-gray-200">
            <SelectValue placeholder={`— ${ingredientLabel} —`}>
              {item.ingredientName || `— ${ingredientLabel} —`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allIngredients.map(i => (
              <SelectItem key={i.id} value={i.id}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-xs font-medium">
          {item.purchaseUnit || item.baseUnit || "—"}
        </span>
      </td>
      <td className="p-2">
        <Input
          className="h-10 rounded-lg w-24 text-center tabular-nums"
          type="number" min="0" step="0.01" placeholder={quantityLabel}
          value={item.quantity}
          onChange={e => onItemChange(idx, "quantity", e.target.value)}
        />
      </td>
      <td className="p-2">
        <Input
          className="h-10 rounded-lg w-32 text-right tabular-nums"
          type="number" min="0" step="100" placeholder="0"
          value={item.unitPrice}
          onChange={e => onItemChange(idx, "unitPrice", e.target.value)}
        />
      </td>
      <td className="p-2 text-right font-mono font-bold text-gray-700">
        {itemLineTotal > 0 ? fmt(itemLineTotal) : "—"}
      </td>
      <td className="p-2 pr-4 text-center">
        <button onClick={() => onRemove(idx)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
