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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Printer, Wifi, Server, Smartphone } from "lucide-react";
import { runAction } from "@/lib/run-action";

type PrinterArea = { areaId: string; area?: { name?: string | null } | null };
type P = { id: string; name: string; type: string; ipAddress: string; port: number; paperWidth: number; printMode: string; isActive: boolean; areas: PrinterArea[]; printTemplates: Record<string, unknown>[] };
type A = { id: string; name: string };
type ActionFn = (...args: never[]) => Promise<unknown>;
type LooseFn = (...args: unknown[]) => Promise<unknown>;

export function PrintersManager({
  printers, areas, createPrinter, updatePrinter, deletePrinter
}: Readonly<{ printers: P[]; areas: A[]; createPrinter: ActionFn; updatePrinter: ActionFn; deletePrinter: ActionFn }>) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<P | null>(null);
  const [form, setForm] = useState({
    name: "", type: "KITCHEN", ipAddress: "", port: "9100", paperWidth: "80",
    printMode: "SERVER", isActive: true, areaIds: [] as string[]
  });

  function openNew() { setEditing(null); setForm({ name: "", type: "KITCHEN", ipAddress: "", port: "9100", paperWidth: "80", printMode: "SERVER", isActive: true, areaIds: [] }); setOpen(true); }
  function openEdit(p: P) { setEditing(p); setForm({ name: p.name, type: p.type, ipAddress: p.ipAddress, port: p.port.toString(), paperWidth: p.paperWidth.toString(), printMode: p.printMode || "SERVER", isActive: p.isActive, areaIds: p.areas?.map((a) => a.areaId) ?? [] }); setOpen(true); }

  function toggleArea(id: string) {
    setForm(f => ({ ...f, areaIds: f.areaIds.includes(id) ? f.areaIds.filter(a => a !== id) : [...f.areaIds, id] }));
  }

  function doAct(fn: ActionFn, ...args: unknown[]) {
    start(async () => {
      await runAction(
        () => (fn as LooseFn)(...args),
        { success: t.common.success, error: t.common.error },
        () => setOpen(false),
      );
    });
  }

  function save() {
    const data = { ...form, port: Number.parseInt(form.port, 10), paperWidth: Number.parseInt(form.paperWidth, 10) };
    if (editing) doAct(updatePrinter, editing.id, data);
    else doAct(createPrinter, data);
  }

  const typeLabel = t.settings.printerType as Record<string, string>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {t.inventory.addPrinterBtn}</Button>
      </div>
      {printers.length === 0 && <p className="text-center text-muted-foreground py-8">{t.inventory.noPrinter}</p>}
      {printers.map(p => (
        <Card key={p.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">{p.name}</CardTitle>
                <Badge>{typeLabel[p.type] || p.type}</Badge>
                {p.printMode === "CLIENT" ? (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Smartphone className="h-3 w-3 mr-0.5" /> {t.inventory.deviceLabel}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                    <Server className="h-3 w-3 mr-0.5" /> Server
                  </Badge>
                )}
                {!p.isActive && <Badge variant="secondary">{t.inventory.disabledBadge}</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" onClick={() => doAct(deletePrinter, p.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {p.printMode === "CLIENT" ? (
                <div className="flex items-center gap-1"><Smartphone className="h-3 w-3 text-blue-500" /> {t.inventory.wifiPrint} {p.paperWidth}mm</div>
              ) : (
                <div className="flex items-center gap-1"><Wifi className="h-3 w-3" /> {p.ipAddress}:{p.port} {t.inventory.viaPort} {p.paperWidth}mm</div>
              )}
              {p.areas?.length > 0 && <div className="mt-1">{t.inventory.areaLabel} {p.areas.map((a) => a.area?.name).join(", ")}</div>}
              {p.printTemplates?.length > 0 && <div className="mt-1">{p.printTemplates.length} {t.inventory.templateCount}</div>}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!sm:max-w-lg !max-w-[95vw]">
          <DialogHeader><DialogTitle>{editing ? t.settings.editPrinter : t.settings.addPrinter}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t.inventory.printerName}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t.inventory.printerType}</Label>
                <Select value={form.type} onValueChange={v => v && setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue>{typeLabel[form.type] || form.type}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KITCHEN">{t.settings.printerType.KITCHEN}</SelectItem>
                    <SelectItem value="BAR">Bar</SelectItem>
                    <SelectItem value="BILL">Bill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>{t.inventory.paperWidthLabel}</Label>
                <Select value={form.paperWidth} onValueChange={v => v && setForm(f => ({ ...f, paperWidth: v }))}>
                  <SelectTrigger><SelectValue>{form.paperWidth}mm</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="48">48mm</SelectItem>
                    <SelectItem value="58">58mm</SelectItem>
                    <SelectItem value="80">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.printMode === "SERVER" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>{t.inventory.ipAddressLabel}</Label><Input value={form.ipAddress} onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))} placeholder="192.168.1.100" /></div>
                <div className="space-y-1"><Label>{t.inventory.portLabel}</Label><Input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} /></div>
              </div>
            )}

            {/* Print Mode */}
            <div className="space-y-2 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <Label className="text-xs uppercase tracking-wider text-gray-500">{t.inventory.printModeLabel}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, printMode: "SERVER" }))}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all text-left ${
                    form.printMode === "SERVER" ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <Server className={`h-5 w-5 ${form.printMode === "SERVER" ? "text-amber-600" : "text-gray-400"}`} />
                  <div>
                    <div className="text-sm font-medium">Server</div>
                    <div className="text-[10px] text-gray-400">{t.inventory.serverModeDesc}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, printMode: "CLIENT" }))}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all text-left ${
                    form.printMode === "CLIENT" ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <Smartphone className={`h-5 w-5 ${form.printMode === "CLIENT" ? "text-blue-600" : "text-gray-400"}`} />
                  <div>
                    <div className="text-sm font-medium">{t.inventory.deviceLabel}</div>
                    <div className="text-[10px] text-gray-400">{t.inventory.clientModeDesc}</div>
                  </div>
                </button>
              </div>
              {form.printMode === "CLIENT" && (
                <p className="text-[11px] text-blue-700 bg-blue-50 rounded-lg p-2 mt-2">
                  {t.inventory.clientHint}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t.inventory.printAreasLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {areas.map(a => (
                  <label key={a.id} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={form.areaIds.includes(a.id)} onCheckedChange={() => toggleArea(a.id)} />
                    <span className="text-sm">{a.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button disabled={pending} onClick={save}>{pending ? t.common.saving : t.common.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
