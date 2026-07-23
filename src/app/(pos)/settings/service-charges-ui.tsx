"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/context";
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

type ServiceCharge = {
  id: string; name: string; type: string; value: number; scope: string;
  applyCondition: string | null; areaId: string | null; area?: { name: string } | null;
  categoryIds: string | null; isActive: boolean;
  startDate: Date | null; endDate: Date | null;
  minOrderValue: number | null; minGuestCount: number | null;
};
type Cat = { id: string; name: string };
type Area = { id: string; name: string };

type ServiceChargeInput = {
  name: string; type: string; value: number; scope?: string; applyCondition?: string;
  areaId?: string; categoryIds?: string; startDate?: string; endDate?: string;
  minOrderValue?: number; minGuestCount?: number; isActive?: boolean;
};

export function ServiceChargesUI({ charges, categories, areas, createServiceCharge, updateServiceCharge, deleteServiceCharge }: Readonly<{
  charges: ServiceCharge[]; categories: Cat[]; areas: Area[];
  createServiceCharge: (data: ServiceChargeInput) => Promise<void>;
  updateServiceCharge: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteServiceCharge: (id: string) => Promise<void>;
}>) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [name, setName] = useState("");
  const [type, setType] = useState("PERCENTAGE");
  const [value, setValue] = useState("0");
  const [scope, setScope] = useState("ALL");
  const [areaId, setAreaId] = useState("");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [applyCondition, setApplyCondition] = useState("ALL_DAYS");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [minGuest, setMinGuest] = useState("");
  const [isActive, setIsActive] = useState(true);

  function reset() {
    setName(""); setType("PERCENTAGE"); setValue("0"); setScope("ALL");
    setAreaId(""); setSelectedCats([]); setApplyCondition("ALL_DAYS");
    setStartDate(""); setEndDate(""); setMinOrder(""); setMinGuest("");
    setIsActive(true);
  }

  function openEdit(c: ServiceCharge) {
    setEditingId(c.id);
    setName(c.name); setType(c.type); setValue(String(c.value)); setScope(c.scope);
    setAreaId(c.areaId || "");
    setSelectedCats(c.categoryIds ? JSON.parse(c.categoryIds) : []);
    setApplyCondition(c.applyCondition || "ALL_DAYS");
    setStartDate(c.startDate ? c.startDate.toISOString().slice(0, 10) : "");
    setEndDate(c.endDate ? c.endDate.toISOString().slice(0, 10) : "");
    setMinOrder(c.minOrderValue ? String(c.minOrderValue) : "");
    setMinGuest(c.minGuestCount ? String(c.minGuestCount) : "");
    setIsActive(c.isActive);
    setOpen(true);
  }

  function save() {
    start(async () => {
      try {
        const payload: ServiceChargeInput = {
          name, type, value: Number.parseFloat(value) || 0, scope,
          applyCondition, isActive,
          areaId: scope === "AREA" ? areaId || undefined : undefined,
          categoryIds: scope === "CATEGORY" ? JSON.stringify(selectedCats) : undefined,
          startDate: applyCondition === "DATE_RANGE" ? startDate || undefined : undefined,
          endDate: applyCondition === "DATE_RANGE" ? endDate || undefined : undefined,
          minOrderValue: applyCondition === "MIN_ORDER" ? (Number.parseFloat(minOrder) || undefined) : undefined,
          minGuestCount: applyCondition === "GUEST_COUNT" ? (Number.parseInt(minGuest) || undefined) : undefined,
        };
        if (editingId) { await updateServiceCharge(editingId, payload); toast.success(t.common.success); }
        else { await createServiceCharge(payload); toast.success(t.common.success); }
        setOpen(false); reset(); setEditingId(null);
      } catch { toast.error(t.common.error); }
    });
  }

  function del(id: string) {
    start(async () => {
      await runAction(() => deleteServiceCharge(id), { success: t.common.success, error: t.common.error });
    });
  }

  const scTypeMap = {
    SERVICE_FEE: t.settings.scType.SERVICE_FEE,
    PERCENTAGE: t.settings.scType.PERCENTAGE,
    FIXED: t.settings.scType.FIXED,
    PER_GUEST: t.settings.scType.PER_GUEST,
  };

  const scopeMap = {
    ALL: t.settings.scScope.ALL,
    AREA: t.settings.scScope.AREA,
    CATEGORY: t.settings.scScope.CATEGORY,
  };

  const condMap = {
    ALL_DAYS: t.settings.scCondition.ALL_DAYS,
    DATE_RANGE: t.settings.scCondition.DATE_RANGE,
    HOLIDAY: t.settings.scCondition.HOLIDAY,
    MIN_ORDER: t.settings.scCondition.MIN_ORDER,
    GUEST_COUNT: t.settings.scCondition.GUEST_COUNT,
  };

  function condLabel(d: ServiceCharge) {
    const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US" };
    const dateLocale = localeMap[locale] ?? "vi-VN";
    switch (d.applyCondition) {
      case "DATE_RANGE": {
        if (!d.startDate) return t.settings.scCondition.DATE_RANGE;
        const start = new Date(d.startDate).toLocaleDateString(dateLocale);
        const end = d.endDate ? new Date(d.endDate).toLocaleDateString(dateLocale) : "∞";
        return `${start} → ${end}`;
      }
      case "HOLIDAY": return t.settings.scCondition.HOLIDAY;
      case "MIN_ORDER": return `${t.settings.scCondition.MIN_ORDER.replace("X", new Intl.NumberFormat().format(d.minOrderValue || 0) + t.common.d)}`;
      case "GUEST_COUNT": return `${t.settings.scCondition.GUEST_COUNT.replace("X", String(d.minGuestCount))}`;
      default: return t.settings.scAllDays;
    }
  }

  function chargeValueLabel(c: ServiceCharge) {
    if (c.type === "PERCENTAGE") return `${c.value}%`;
    if (c.type === "PER_GUEST") return `${new Intl.NumberFormat().format(c.value)}${t.common.d}/${t.order.guestCount.toLowerCase()}`;
    return `${new Intl.NumberFormat().format(c.value)}${t.common.d}`;
  }

  function chargeScopeLabel(c: ServiceCharge) {
    if (c.scope === "AREA") return `${t.settings.areas}: ${c.area?.name || c.areaId}`;
    if (c.scope === "CATEGORY" && c.categoryIds) {
      return (
        <span className="flex flex-wrap gap-1">
          {(JSON.parse(c.categoryIds) as string[]).map((cid) => (
            <span key={cid} className="bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
              {categories.find(x => x.id === cid)?.name || cid}
            </span>
          ))}
        </span>
      );
    }
    return t.settings.allItems;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">{t.settings.serviceCharges}</h2>
          <p className="text-sm text-muted-foreground">{t.settings.sidebar.serviceCharges}</p>
        </div>
        <Button size="sm" onClick={() => { reset(); setEditingId(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> {t.common.add}</Button>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold">{t.settings.name}</th>
              <th className="text-left px-4 py-3 font-semibold">{t.settings.type}</th>
              <th className="text-right px-4 py-3 font-semibold">{t.settings.price}</th>
              <th className="text-left px-4 py-3 font-semibold">{t.settings.scScopeLabel}</th>
              <th className="text-left px-4 py-3 font-semibold">{t.settings.scConditionLabel}</th>
              <th className="text-center px-4 py-3 font-semibold">{t.settings.status}</th>
              <th className="w-20 px-4 py-3 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {charges.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">{t.common.noData}</td></tr>}
            {charges.map(c => (
              <tr key={c.id} className="hover:bg-amber-50/30 transition-colors">
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{scTypeMap[c.type as keyof typeof scTypeMap] || c.type}</Badge></td>
                <td className="px-4 py-3 text-right font-mono">
                  {chargeValueLabel(c)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {chargeScopeLabel(c)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{condLabel(c)}</td>
                <td className="px-4 py-3 text-center">{c.isActive ? <Badge className="bg-emerald-50 text-emerald-700 text-xs">{t.settings.active}</Badge> : <Badge variant="secondary" className="text-xs">{t.settings.inactive}</Badge>}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500" onClick={() => del(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingId ? t.settings.edit : t.common.add}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[68vh] overflow-y-auto py-2">
            <div className="space-y-1"><Label>{t.settings.name}</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t.settings.type}</Label>
                <Select value={type} onValueChange={v => setType(v || "PERCENTAGE")}>
                  <SelectTrigger><SelectValue>{scTypeMap[type as keyof typeof scTypeMap]}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {Object.entries(scTypeMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>{t.settings.price}</Label><Input type="number" value={value} onChange={e => setValue(e.target.value)} /></div>
            </div>

            <div className="space-y-1"><Label>{t.settings.scScopeLabel}</Label>
              <Select value={scope} onValueChange={v => setScope(v || "ALL")}>
                <SelectTrigger><SelectValue>{scopeMap[scope as keyof typeof scopeMap]}</SelectValue></SelectTrigger>
                <SelectContent>
                  {Object.entries(scopeMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {scope === "AREA" && (
              <div className="space-y-1"><Label>{t.settings.areas}</Label>
                <Select value={areaId} onValueChange={v => setAreaId(v || "")}>
                  <SelectTrigger><SelectValue placeholder={t.settings.areas}>{areas.find(a => a.id === areaId)?.name}</SelectValue></SelectTrigger>
                  <SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
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

            <div className="space-y-1"><Label>{t.settings.scCondition.ALL_DAYS}</Label>
              <Select value={applyCondition} onValueChange={v => setApplyCondition(v || "ALL_DAYS")}>
                <SelectTrigger><SelectValue>{condMap[applyCondition as keyof typeof condMap]}</SelectValue></SelectTrigger>
                <SelectContent>
                  {Object.entries(condMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {applyCondition === "DATE_RANGE" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>{t.reports.fromDate}</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div className="space-y-1"><Label>{t.reports.toDate}</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
              </div>
            )}
            {applyCondition === "MIN_ORDER" && (
              <div className="space-y-1"><Label>{t.settings.scCondition.MIN_ORDER} ({t.common.d})</Label><Input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} /></div>
            )}
            {applyCondition === "GUEST_COUNT" && (
              <div className="space-y-1"><Label>{t.settings.scCondition.GUEST_COUNT}</Label><Input type="number" value={minGuest} onChange={e => setMinGuest(e.target.value)} /></div>
            )}

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
