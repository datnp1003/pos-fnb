"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";

import { useI18n } from "@/i18n/context";

type Holiday = { id: string; name: string; date: Date; recurring: boolean };
type HolidayInput = { name: string; date: string; recurring?: boolean };

export function HolidaysUI({ holidays, createHoliday, updateHoliday, deleteHoliday }: {
  readonly holidays: Holiday[];
  readonly createHoliday: (data: HolidayInput) => Promise<void>;
  readonly updateHoliday: (id: string, data: HolidayInput) => Promise<void>;
  readonly deleteHoliday: (id: string) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState(true);

  function reset() { setName(""); setDate(""); setRecurring(true); }
  function openEdit(h: Holiday) {
    setEditingId(h.id);
    setName(h.name);
    setDate(h.date instanceof Date ? h.date.toISOString().slice(0, 10) : String(h.date).slice(0, 10));
    setRecurring(h.recurring);
    setOpen(true);
  }

  function save() {
    start(async () => {
      try {
        const payload = { name, date, recurring };
        if (editingId) { await updateHoliday(editingId, payload); toast.success(t.settings.updated); }
        else { await createHoliday(payload); toast.success(t.settings.added); }
        setOpen(false); reset(); setEditingId(null);
      } catch { toast.error(t.common.error); }
    });
  }

  function del(id: string) {
    start(async () => { try { await deleteHoliday(id); toast.success(t.settings.deleted); } catch { toast.error(t.common.error); } });
  }

  const localeMap: Record<string, string> = { pt: "pt-BR", en: "en-US" };
  const dateLocale = localeMap[locale] ?? "vi-VN";
  const today = new Date();
  const upcoming = holidays.filter(h => new Date(h.date) >= today);
  const past = holidays.filter(h => new Date(h.date) < today);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">{t.inventory.holidayTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.inventory.holidayDesc}</p>
        </div>
        <Button size="sm" onClick={() => { reset(); setEditingId(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> {t.inventory.addHolidayBtn}</Button>
      </div>

      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
        <p className="font-semibold text-amber-800 mb-1">{t.inventory.holidayUsageTitle}</p>
        <p className="text-xs text-amber-700">
          {t.settings.holidayPageDesc}
          {t.inventory.holidayUsageDetail}
        </p>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> {t.inventory.upcomingOrOngoing}
          </h3>
          <div className="space-y-1.5">
            {upcoming.map(h => (
              <div key={h.id} className="flex items-center justify-between px-4 py-2.5 bg-white border border-amber-200 rounded-lg hover:bg-amber-50/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    {new Date(h.date).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit" })}
                  </span>
                  <span className="font-medium text-sm">{h.name}</span>
                  {h.recurring && <Badge variant="outline" className="text-xs">{t.inventory.recurringYearly}</Badge>}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(h)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-500" onClick={() => del(h.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">{t.inventory.past}</h3>
          <div className="space-y-1">
            {past.map(h => (
              <div key={h.id} className="flex items-center justify-between px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg opacity-60">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400">{new Date(h.date).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit" })}</span>
                  <span className="text-sm">{h.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(h)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-500" onClick={() => del(h.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? t.settings.editHoliday : t.settings.addHoliday}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t.inventory.holidayName}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={t.inventory.holidayPlaceholder} /></div>
            <div className="space-y-1"><Label>{t.inventory.holidayDate}</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div className="flex items-center gap-2">
              <Checkbox checked={recurring} onCheckedChange={v => setRecurring(!!v)} />
              <Label className="text-xs">{t.inventory.recurringLabel}</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={save} disabled={pending}>{pending ? t.common.saving : t.common.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
