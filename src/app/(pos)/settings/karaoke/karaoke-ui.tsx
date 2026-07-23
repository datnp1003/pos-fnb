"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";

type KP = { id: string; name: string; areaId: string; startTime: string; endTime: string; pricePerHour: number; minHours: number; dayType: string; timeUnit?: string; area?: { id: string; name: string } };
type Area = { id: string; name: string; type: string };

type KPInput = { name: string; areaId: string; startTime: string; endTime: string; pricePerHour: number; minHours?: number; dayType?: string; timeUnit?: string };

type Props = Readonly<{
  pricings: KP[];
  areas: Area[];
  createKP: (data: KPInput) => Promise<void>;
  updateKP: (id: string, data: Record<string, unknown>) => Promise<void>;
  deleteKP: (id: string) => Promise<void>;
}>;

const fmt = (v: number) => new Intl.NumberFormat("vi-VN").format(v);

export function KaraokePricingManager({ pricings, areas, createKP, updateKP, deleteKP }: Props) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<KP | null>(null);
  const [form, setForm] = useState({ name: "", areaId: "", startTime: "10:00", endTime: "18:00", pricePerHour: "100000", minHours: "1", dayType: "ALL", timeUnit: "HOUR" });

  function openNew() { setEditing(null); const firstKara = areas.find(a => a.type === "KARAOKE"); setForm({ name: "", areaId: firstKara?.id ?? "", startTime: "10:00", endTime: "18:00", pricePerHour: "100000", minHours: "1", dayType: "ALL", timeUnit: "HOUR" }); setOpen(true); }
  function openEdit(kp: KP) {
    setEditing(kp);
    setForm({ name: kp.name, areaId: kp.areaId, startTime: kp.startTime, endTime: kp.endTime, pricePerHour: kp.pricePerHour.toString(), minHours: kp.minHours.toString(), dayType: kp.dayType, timeUnit: kp.timeUnit || "HOUR" });
    setOpen(true);
  }

  function save() {
    start(async () => {
      try {
        const data = { ...form, pricePerHour: Number(form.pricePerHour), minHours: Number(form.minHours) };
        if (editing) { await updateKP(editing.id, data); toast.success(t.common.success); }
        else { await createKP(data); toast.success(t.common.success); }
        setOpen(false);
      } catch { toast.error(t.common.error); }
    });
  }

  function doDelete(id: string) {
    start(async () => { try { await deleteKP(id); toast.success(t.common.success); } catch { toast.error(t.common.error); } });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">{t.settings.karaoke}</h2>
          <p className="text-sm text-muted-foreground">{t.settings.sidebar.karaoke || "Karaoke Pricing"}</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> t.settings.addKaraokePrice</Button>
      </div>

      {pricings.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border border-dashed rounded-xl">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t.settings.noPricing}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {pricings.map(kp => (
            <Card key={kp.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{kp.name}</CardTitle>
                    <Badge variant="secondary">{t.settings.dayTypes[kp.dayType as keyof typeof t.settings.dayTypes] || kp.dayType}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(kp)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => doDelete(kp.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {t.settings.areaTypeLabel}</span>
                    <p className="font-medium mt-0.5">{kp.area?.name || kp.areaId}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {t.settings.timeSlotLabel}</span>
                    <p className="font-medium mt-0.5">{kp.startTime} – {kp.endTime}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{t.settings.unitLabel}</span>
                    <p className="font-medium mt-0.5">{t.settings.timeUnits[kp.timeUnit as keyof typeof t.settings.timeUnits] || kp.timeUnit}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{t.settings.pricePerUnit.replace("{unit}", t.settings.timeUnits[kp.timeUnit as keyof typeof t.settings.timeUnits] || "?")}</span>
                    <p className="font-bold text-amber-600 mt-0.5">{fmt(kp.pricePerHour)}{t.common.d}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{t.settings.minLabel}</span>
                    <p className="font-medium mt-0.5">{kp.minHours} {t.settings.timeUnits.HOUR}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t.settings.editPrice : t.settings.addKaraokePrice}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t.settings.name}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t.settings.areaTypeLabel}</Label>
              <Select value={form.areaId} onValueChange={v => setForm(f => ({ ...f, areaId: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder={t.settings.areaTypeLabel}>{areas.find(a => a.id === form.areaId)?.name}</SelectValue></SelectTrigger>
                <SelectContent>
                  {areas.filter(a => a.type === "KARAOKE").map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t.settings.timeSlotLabel} — {t.reports.fromDate}</Label>
                <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{t.settings.timeSlotLabel} — {t.reports.toDate}</Label>
                <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t.settings.type}</Label>
              <Select value={form.dayType} onValueChange={v => setForm(f => ({ ...f, dayType: v ?? "" }))}>
                <SelectTrigger><SelectValue>{t.settings.dayTypes[form.dayType as keyof typeof t.settings.dayTypes] || form.dayType}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.settings.dayTypes.ALL}</SelectItem>
                  <SelectItem value="WEEKDAY">{t.settings.dayTypes.WEEKDAY}</SelectItem>
                  <SelectItem value="WEEKEND">{t.settings.dayTypes.WEEKEND}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t.settings.unitLabel}</Label>
                <Select value={form.timeUnit} onValueChange={v => setForm(f => ({ ...f, timeUnit: v ?? "HOUR" }))}>
                  <SelectTrigger><SelectValue>{t.settings.timeUnits[form.timeUnit as keyof typeof t.settings.timeUnits] || form.timeUnit}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MINUTE">{t.settings.timeUnits.MINUTE}</SelectItem>
                    <SelectItem value="HOUR">{t.settings.timeUnits.HOUR}</SelectItem>
                    <SelectItem value="DAY">{t.settings.timeUnits.DAY}</SelectItem>
                    <SelectItem value="MONTH">{t.settings.timeUnits.MONTH}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t.settings.pricePerUnit.replace("{unit}", t.settings.timeUnits[form.timeUnit as keyof typeof t.settings.timeUnits] || "?")} ({t.common.d})</Label>
                <Input type="number" value={form.pricePerHour} onChange={e => setForm(f => ({ ...f, pricePerHour: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={pending}>{pending ? t.common.saving : t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
