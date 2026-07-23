"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n/context";
import { useDeviceInfo } from "@/components/shared/device-provider";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Users, Clock, Send, Printer, Merge, Split,
  Plus, Minus, ShoppingCart, X, ArrowLeft,
  UtensilsCrossed, Flame, Banknote, CheckCircle, Bluetooth, BluetoothConnected, BluetoothOff,
} from "lucide-react";
import {
  openTable, addItem, updateItemQuantity, removeItem, cancelItem,
  sendOrder, mergeTables, splitItemsEvenly, getOrder, printTempBill, checkoutOrder, updateOrderGuest, refreshKaraokeTime,
} from "@/server/order/actions";
import { useBluetoothPrinter } from "@/hooks/use-bluetooth-printer";

type Area = {
  id: string; name: string; type: string;
  tables: TableInfo[];
};
type TableInfo = {
  id: string; name: string; capacity: number; isKaraoke: boolean;
  orders: { id: string; status: string; orderNumber: number; orderNumberSuffix?: string | null; type: string; openedAt: Date; guestCount: number; totalAmount?: number | null }[];
};
type Category = { id: string; name: string; products: ProductInfo[] };
type ProductInfo = {
  id: string; name: string; price: number; unit: { name: string };
  toppingGroups: { toppingGroup: { id: string; name: string; type: string; toppings: { id: string; name: string; price: number }[] } }[];
};
type OrderDetail = Awaited<ReturnType<typeof getOrder>>;

function fmt(v: number) { return new Intl.NumberFormat("vi-VN").format(v); }

function getDateLocale(locale: string) {
  if (locale === "pt") {
    return "pt-BR";
  }

  if (locale === "en") {
    return "en-US";
  }

  return "vi-VN";
}

function getElapsedMinutes(openedAt: Date) {
  // Live elapsed-minutes display — Date.now() read during render is intentional.
  return Math.round((Date.now() - new Date(openedAt).getTime()) / 60000);
}

function getTableDisabledState(params: {
  mergeMode: boolean;
  splitMode: boolean;
  hasOrder: boolean;
  isSelected: boolean;
  selectedCount: number;
}) {
  const { mergeMode, splitMode, hasOrder, isSelected, selectedCount } = params;
  const inMode = mergeMode || splitMode;

  if (!inMode) {
    return false;
  }

  if (mergeMode) {
    return !hasOrder;
  }

  return !hasOrder || (selectedCount === 1 && !isSelected);
}

function getTableCardClassName(params: {
  hasOrder: boolean;
  isSelected: boolean;
  disabled: boolean;
  inMode: boolean;
  isMobile: boolean;
  cardPadding: string;
}) {
  const { hasOrder, isSelected, disabled, inMode, isMobile, cardPadding } = params;
  let stateClassName = "bg-emerald-50 border-emerald-200";

  if (inMode && isSelected) {
    stateClassName = "bg-blue-100 border-blue-500 ring-2 ring-blue-300";
  } else if (inMode && hasOrder) {
    stateClassName = "bg-amber-50 border-amber-300 hover:border-blue-400";
  } else if (hasOrder) {
    stateClassName = "bg-amber-50 border-amber-300";
  }

  return `rounded-xl ${cardPadding} flex flex-col gap-1 transition-all active:scale-95 cursor-pointer border-2 text-left min-h-[${isMobile ? "64px" : "88px"}] justify-center ${
    disabled ? "opacity-30 cursor-not-allowed" : ""
  } ${stateClassName}`;
}

function handleTableCardAction(params: {
  mergeMode: boolean;
  splitMode: boolean;
  hasOrder: boolean;
  selectedCount: number;
  table: TableInfo;
  order?: TableInfo["orders"][number];
  onToggleTable: (tableId: string) => void;
  onSelectOrder: (orderId: string) => void;
  onOpenTable: (table: TableInfo) => void;
}) {
  const {
    mergeMode,
    splitMode,
    hasOrder,
    selectedCount,
    table,
    order,
    onToggleTable,
    onSelectOrder,
    onOpenTable,
  } = params;

  if (mergeMode) {
    if (hasOrder) {
      onToggleTable(table.id);
    }
    return;
  }

  if (splitMode) {
    if (hasOrder && selectedCount === 0) {
      onToggleTable(table.id);
    }
    return;
  }

  if (hasOrder && order) {
    onSelectOrder(order.id);
    return;
  }

  onOpenTable(table);
}

function getSelectedToppings(
  toppingProduct: ProductInfo,
  toppingSelections: Record<string, boolean>,
) {
  const toppingsById = toppingProduct.toppingGroups
    .flatMap(group => group.toppingGroup.toppings)
    .reduce<Record<string, { price: number }>>((acc, topping) => {
      acc[topping.id] = { price: topping.price };
      return acc;
    }, {});

  return Object.entries(toppingSelections)
    .filter(([, selected]) => selected)
    .map(([id]) => ({
      toppingId: id,
      price: toppingsById[id]?.price ?? 0,
    }));
}

function buildSingleToppingSelection(group: ProductInfo["toppingGroups"][number], toppingId: string) {
  return group.toppingGroup.toppings.reduce<Record<string, boolean>>((selection, topping) => {
    selection[topping.id] = topping.id === toppingId;
    return selection;
  }, {});
}

function updateToppingSelection(
  group: ProductInfo["toppingGroups"][number],
  toppingId: string,
  setToppingSelections: Dispatch<SetStateAction<Record<string, boolean>>>,
) {
  if (group.toppingGroup.type === "SINGLE") {
    const selection = buildSingleToppingSelection(group, toppingId);
    setToppingSelections(current => ({ ...current, ...selection }));
    return;
  }

  setToppingSelections(current => ({ ...current, [toppingId]: !current[toppingId] }));
}

function getBluetoothIcon(btState: { connected: boolean; connecting: boolean }) {
  if (btState.connecting) return <Bluetooth className="h-4 w-4 animate-pulse" />;
  if (btState.connected) return <BluetoothConnected className="h-4 w-4" />;
  return <BluetoothOff className="h-4 w-4" />;
}

function getSourceOrderIds(tables: TableInfo[], tableIds: string[]): string[] {
  const result: string[] = [];
  for (const tid of tableIds.slice(1)) {
    const oid = tables.find(tb => tb.id === tid)?.orders[0]?.id;
    if (oid) result.push(oid);
  }
  return result;
}

function getGridCols(isMobile: boolean, isTablet: boolean): string {
  if (isMobile) return "grid-cols-3";
  if (isTablet) return "grid-cols-4";
  return "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10";
}

// ─── Table Grid View ────────────────────────────────────────────
export function TableGridView({
  areas, activeAreaId, setActiveAreaId, onOpenTable, onSelectOrder,
  onMergeTables, onSplitTable,
}: Readonly<{
  areas: Area[]; activeAreaId: string; setActiveAreaId: (id: string) => void;
  onOpenTable: (t: TableInfo) => void; onSelectOrder: (orderId: string) => void;
  onMergeTables: (orderIds: string[], targetTableId: string) => Promise<unknown>;
  onSplitTable: (orderId: string) => void;
}>) {
  const { t } = useI18n();
  const { isMobile, isTablet } = useDeviceInfo();
  const [pending, start] = useTransition();
  const [mergeMode, setMergeMode] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const activeArea = areas.find(a => a.id === activeAreaId) ?? areas[0];

  if (!activeArea) {
    return null;
  }

  const occupied = activeArea.tables.filter(t => t.orders.length > 0).length;

  function resetSelectionMode() {
    setMergeMode(false);
    setSplitMode(false);
    setSelectedTables(new Set());
  }

  function toggleMerge() {
    setMergeMode(!mergeMode);
    setSplitMode(false);
    setSelectedTables(new Set());
  }
  function toggleSplit() {
    setSplitMode(!splitMode);
    setMergeMode(false);
    setSelectedTables(new Set());
  }
  function toggleTable(tableId: string) {
    setSelectedTables(p => {
      const n = new Set(p);
      if (n.has(tableId)) {
        n.delete(tableId);
      } else {
        n.add(tableId);
      }
      return n;
    });
  }

  function handleConfirm() {
    if (mergeMode) {
      const tableIds = Array.from(selectedTables);
      if (tableIds.length < 2) { toast.error(t.order.mergeTablePrompt); return; }
      start(async () => {
        await onMergeTables(getSourceOrderIds(activeArea.tables, tableIds), tableIds[0]);
        toast.success(t.order.mergeTables + "!");
        resetSelectionMode();
      });
    } else {
      if (selectedTables.size !== 1) { toast.error(t.order.splitTablePrompt); return; }
      const selectedTableId = Array.from(selectedTables)[0];
      const table = activeArea.tables.find(tb => tb.id === selectedTableId);
      const orderId = table?.orders[0]?.id;
      if (orderId) onSplitTable(orderId);
    }
  }

  const gridCols = getGridCols(isMobile, isTablet);
  const showModeBanner = mergeMode || splitMode;
  const cardPadding = isMobile ? "p-2.5" : "p-4";
  const gapSize = isMobile ? "gap-2" : "gap-4";
  const modeBannerText = mergeMode ? t.order.mergeTablePrompt : t.order.splitTablePrompt;
  const modeConfirmText = mergeMode ? `${t.order.confirm} ${t.order.merge.toLowerCase()}` : t.order.selectItems;
  const modeConfirmClass = mergeMode ? "bg-blue-500 hover:bg-blue-600" : "bg-purple-500 hover:bg-purple-600";
  const modeMinSelection = mergeMode ? 2 : 1;

  return (
    <div className="flex flex-col h-full">
      {/* Area tabs + buttons */}
      <div className={`${isMobile ? "px-3 py-2 gap-1.5" : "px-6 py-3 gap-2"} flex items-center overflow-x-auto shrink-0 border-b border-gray-200 bg-white`}>
        {areas.map(a => (
          <button key={a.id} onClick={() => { setActiveAreaId(a.id); resetSelectionMode(); }}
            className={`${isMobile ? "px-3 py-1.5 text-xs" : "px-5 py-2 text-sm"} rounded-full font-semibold whitespace-nowrap transition-all active:scale-95 ${
              activeAreaId === a.id ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {a.name}
          </button>
        ))}
        {/* Desktop: Gộp/Tách buttons in top bar */}
        {!isMobile && (
          <>
            <div className="flex-1" />
            <button onClick={toggleMerge} className={`px-4 py-2 text-sm rounded-full font-semibold transition-all flex items-center gap-1 ${
              mergeMode ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}><Merge className="h-4 w-4" /> {t.order.merge}</button>
            <button onClick={toggleSplit} className={`px-4 py-2 text-sm rounded-full font-semibold transition-all flex items-center gap-1 ${
              splitMode ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}><Split className="h-4 w-4" /> {t.order.split}</button>
          </>
        )}
      </div>

      {/* Mobile: Mode banner + action bar at the bottom */}
      {isMobile && showModeBanner && (
        <div className="px-3 py-2 text-xs flex items-center gap-2 shrink-0 bg-blue-50 border-b border-blue-200">
          <span className="font-semibold text-blue-700">{modeBannerText}</span>
          <span className="text-xs text-blue-600">{selectedTables.size} {t.order.selectedCount}</span>
          <div className="flex-1" />
          <button onClick={resetSelectionMode}
            className="px-3 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-100 touch-manipulation">{t.order.cancel}</button>
          <button onClick={handleConfirm}
            disabled={pending || selectedTables.size < modeMinSelection}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40 touch-manipulation ${modeConfirmClass}`}>
            {modeConfirmText}
          </button>
        </div>
      )}

      {/* Desktop: Mode banner */}
      {!isMobile && showModeBanner && (
        <div className="px-6 py-2 text-sm flex items-center gap-3 shrink-0 bg-blue-50 border-b border-blue-200">
          <span className="font-semibold text-blue-700">{modeBannerText}</span>
          <span className="text-xs text-blue-600">{selectedTables.size} {t.order.selectedCount}</span>
          <div className="flex-1" />
          <button onClick={resetSelectionMode}
            className="px-3 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-100">{t.order.cancel}</button>
          <button onClick={handleConfirm}
            disabled={pending || selectedTables.size < modeMinSelection}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40 ${modeConfirmClass}`}>
            {modeConfirmText}
          </button>
        </div>
      )}

      {/* Legend */}
      {!isMobile && (
        <div className="px-6 py-2 flex items-center gap-6 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200 shrink-0">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> {t.order.tableFree}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> {t.order.occupied}</span>
          <span className="text-gray-400">{occupied}/{activeArea.tables.length} {t.order.occupied}</span>
        </div>
      )}

      {/* Table Grid */}
      <div className={`flex-1 overflow-y-auto ${isMobile ? "p-2" : "p-6"}`}>
        <div className={`grid ${gridCols} ${gapSize}`}>
          {activeArea.tables.map(table => {
            const hasOrder = table.orders.length > 0 && (table.orders[0].status === "OPEN" || table.orders[0].status === "SENT");
            const order = table.orders[0];
            const isSelected = selectedTables.has(table.id);
            const inMode = mergeMode || splitMode;
            const disabled = getTableDisabledState({
              mergeMode,
              splitMode,
              hasOrder,
              isSelected,
              selectedCount: selectedTables.size,
            });

            return (
              <button key={table.id} disabled={disabled}
                data-testid={hasOrder ? "table-occupied" : "table-free"}
                onClick={() => handleTableCardAction({
                  mergeMode,
                  splitMode,
                  hasOrder,
                  selectedCount: selectedTables.size,
                  table,
                  order,
                  onToggleTable: toggleTable,
                  onSelectOrder,
                  onOpenTable,
                })}
                className={getTableCardClassName({ hasOrder, isSelected, disabled, inMode, isMobile, cardPadding })}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`${isMobile ? "text-xs" : "text-sm"} font-extrabold ${hasOrder ? "text-amber-800" : "text-emerald-800"}`}>{table.name}</span>
                    {hasOrder && order && (
                      <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />{getElapsedMinutes(order.openedAt)}&apos;
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {order?.status === "SENT" && !inMode && <Flame className="h-3.5 w-3.5 text-orange-500" />}
                    {inMode && <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] ${isSelected ? "bg-blue-500 border-blue-500 text-white" : "border-gray-300"}`}>{isSelected ? "✓" : ""}</span>}
                  </div>
                </div>
                {hasOrder && order ? (
                  <>
                    <span className="text-[11px] font-mono font-bold text-amber-800">
                      #{String(order.orderNumber).padStart(8, "0")}{order.orderNumberSuffix ? `-${order.orderNumberSuffix}` : ""}
                    </span>
                    <span className={`${isMobile ? "text-[10px]" : "text-xs"} font-bold text-amber-600`}>{fmt(order.totalAmount ?? 0)}{t.common.d}</span>
                  </>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-700">{table.capacity} {isMobile ? "" : t.order.seats}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: Fixed bottom action bar — Gộp/Tách */}
      {isMobile && (
        <div className="fixed bottom-14 left-0 right-0 z-30 px-2 pb-2 pt-0" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}>
          <div className="flex gap-2 bg-white rounded-2xl shadow-lg border border-gray-200 px-3 py-2">
            <button onClick={toggleMerge}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all touch-manipulation ${
                mergeMode ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"
              }`}>
              <Merge className="h-4 w-4" /> {t.order.merge}
            </button>
            <button onClick={toggleSplit}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all touch-manipulation ${
                splitMode ? "bg-purple-500 text-white" : "bg-gray-100 text-gray-600"
              }`}>
              <Split className="h-4 w-4" /> {t.order.split}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Order Detail View ──────────────────────────────────────────
function OrderDetailView({
  orderDetail, categories, onBack,
  onSend, onTempBill, onCheckout, onMerge, onSplit,
  onAddItem, onUpdateQty, onRemoveItem, onCancelItem,
  pending, onGuestChange,
  btState, onBtConnect, onBtDisconnect,
  onMobileCheckout, mobileCheckoutPending,
}: Readonly<{
  orderDetail: OrderDetail; categories: Category[]; onBack: () => void;
  onSend: () => void; onTempBill: () => void; onCheckout: () => void; onMerge: () => void; onSplit: () => void;
  onAddItem: (product: ProductInfo) => void;
  onUpdateQty: (itemId: string, qty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCancelItem: (itemId: string) => void;
  pending: boolean;
  onGuestChange: (delta: number) => void;
  btState: { connected: boolean; connecting: boolean; error: string | null };
  onBtConnect: () => void;
  onBtDisconnect: () => void;
  onMobileCheckout: (method: string, amount: string) => void;
  mobileCheckoutPending: boolean;
}>) {
  const { t, locale } = useI18n();
  const { isMobile, isTablet } = useDeviceInfo();
  const [activeCatId, setActiveCatId] = useState(categories[0]?.id ?? "");
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  // Mobile checkout states (inline, no popup)
  const [mobileCheckout, setMobileCheckout] = useState(false);
  const [mPaymentMethod, setMPaymentMethod] = useState("CASH");
  const [mPaymentAmount, setMPaymentAmount] = useState("");
  if (!orderDetail) return null;
  const detail = orderDetail;
  const activeCat = categories.find(c => c.id === activeCatId);
  const pendingItems = detail.items.filter(i => i.status === "PENDING");
  const canSend = pendingItems.length > 0;
  const sidebarW = isTablet ? "w-[300px]" : "w-[380px]";

  function handleCheckoutClick(compact?: boolean) {
    if (compact) {
      setOrderSheetOpen(false);
      setMPaymentAmount(String(detail.totalAmount));
      setMobileCheckout(true);
    } else {
      onCheckout();
    }
  }

  // ══════ Shared: Order Panel content ══════
  function renderOrderPanel(compact?: boolean) {
    return (
      <div className="flex flex-col h-full bg-white">
        {compact && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 shrink-0">
            <span className="font-bold text-sm">{t.order.orderedItems} ({detail.items.length})</span>
            <button onClick={() => setOrderSheetOpen(false)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 touch-manipulation">
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        )}
        {!compact && (
          <div className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-gray-400 shrink-0">
            {t.order.orderedItems} ({detail.items.length})
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {detail.items.map(item => (
            <div key={item.id} className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs ${
              item.status === "CANCELLED" ? "opacity-40 line-through bg-red-50 border-red-100" : "bg-gray-50 border-gray-200"
            }`}>
              {item.status === "SENT" && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              {item.status === "PENDING" && <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 shrink-0" />}
              {item.status === "CANCELLED" && <X className="h-3.5 w-3.5 text-red-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{item.product.name}</div>
                {item.toppings?.length > 0 && (
                  <div className="text-[10px] text-gray-400 truncate">+ {item.toppings.map((tp) => tp.topping?.name).join(", ")}</div>
                )}
              </div>
              {item.status === "PENDING" && !item.product.slug?.startsWith("karaoke-") ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => item.quantity <= 1 ? onRemoveItem(item.id) : onUpdateQty(item.id, item.quantity - 1)}
                    className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 active:scale-90 touch-manipulation">
                    <Minus className="h-2.5 w-2.5" /></button>
                  <span className="w-5 text-center font-mono font-bold text-xs">{item.quantity}</span>
                  <button onClick={() => onUpdateQty(item.id, item.quantity + 1)}
                    className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 active:scale-90 touch-manipulation">
                    <Plus className="h-2.5 w-2.5" /></button>
                </div>
              ) : (
                <span className="text-[10px] font-semibold text-gray-500">x{item.quantity}</span>
              )}
              <span className="font-mono font-bold text-xs shrink-0 w-16 text-right text-gray-900">{fmt(item.unitPrice * item.quantity)}{t.common.d}</span>
              {item.status === "PENDING" && !item.product.slug.startsWith("karaoke-") && (
                <button onClick={() => onCancelItem(item.id)} className="text-[10px] text-red-400 hover:text-red-600 shrink-0 font-medium">{t.order.cancel}</button>
              )}
            </div>
          ))}
          {detail.items.length === 0 && (
            <div className="text-center py-16 text-sm text-gray-400">{t.order.selectItems}</div>
          )}
        </div>

        {/* Totals + Actions */}
        <div className="px-4 py-3 space-y-1 text-sm shrink-0 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between"><span className="text-gray-500">{t.order.tempBill}</span><span className="font-mono font-semibold">{fmt(detail.subtotal)}{t.common.d}</span></div>
          {(detail.vatAmount ?? 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">{t.order.vat}</span><span className="font-mono">{fmt(detail.vatAmount)}{t.common.d}</span></div>}
          {(detail.exciseTaxAmount ?? 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">{t.order.exciseTax}</span><span className="font-mono">{fmt(detail.exciseTaxAmount)}{t.common.d}</span></div>}
          {(detail.serviceCharge ?? 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">{t.order.serviceCharge}</span><span className="font-mono">{fmt(detail.serviceCharge)}{t.common.d}</span></div>}
          {(detail.discountAmount ?? 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">{t.order.discount}</span><span className="font-mono text-emerald-600">-{fmt(detail.discountAmount)}{t.common.d}</span></div>}
          <div className="flex justify-between text-base font-extrabold pt-1.5 border-t border-gray-200 text-amber-600">
            <span>{t.order.total}</span><span className="font-mono">{fmt(detail.totalAmount)}{t.common.d}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-1.5 px-3 py-2.5 shrink-0 border-t border-gray-200">
          <button onClick={onSend} disabled={pending || !canSend}
            data-testid="btn-send-kitchen"
            className="col-span-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40 transition-all touch-manipulation">
            <Send className="h-4 w-4" /> {t.order.sendToKitchen}</button>
          <button onClick={onTempBill} className="py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 font-semibold text-xs flex items-center justify-center gap-1 active:scale-[0.98] transition-all touch-manipulation">
            <Printer className="h-3 w-3" /> {t.order.tempBill}</button>
          <button onClick={onMerge} className="py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 font-semibold text-xs flex items-center justify-center gap-1 active:scale-[0.98] transition-all touch-manipulation">
            <Merge className="h-3 w-3" /> {t.order.merge}</button>
          <button onClick={onSplit} className="py-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 font-semibold text-xs flex items-center justify-center gap-1 active:scale-[0.98] transition-all touch-manipulation">
            <Split className="h-3 w-3" /> {t.order.split}</button>
          <button onClick={() => handleCheckoutClick(compact)}
            data-testid="btn-checkout"
            className="col-span-3 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm touch-manipulation">
            <Banknote className="h-4 w-4" /> {t.order.checkout}</button>
        </div>
      </div>
    );
  }

  // ══════ MOBILE: Full-width products + bottom sheet order ══════

  // ══════ Mobile Checkout View (inline, replaces sheet) ══════
  function renderMobileCheckout() {
    const raw = mPaymentAmount.replace(/\D/g, "");
    return (
      <div className="flex-1 flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileCheckout(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 touch-manipulation">
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </button>
            <h3 className="font-bold text-lg">{t.order.checkout}</h3>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="rounded-xl bg-gray-50 p-4 space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.tempBill}</span><span className="font-mono">{fmt(orderDetail!.subtotal)}{t.common.d}</span></div>
            {(orderDetail!.vatAmount ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.vat}</span><span className="font-mono">{fmt(orderDetail!.vatAmount)}{t.common.d}</span></div>}
            {(orderDetail!.exciseTaxAmount ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.exciseTax}</span><span className="font-mono">{fmt(orderDetail!.exciseTaxAmount)}{t.common.d}</span></div>}
            {(orderDetail!.serviceCharge ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.serviceCharge}</span><span className="font-mono">{fmt(orderDetail!.serviceCharge)}{t.common.d}</span></div>}
            {(orderDetail!.discountAmount ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.discount}</span><span className="font-mono text-emerald-600">-{fmt(orderDetail!.discountAmount)}{t.common.d}</span></div>}
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-1.5 text-amber-600"><span>{t.order.total}</span><span className="font-mono">{fmt(orderDetail!.totalAmount)}{t.common.d}</span></div>
          </div>
          <div><label className="text-sm font-medium text-gray-700 block mb-1">{t.order.paymentMethod}</label>
            <select className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm" value={mPaymentMethod} onChange={e => setMPaymentMethod(e.target.value)}>
              <option value="CASH">💵 {t.order.cash}</option><option value="BANK_TRANSFER">🏦 {t.order.transfer}</option><option value="MOMO">📱 Momo</option></select></div>
          <div><label className="text-sm font-medium text-gray-700 block mb-1">{t.order.amount}</label>
            <input type="text" inputMode="numeric" style={{ textAlign: "right" }} className="w-full h-12 px-4 rounded-lg border border-gray-200 text-xl font-mono font-bold" value={mPaymentAmount ? Number(mPaymentAmount).toLocaleString("vi-VN") : ""} onFocus={e => e.target.value = mPaymentAmount || ""} onBlur={e => { const v = e.target.value.replace(/\D/g, ""); setMPaymentAmount(v); }} onChange={e => { const v = e.target.value.replace(/\D/g, ""); setMPaymentAmount(v); }} placeholder="0" /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setMobileCheckout(false)} className="flex-1 h-12 rounded-xl border border-gray-200 font-medium text-sm text-gray-600 touch-manipulation">{t.order.cancel}</button>
            <button onClick={() => { if (!mobileCheckoutPending) onMobileCheckout(mPaymentMethod, raw); }} disabled={mobileCheckoutPending || !raw || Number.parseFloat(raw) <= 0} className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm touch-manipulation">
              {mobileCheckoutPending ? (<><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> {t.common.loading}</>) : (t.order.confirm + " — " + fmt(orderDetail!.totalAmount) + (t.common.d || ""))}
            </button>
          </div>
        </div>
      </div>
    );
  }
  const btClickHandler = btState.connected ? onBtDisconnect : onBtConnect;
  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* Compact Header */}
        <div className="flex items-center justify-between px-3 py-2 gap-2 shrink-0 bg-amber-500 text-white">
          <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-white/10 active:scale-90 transition-all touch-manipulation">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-extrabold text-sm">{orderDetail.table?.name}</span>
            <span className="text-xs opacity-80">#{String(orderDetail.orderNumber).padStart(8, "0")}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button onClick={() => onGuestChange(-1)} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-90 touch-manipulation">−</button>
            <span className="font-medium">{orderDetail.guestCount}</span>
            <button onClick={() => onGuestChange(1)} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-90 touch-manipulation">+</button>
            <Users className="h-3 w-3 ml-1 opacity-70" />
          </div>
          <button
            onClick={btClickHandler}
            disabled={btState.connecting}
            className={`p-1.5 rounded-lg transition-all touch-manipulation ${btState.connected ? "bg-white/20 text-white" : "bg-white/20 text-white/60"}`}
          >
            {getBluetoothIcon(btState)}
          </button>
        </div>

        {/* Product Catalog — full width / Checkout View */}
        {mobileCheckout ? (
          renderMobileCheckout()
        ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category tabs */}
          <div className="px-2 py-1.5 flex gap-1 overflow-x-auto shrink-0 bg-gray-50 border-b border-gray-200">
            {categories.map(c => (
              <button key={c.id} onClick={() => setActiveCatId(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all active:scale-95 touch-manipulation ${
                  activeCatId === c.id ? "bg-white text-amber-700 border border-gray-200 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                {c.name}
              </button>
            ))}
          </div>
          {/* Product grid — 2 cols on mobile */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-2 gap-2">
              {activeCat?.products.map(p => (
                <button key={p.id} onClick={() => onAddItem(p)}
                  className="bg-white rounded-xl p-3 text-left border border-gray-200 hover:border-amber-300 hover:shadow-sm active:scale-[0.97] transition-all touch-manipulation">
                  <div className="flex items-center gap-1">
                    <UtensilsCrossed className="h-3 w-3 text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-gray-900 truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs font-bold text-amber-600">{fmt(p.price)}{t.common.d}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{p.unit?.name}</span>
                  </div>
                  {(p.toppingGroups?.length ?? 0) > 0 && (
                    <span className="text-[10px] mt-1 block font-medium text-amber-600">+ {t.order.topping}</span>
                  )}
                </button>
              ))}
              {activeCat?.products.length === 0 && (
                <div className="col-span-full text-center py-12 text-sm text-gray-400">{t.settings.noData}</div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Floating Order Button — hide during checkout */}
        {!mobileCheckout && (
        <button
          onClick={() => setOrderSheetOpen(true)}
          className="fixed bottom-16 left-3 right-3 z-30 h-12 rounded-xl bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all touch-manipulation"
        >
          <ShoppingCart className="h-5 w-5" />
          <span>{t.order.orderedItems} ({orderDetail.items.length})</span>
          <span className="font-mono">{fmt(orderDetail.totalAmount)}{t.common.d}</span>
        </button>
        )}

        {/* Order Sheet — slides up from bottom */}
        <Sheet open={orderSheetOpen} onOpenChange={setOrderSheetOpen}>
          <SheetContent side="bottom" className="h-[80vh] p-0 rounded-t-2xl [&>button]:hidden">
            {renderOrderPanel(true)}
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // ══════ TABLET / DESKTOP: Side-by-side ══════
  let btTitle = t.order.bluetoothConnect;
  if (btState.connected) btTitle = t.order.bluetoothConnected;
  else if (btState.connecting) btTitle = t.order.bluetoothConnecting;
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 gap-3 shrink-0 bg-amber-500 text-white">
        <button onClick={onBack} className="p-1.5 -ml-1 rounded-lg hover:bg-white/10 active:scale-90 transition-all">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="font-extrabold text-lg">{orderDetail.table?.name}</span>
          <span className="text-sm opacity-90">#{String(orderDetail.orderNumber).padStart(8, "0")}{orderDetail.orderNumberSuffix ? `-${orderDetail.orderNumberSuffix}` : ""}</span>
          <span className="text-xs opacity-70 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {orderDetail.closedAt
              ? `${t.order.closedAt} · ${new Date(orderDetail.closedAt).toLocaleTimeString(getDateLocale(locale), { hour: "2-digit", minute: "2-digit" })}`
              : `${t.order.openedAt} ${new Date(orderDetail.openedAt).toLocaleTimeString(getDateLocale(locale), { hour: "2-digit", minute: "2-digit" })}`
            }
          </span>
          <span className="text-xs opacity-70 flex items-center gap-1">
            <Users className="h-3 w-3" />
            <button onClick={() => onGuestChange(-1)} className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-90 transition-all text-xs">−</button>
            <span className="font-medium">{orderDetail.guestCount}</span>
            <button onClick={() => onGuestChange(1)} className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 active:scale-90 transition-all text-xs">+</button>
          </span>
        </div>
        <span className="text-sm font-bold">{t.order.total}: {fmt(orderDetail.totalAmount)}{t.common.d}</span>
        <button
          onClick={btClickHandler}
          disabled={btState.connecting}
          className={`p-1.5 rounded-lg transition-all ${btState.connected ? "bg-white/20 text-white hover:bg-white/30" : "bg-white/20 text-white/60 hover:bg-white/30"}`}
          title={btTitle}
        >
          {getBluetoothIcon(btState)}
        </button>
      </div>

      {/* Body: Products | Order Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT — Products */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 flex gap-1.5 overflow-x-auto shrink-0 bg-gray-50 border-b border-gray-200">
            {categories.map(c => (
              <button key={c.id} onClick={() => setActiveCatId(c.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                  activeCatId === c.id ? "bg-white text-amber-700 border border-gray-200 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className={`grid ${isTablet ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5" : "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7"} gap-2`}>
              {activeCat?.products.map(p => (
                <button key={p.id} onClick={() => onAddItem(p)}
                  data-testid="product-btn"
                  className="bg-white rounded-lg p-3 text-left border border-gray-200 hover:border-amber-300 hover:shadow-sm active:scale-[0.97] transition-all">
                  <div className="flex items-center gap-1">
                    <UtensilsCrossed className="h-3 w-3 text-amber-500 shrink-0" />
                    <span className="text-xs font-semibold text-gray-900 truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs font-bold text-amber-600">{fmt(p.price)}{t.common.d}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{p.unit?.name}</span>
                  </div>
                  {(p.toppingGroups?.length ?? 0) > 0 && (
                    <span className="text-[10px] mt-1 block font-medium text-amber-600">+ {t.order.topping}</span>
                  )}
                </button>
              ))}
              {activeCat?.products.length === 0 && (
                <div className="col-span-full text-center py-12 text-sm text-gray-400">{t.settings.noData}</div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — Order Panel */}
        <div className={`${sidebarW} shrink-0 flex flex-col border-l border-gray-200`}>
          {renderOrderPanel()}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────
export function OrderClient({ areas, categories }: Readonly<{ areas: Area[]; categories: Category[] }>) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState<"tables" | "order">("tables");
  const [activeAreaId, setActiveAreaId] = useState(areas[0]?.id ?? "");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toppingProduct, setToppingProduct] = useState<ProductInfo | null>(null);
  const [toppingSelections, setToppingSelections] = useState<Record<string, boolean>>({});

  // Dialogs
  const [checkoutDialog, setCheckoutDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [mobileCheckoutPending, setMobileCheckoutPending] = useState(false);
  const [splitDialog, setSplitDialog] = useState(false);
  const [splitTableId, setSplitTableId] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Bluetooth printer
  const bt = useBluetoothPrinter();

  const refreshOrder = useCallback(async () => {
    if (!activeOrderId) return;
    setOrderDetail(await getOrder(activeOrderId));
  }, [activeOrderId]);

  // Refetch order detail when active order or refresh key changes — intentional reactive fetch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (activeOrderId) refreshOrder(); }, [refreshOrder, refreshKey, activeOrderId]);
  useEffect(() => { const interval = setInterval(() => router.refresh(), 30000); return () => clearInterval(interval); }, [router]);
  // Auto-refresh karaoke orders every 30s to update time
  useEffect(() => {
    if (orderDetail?.type !== "KARAOKE" || !activeOrderId) return;
    const interval = setInterval(async () => {
      await refreshKaraokeTime(activeOrderId);
      setRefreshKey(k => k + 1);
    }, 30000);
    return () => clearInterval(interval);
    // Re-arm interval only on order identity/type change, not on every orderDetail mutation.
  }, [orderDetail?.id, orderDetail?.type, activeOrderId]);

  function handleBack() { setView("tables"); setActiveOrderId(null); setOrderDetail(null); }

  // Table actions
  function handleOpenTable(table: TableInfo) {
    start(async () => {
      const o = await openTable(table.id, 1);
      setActiveOrderId(o.id); setView("order"); setRefreshKey(k => k + 1);
    });
  }
  function handleSelectOrder(orderId: string) {
    setActiveOrderId(orderId); setView("order");
    start(async () => {
      await refreshKaraokeTime(orderId);
      setRefreshKey(k => k + 1);
    });
  }

  // Merge tables (multi-select)
  async function handleMergeTables(orderIds: string[], targetTableId: string) {
    await mergeTables(orderIds, targetTableId);
    setRefreshKey(k => k + 1);
    router.refresh();
  }
  // Split tables
  async function handleSplitTable(orderId: string) {
    const detail = await getOrder(orderId);
    setOrderDetail(detail);
    setSplitTableId(orderId);
    setSelectedItemIds(new Set());
    setSplitDialog(true);
  }
  async function confirmSplit() {
    if (selectedItemIds.size === 0 || !splitTableId) { toast.error(t.order.selectItems); return; }
    start(async () => {
      await splitItemsEvenly(splitTableId, Array.from(selectedItemIds));
      toast.success(t.order.split + "!");
      setSplitDialog(false); setRefreshKey(k => k + 1); router.refresh();
    });
  }

  // Product actions
  function handleAddItem(product: ProductInfo) {
    const groups = product.toppingGroups?.filter(g => g.toppingGroup.toppings.length > 0);
    if (groups && groups.length > 0) {
      const sel: Record<string, boolean> = {};
      groups.forEach(g => g.toppingGroup.toppings.forEach(tp => { sel[tp.id] = false; }));
      setToppingSelections(sel); setToppingProduct(product);
    } else {
      if (!activeOrderId) return;
      start(async () => { await addItem(activeOrderId, product.id, 1); setRefreshKey(k => k + 1); });
    }
  }
  function confirmTopping() {
    if (!toppingProduct || !activeOrderId) return;
    start(async () => {
      const selected = getSelectedToppings(toppingProduct, toppingSelections);
      await addItem(activeOrderId, toppingProduct.id, 1, selected.length > 0 ? selected : undefined);
      setRefreshKey(k => k + 1); setToppingProduct(null);
    });
  }
  function handleUpdateQty(itemId: string, qty: number) { updateItemQuantity(itemId, qty); setTimeout(() => setRefreshKey(k => k + 1), 200); }
  function handleRemoveItem(itemId: string) { removeItem(itemId); setTimeout(() => setRefreshKey(k => k + 1), 200); }
  function handleCancelItem(itemId: string) { start(async () => { await cancelItem(itemId, "user"); setRefreshKey(k => k + 1); }); }
  async function handlePrintBluetooth(orderId: string, type: string) {
    try {
      const res = await fetch(`/api/render-print?orderId=${orderId}&type=${type}`);
      const data = await res.json();
      if (data.content) {
        const ok = await bt.print(data.content);
        const typeLabel = ({ ORDER: t.order.kitchen, BILL: t.order.bill } as Record<string, string>)[type] ?? t.order.prebill;
        if (ok) toast.success(t.order.printSuccess.replace("{type}", typeLabel));
        else toast.error(t.order.printFailed);
      } else {
        toast.info("Sent print request to server");
      }
    } catch {
      // Print via server — no Bluetooth needed
    }
  }

  function handleSend() {
    if (!activeOrderId) return;
    start(async () => {
      await sendOrder(activeOrderId, activeAreaId);
      toast.success(t.order.sendSuccess);
      if (bt.connected) await handlePrintBluetooth(activeOrderId, "ORDER");
      setRefreshKey(k => k + 1);
    });
  }
  function handleTempBill() {
    if (!activeOrderId) return;
    start(async () => {
      await printTempBill(activeOrderId);
      if (bt.connected) await handlePrintBluetooth(activeOrderId, "TEMP_BILL");
      else toast.success(t.order.tempBillSuccess);
    });
  }
  function handleCheckout() {
    if (!orderDetail) return;
    setPaymentAmount(orderDetail.totalAmount.toString());
    setCheckoutDialog(true);
  }
  function confirmCheckout() {
    if (!activeOrderId) return;
    start(async () => {
      await checkoutOrder(activeOrderId, [{ method: paymentMethod, amount: Number.parseFloat(paymentAmount) }]);
      toast.success(t.order.checkoutSuccess);
      setCheckoutDialog(false);
      if (bt.connected) await handlePrintBluetooth(activeOrderId, "BILL");
      handleBack();
      router.refresh();
    });
  }
  // Mobile checkout: inline, no dialog
  function handleMobileCheckout(method: string, amount: string) {
    if (!activeOrderId || mobileCheckoutPending) return;
    setMobileCheckoutPending(true);
    start(async () => {
      try {
        await checkoutOrder(activeOrderId, [{ method, amount: Number.parseFloat(amount) }]);
        toast.success(t.order.checkoutSuccess);
        if (bt.connected) await handlePrintBluetooth(activeOrderId, "BILL");
        handleBack();
        router.refresh();
      } catch {
        toast.error(t.common.error);
      } finally {
        setMobileCheckoutPending(false);
      }
    });
  }
  function handleGuestChange(delta: number) {
    if (!activeOrderId || !orderDetail) return;
    start(async () => { await updateOrderGuest(activeOrderId, Math.max(1, orderDetail.guestCount + delta)); setRefreshKey(k => k + 1); });
  }

  return (
    <div className="h-full overflow-hidden">
      {view === "tables" && areas.length > 0 && (
        <TableGridView areas={areas} activeAreaId={activeAreaId} setActiveAreaId={setActiveAreaId}
          onOpenTable={handleOpenTable} onSelectOrder={handleSelectOrder}
          onMergeTables={handleMergeTables} onSplitTable={handleSplitTable} />
      )}

      {view === "order" && orderDetail && (
        <OrderDetailView orderDetail={orderDetail} categories={categories} onBack={handleBack}
          onSend={handleSend} onTempBill={handleTempBill} onCheckout={handleCheckout} onMerge={() => handleBack()} onSplit={() => handleBack()}
          onAddItem={handleAddItem} onUpdateQty={handleUpdateQty} onRemoveItem={handleRemoveItem}
          onCancelItem={handleCancelItem} pending={pending} onGuestChange={handleGuestChange}
          btState={{ connected: bt.connected, connecting: bt.connecting, error: bt.error }}
          onBtConnect={bt.connect} onBtDisconnect={bt.disconnect}
          onMobileCheckout={handleMobileCheckout}
          mobileCheckoutPending={mobileCheckoutPending}
        />
      )}

      {/* DIALOGS */}
      {toppingProduct && (
        <MobileSheet open={!!toppingProduct} onClose={() => setToppingProduct(null)} title={`${t.order.topping} — ${toppingProduct.name}`}>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {toppingProduct.toppingGroups?.filter(g => g.toppingGroup.toppings.length > 0).map(g => (
            <div key={g.toppingGroup.id}>
              <p className="text-xs font-bold uppercase text-gray-500 mb-2">{g.toppingGroup.name}</p>
              <div className="space-y-1.5">{g.toppingGroup.toppings.map(topping => (
                <label key={topping.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 cursor-pointer has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50">
                  <input type={g.toppingGroup.type === "SINGLE" ? "radio" : "checkbox"} name={`tg-${g.toppingGroup.id}`} checked={toppingSelections[topping.id] ?? false}
                    onChange={() => updateToppingSelection(g, topping.id, setToppingSelections)} className="h-4 w-4 accent-amber-500" />
                  <span className="text-sm flex-1">{topping.name}</span>
                  {topping.price > 0 ? <span className="text-xs font-medium text-amber-600">+{fmt(topping.price)}{t.common.d}</span> : <span className="text-xs text-emerald-600 font-medium">{t.order.free}</span>}
                </label>
              ))}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => setToppingProduct(null)} className="flex-1 h-11 rounded-lg border border-gray-200 font-medium text-sm text-gray-600">{t.order.cancel}</button>
          <button onClick={confirmTopping} disabled={pending} className="flex-1 h-11 rounded-lg bg-amber-500 text-white font-semibold text-sm">{t.order.addItem}</button>
        </div>
        </MobileSheet>
      )}

      {checkoutDialog && <MobileSheet open={checkoutDialog} onClose={() => setCheckoutDialog(false)} title={t.order.checkout}>
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 p-4 space-y-1.5">
            <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.tempBill}</span><span className="font-mono">{fmt(orderDetail!.subtotal)}{t.common.d}</span></div>
            {(orderDetail!.vatAmount ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.vat}</span><span className="font-mono">{fmt(orderDetail!.vatAmount)}{t.common.d}</span></div>}
            {(orderDetail!.exciseTaxAmount ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.exciseTax}</span><span className="font-mono">{fmt(orderDetail!.exciseTaxAmount)}{t.common.d}</span></div>}
            {(orderDetail!.serviceCharge ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.serviceCharge}</span><span className="font-mono">{fmt(orderDetail!.serviceCharge)}{t.common.d}</span></div>}
            {(orderDetail!.discountAmount ?? 0) > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">{t.order.discount}</span><span className="font-mono text-emerald-600">-{fmt(orderDetail!.discountAmount)}{t.common.d}</span></div>}
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-1.5 text-amber-600"><span>{t.order.total}</span><span className="font-mono">{fmt(orderDetail!.totalAmount)}{t.common.d}</span></div>
          </div>
          <div><label className="text-sm font-medium text-gray-700 block mb-1">{t.order.paymentMethod}</label>
            <select data-testid="checkout-payment-method" className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="CASH">💵 {t.order.cash}</option><option value="BANK_TRANSFER">🏦 {t.order.transfer}</option><option value="MOMO">📱 Momo</option></select></div>
          <div><label className="text-sm font-medium text-gray-700 block mb-1">{t.order.amount}</label>
            <input data-testid="checkout-amount" type="text" inputMode="numeric" style={{ textAlign: 'right' }} className="w-full h-11 px-4 rounded-lg border border-gray-200 text-lg font-mono font-bold" value={paymentAmount ? Number(paymentAmount).toLocaleString("vi-VN") : ""} onFocus={e => e.target.value = paymentAmount || ""} onBlur={e => { const raw = e.target.value.replace(/\D/g, ""); setPaymentAmount(raw); }} onChange={e => { const raw = e.target.value.replace(/\D/g, ""); setPaymentAmount(raw); }} placeholder="0" /></div>
          <div className="flex gap-3">
            <button onClick={() => setCheckoutDialog(false)} className="flex-1 h-11 rounded-lg border border-gray-200 font-medium text-sm text-gray-600">{t.order.cancel}</button>
            <button data-testid="btn-confirm-checkout" onClick={confirmCheckout} disabled={pending} className="flex-1 h-11 rounded-lg bg-red-500 text-white font-semibold text-sm">{t.order.checkout}</button>
          </div>
        </div>
      </MobileSheet>}

      {splitDialog && <MobileSheet open={splitDialog} onClose={() => setSplitDialog(false)} title={t.order.splitTable}>
        <p className="text-sm text-gray-500 mb-3">{t.order.selectItems}</p>
        <div className="space-y-1 max-h-40 overflow-y-auto mb-4">
          {orderDetail?.items.filter(i => i.status !== "CANCELLED").map(item => (
            <label key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 cursor-pointer has-[:checked]:border-purple-500 has-[:checked]:bg-purple-50">
              <input type="checkbox" className="h-4 w-4 accent-purple-500" checked={selectedItemIds.has(item.id)} onChange={() => setSelectedItemIds(p => {
                const n = new Set(p);
                if (n.has(item.id)) {
                  n.delete(item.id);
                } else {
                  n.add(item.id);
                }
                return n;
              })} />
              <span className="text-sm flex-1">{item.product.name} x{item.quantity}</span>
              <span className="text-xs font-mono">{fmt(item.unitPrice * item.quantity)}{t.common.d}</span></label>
          ))}</div>
        <div className="flex gap-3">
          <button onClick={() => setSplitDialog(false)} className="flex-1 h-11 rounded-lg border border-gray-200 font-medium text-sm text-gray-600">{t.order.cancel}</button>
          <button onClick={confirmSplit} disabled={pending || selectedItemIds.size === 0} className="flex-1 h-11 rounded-lg bg-purple-500 text-white font-semibold text-sm">{t.order.split}</button>
        </div>
      </MobileSheet>}
    </div>
  );
}

// Adaptive: Sheet on mobile, Dialog on desktop
function MobileSheet({ open, onClose, title, children }: Readonly<{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }>) {
  const { isMobile } = useDeviceInfo();
  const { t } = useI18n();
  if (!isMobile) {
    return open ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <button type="button" aria-label={t.order.cancel} onClick={onClose} className="absolute inset-0 bg-black/40 cursor-default" />
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
      </div>
    ) : null;
  }
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh] p-0 rounded-t-2xl [&>button]:hidden">
        <div className="px-4 pt-4 pb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
