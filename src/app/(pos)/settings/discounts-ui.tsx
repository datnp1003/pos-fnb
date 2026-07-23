"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { runAction } from "@/lib/run-action";
import { useI18n } from "@/i18n/context";

type Discount = {
  id: string; name: string; type: string; value: number; scope: string;
  isActive: boolean; startDate: Date | null; endDate: Date | null;
  happyHourStart: string | null; happyHourEnd: string | null;
  dayOfWeek: string | null; minOrderValue: number | null;
  categoryIds: string | null;
};
type Cat = { id: string; name: string };

const LOCALE_TO_DATE_LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US" };

function getDateLocale(locale: string): string {
  return LOCALE_TO_DATE_LOCALE[locale] ?? "vi-VN";
}

function getTypeLabel(type: string, fixedLabel: string): string {
  if (type === "PERCENTAGE") return "%";
  if (type === "FIXED") return fixedLabel;
  return "XY";
}

type DiscountInput = {
  name: string; type: string; value: number; scope?: string;
  startDate?: string; endDate?: string; happyHourStart?: string; happyHourEnd?: string;
  minOrderValue?: number; dayOfWeek?: string; categoryIds?: string; isActive?: boolean;
};

export function DiscountsUI({ discounts, categories, createDiscount, updateDiscount, deleteDiscount }: {
  readonly discounts: Discount[]; readonly categories: Cat[];
  readonly createDiscount: (data: DiscountInput) => Promise<void>;
  readonly updateDiscount: (id: string, data: Record<string, unknown>) => Promise<void>;
  readonly deleteDiscount: (id: string) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [name, setName] = useState("");
  const [type, setType] = useState("PERCENTAGE");
  const [value, setValue] = useState("0");
  const [scope, setScope] = useState("ALL");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hhStart, setHhStart] = useState("");
  const [hhEnd, setHhEnd] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [isActive, setIsActive] = useState(true);

  function reset() {
    setName(""); setType("PERCENTAGE"); setValue("0"); setScope("ALL");
    setSelectedCats([]); setStartDate(""); setEndDate(""); setHhStart(""); setHhEnd("");
    setDayOfWeek(""); setMinOrder(""); setIsActive(true);
  }

  function openEdit(d: Discount) {
    setEditingId(d.id);
    setName(d.name); setType(d.type); setValue(String(d.value)); setScope(d.scope);
    setSelectedCats(d.categoryIds ? JSON.parse(d.categoryIds) : []);
    setStartDate(d.startDate ? d.startDate.toISOString().slice(0, 10) : "");
    setEndDate(d.endDate ? d.endDate.toISOString().slice(0, 10) : "");
    setHhStart(d.happyHourStart || ""); setHhEnd(d.happyHourEnd || "");
    setDayOfWeek(d.dayOfWeek || ""); setMinOrder(d.minOrderValue ? String(d.minOrderValue) : "");
    setIsActive(d.isActive);
    setOpen(true);
  }

  function save() {
    start(async () => {
      try {
        const payload: DiscountInput = {
          name, type, value: Number.parseFloat(value) || 0, scope,
          categoryIds: scope === "CATEGORY" ? JSON.stringify(selectedCats) : undefined,
          startDate: startDate || undefined, endDate: endDate || undefined,
          happyHourStart: hhStart || undefined, happyHourEnd: hhEnd || undefined,
          dayOfWeek: dayOfWeek || undefined, minOrderValue: minOrder ? Number.parseFloat(minOrder) : undefined,
          isActive,
        };
        if (editingId) { await updateDiscount(editingId, payload); toast.success(t.common.success); }
        else { await createDiscount(payload); toast.success(t.common.success); }
        setOpen(false); reset(); setEditingId(null);
      } catch { toast.error(t.common.error); }
    });
  }

  function del(id: string) {
    start(async () => {
      await runAction(() => deleteDiscount(id), { success: t.common.success, error: t.common.error });
    });
  }

  function renderDateCell(d: Discount, dateLocale: string, unlimitedLabel: string) {
    if (!d.startDate) return unlimitedLabel;
    const start = new Date(d.startDate).toLocaleDateString(dateLocale);
    const end = d.endDate ? new Date(d.endDate).toLocaleDateString(dateLocale) : "∞";
    return (
      <>
        {`${start} → ${end}`}
        {d.happyHourStart && <span className="block">🍸 {d.happyHourStart}–{d.happyHourEnd}</span>}
      </>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">{t.settings.discounts}</h2>
          <p className="text-sm text-muted-foreground">{t.settings.discountPageDesc}</p>
        </div>
        <Button size="sm" onClick={() => { reset(); setEditingId(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> {t.common.add}</Button>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold">{t.settings.name}</th>
              <th className="text-left px-4 py-3 font-semibold">{t.settings.type}</th>
              <th className="text-right px-4 py-3 font-semibold">{t.settings.discountValue}</th>
              <th className="text-left px-4 py-3 font-semibold">{t.settings.scScopeLabel}</th>
              <th className="text-left px-4 py-3 font-semibold">{t.settings.discountDates}</th>
              <th className="text-center px-4 py-3 font-semibold">{t.settings.status}</th>
              <th className="w-20 px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {discounts.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">{t.common.noData}</td></tr>}
            {discounts.map(d => (
              <tr key={d.id} className="hover:bg-amber-50/30 transition-colors">
                <td className="px-4 py-3 font-semibold">{d.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">{getTypeLabel(d.type, t.common.d)}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {d.type === "PERCENTAGE" ? `${d.value}%` : `${new Intl.NumberFormat().format(d.value)}${t.common.d}`}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {d.scope === "CATEGORY" && d.categoryIds ? (
                    <span className="flex flex-wrap gap-1">
                      {JSON.parse(d.categoryIds).map((cid: string) => <span key={cid} className="bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">{categories.find(c => c.id === cid)?.name || cid}</span>)}
                    </span>
                  ) : t.settings.allItems}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {renderDateCell(d, getDateLocale(locale), t.settings.discountUnlimited)}
                </td>
                <td className="px-4 py-3 text-center">{d.isActive ? <Badge className="bg-emerald-50 text-emerald-700 text-xs">ON</Badge> : <Badge variant="secondary" className="text-xs">OFF</Badge>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500" onClick={() => del(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? t.settings.editDiscount : t.settings.addDiscount}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[68vh] overflow-y-auto py-2">
            <div className="space-y-1"><Label>{t.settings.name}</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t.settings.type}</Label>
                <Select value={type} onValueChange={v => setType(v || "PERCENTAGE")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">{t.settings.discountType?.PERCENTAGE || "% - Percent"}</SelectItem>
                    <SelectItem value="FIXED">{t.settings.discountType?.FIXED || `${t.common.d} - Fixed`}</SelectItem>
                    <SelectItem value="BUY_X_GET_Y">{t.settings.discountType?.BUY_X_GET_Y || "Buy X Get Y"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>{t.settings.discountValue}</Label>
                <Input type="number" value={value} onChange={e => setValue(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1"><Label>{t.settings.scScopeLabel}</Label>
              <Select value={scope} onValueChange={v => setScope(v || "ALL")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.settings.discountScope?.ALL || "All"}</SelectItem>
                  <SelectItem value="CATEGORY">{t.settings.discountScope?.CATEGORY || "By Category"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "CATEGORY" && (
              <div className="space-y-1">
                <Label>{t.settings.categories}</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-lg">
                  {categories.map(c => (
                    <label key={c.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer transition ${selectedCats.includes(c.id) ? "bg-amber-100 text-amber-800 border border-amber-300" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}>
                      <Checkbox checked={selectedCats.includes(c.id)} onCheckedChange={v => v ? setSelectedCats([...selectedCats, c.id]) : setSelectedCats(selectedCats.filter(x => x !== c.id))} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t.reports.fromDate}</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div className="space-y-1"><Label>{t.reports.toDate}</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={isActive} onCheckedChange={v => setIsActive(!!v)} />
              <Label className="text-xs">{t.settings.active}</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={save} disabled={pending}>{pending ? t.common.saving : t.common.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
