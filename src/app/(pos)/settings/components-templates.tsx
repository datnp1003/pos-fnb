"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/context";
import type { Locale } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { runAction } from "@/lib/run-action";

type Tpl = {
  id: string; name: string; type: string; width: number; config: string; isDefault: boolean;
  printer?: { id: string; name: string };
};
type Printer = { id: string; name: string };
type ActionFn = (...args: never[]) => Promise<unknown>;
type LooseFn = (...args: unknown[]) => Promise<unknown>;

const DATE_LOCALES: Record<string, string> = { pt: "pt-BR", en: "en-US" };
function dateLocale(locale: Locale) { return DATE_LOCALES[locale] ?? "vi-VN"; }

function typeBadgeClass(type: string) {
  if (type === "ORDER") return "bg-blue-100 text-blue-700";
  if (type === "TEMP_BILL") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

// ===== ORDER TEMPLATE CONFIG =====
interface OrderConfig {
  showSequence: boolean;
  showTable: boolean;
  showTime: boolean;
  showQuantity: boolean;
  showTopping: boolean;
  showNote: boolean;
}

const defaultOrderConfig: OrderConfig = {
  showSequence: true, showTable: true, showTime: true,
  showQuantity: true, showTopping: true, showNote: true,
};

// ===== BILL TEMPLATE CONFIG =====
interface BillConfig {
  header: { showLogo: boolean; showAddress: boolean; showPhone: boolean; showTaxCode: boolean; showDateTime: boolean };
  body: { showTable: boolean; showGuestCount: boolean; showQuantity: boolean; showUnitPrice: boolean; showAmount: boolean; showTopping: boolean; showNote: boolean; showOrderNumber: boolean };
  footer: { showSubtotal: boolean; showVat: boolean; showDiscount: boolean; showServiceCharge: boolean; showTotal: boolean; showPaymentMethod: boolean; showCashier: boolean; thankYou: string };
}

const defaultBillConfig: BillConfig = {
  header: { showLogo: true, showAddress: true, showPhone: true, showTaxCode: false, showDateTime: true },
  body: { showTable: true, showGuestCount: true, showQuantity: true, showUnitPrice: true, showAmount: true, showTopping: true, showNote: false, showOrderNumber: true },
  footer: { showSubtotal: true, showVat: true, showDiscount: true, showServiceCharge: true, showTotal: true, showPaymentMethod: true, showCashier: true, thankYou: "" },
};

type TemplateData = { _version: 2; type: string; order?: OrderConfig; bill?: BillConfig };

function packConfig(type: string, order: OrderConfig, bill: BillConfig): string {
  return JSON.stringify({ _version: 2, type, order, bill } as TemplateData);
}

function unpackConfig(raw: string): { order: OrderConfig; bill: BillConfig } {
  try {
    const parsed = JSON.parse(raw) as Partial<TemplateData>;
    if (parsed._version === 2) {
      return {
        order: { ...defaultOrderConfig, ...parsed.order },
        bill: { ...defaultBillConfig, ...parsed.bill, header: { ...defaultBillConfig.header, ...parsed.bill?.header }, body: { ...defaultBillConfig.body, ...parsed.bill?.body }, footer: { ...defaultBillConfig.footer, ...parsed.bill?.footer } },
      };
    }
  } catch {}
  return { order: { ...defaultOrderConfig }, bill: { ...defaultBillConfig } };
}

export function PrintTemplatesManager({
  templates, printers, createTemplate, updateTemplate, deleteTemplate
}: Readonly<{ templates: Tpl[]; printers: Printer[]; createTemplate: ActionFn; updateTemplate: ActionFn; deleteTemplate: ActionFn }>) {
  const { t, locale } = useI18n();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Tpl | null>(null);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [form, setForm] = useState({ name: "", type: "ORDER", printerId: printers[0]?.id ?? "", width: 80 });
  const [orderCfg, setOrderCfg] = useState<OrderConfig>({ ...defaultOrderConfig });
  const [billCfg, setBillCfg] = useState<BillConfig>(structuredClone(defaultBillConfig));

  function openNew() {
    setEditing(null);
    setForm({ name: "", type: "ORDER", printerId: printers[0]?.id ?? "", width: 80 });
    setOrderCfg({ ...defaultOrderConfig });
    setBillCfg(structuredClone(defaultBillConfig));
    setOpen(true);
  }

  function openEdit(tpl: Tpl) {
    setEditing(tpl);
    setForm({ name: tpl.name, type: tpl.type, printerId: tpl.printer?.id ?? "", width: tpl.width });
    const { order, bill } = unpackConfig(tpl.config);
    setOrderCfg(order);
    setBillCfg(bill);
    setOpen(true);
  }

  function handleDelete(id: string) {
    start(() => runAction(() => (deleteTemplate as LooseFn)(id), { success: t.common.success, error: t.common.error }));
  }

  function doSave() {
    const configStr = packConfig(form.type, orderCfg, billCfg);
    start(async () => {
      try {
        if (editing) await (updateTemplate as LooseFn)(editing.id, { ...form, config: configStr });
        else await (createTemplate as LooseFn)({ ...form, config: configStr });
        toast.success(editing ? t.printTemplate.updated : t.printTemplate.created);
        setOpen(false);
      } catch { toast.error(t.common.error); }
    });
  }

  const isOrder = form.type === "ORDER";
  const baseLabel = editing ? t.printTemplate.update : t.printTemplate.saveAndCreate;
  const saveLabel = pending ? t.common.saving : baseLabel;

  return (
    <div className="space-y-4">
      {templates.length > 0 && <div className="flex justify-end"><Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {t.printTemplate.newTemplate}</Button></div>}

      {templates.length === 0 ? (
        <div className="section-amber text-center py-16 space-y-4">
          <FileText className="h-12 w-12 mx-auto text-amber-300" />
          <div><h3 className="text-lg font-bold text-gray-900">{t.printTemplate.noTemplate}</h3><p className="text-sm text-gray-500 mt-1">{t.printTemplate.noTemplateDesc}</p></div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {t.printTemplate.saveAndCreate}</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map(tpl => (
            <div key={tpl.id} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-amber-300 hover:shadow-sm transition-all group">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">{tpl.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeBadgeClass(tpl.type)}`}>{t.printTemplate.templateTypes[tpl.type as keyof typeof t.printTemplate.templateTypes] || tpl.type}</span>
                  {tpl.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-medium">{t.settings.default}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{tpl.printer?.name ?? t.printTemplate.noPrinters} · {t.printTemplate.paperSizeHint.replace("{width}", String(tpl.width))}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPreviewTemplate(tpl)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title={t.printTemplate.preview}><Eye className="h-4 w-4" /></button>
                <button onClick={() => openEdit(tpl)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600" title={t.settings.edit}><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(tpl.id)} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title={t.settings.delete}><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ EDITOR ============ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!sm:max-w-6xl !max-w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle className="text-xl">{editing ? t.printTemplate.editTemplate : t.printTemplate.newTemplate}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden grid grid-cols-2 gap-0 border-t border-gray-100">
            {/* LEFT: Config */}
            <ScrollArea className="h-full border-r border-gray-100">
              <div className="p-6 space-y-5">
                {/* Basic info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <span className="w-1 h-4 rounded bg-amber-400" /> {t.settings.general}
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-1"><Label className="text-xs">{t.printTemplate.templateName}</Label><Input className="h-10" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t.printTemplate.typeLabel}</Label>
                      <Select value={form.type} onValueChange={v => v && setForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger className="h-10"><SelectValue>{t.printTemplate.templateTypes[form.type as keyof typeof t.printTemplate.templateTypes]}</SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ORDER">{t.printTemplate.templateTypes.ORDER}</SelectItem>
                          <SelectItem value="TEMP_BILL">{t.printTemplate.templateTypes.TEMP_BILL}</SelectItem>
                          <SelectItem value="BILL">{t.printTemplate.templateTypes.BILL}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t.printTemplate.paperSize}</Label>
                        <Select value={String(form.width)} onValueChange={v => v && setForm(f => ({ ...f, width: Number.parseInt(v, 10) }))}>
                          <SelectTrigger className="h-10"><SelectValue>{form.width}mm</SelectValue></SelectTrigger>
                          <SelectContent>{[48, 58, 80].map(w => <SelectItem key={w} value={String(w)}>{w}mm</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t.printTemplate.printer}</Label>
                        <Select value={form.printerId} onValueChange={v => v && setForm(f => ({ ...f, printerId: v }))}>
                          <SelectTrigger className="h-10"><SelectValue>{printers.find(p => p.id === form.printerId)?.name ?? t.printTemplate.selectPrinter}</SelectValue></SelectTrigger>
                          <SelectContent>{printers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {isOrder ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <span className="w-1 h-4 rounded bg-blue-400" /> {t.printTemplate.orderContent}
                    </h4>
                    <p className="text-xs text-gray-400">{t.printTemplate.orderOnlyHint}</p>
                    <div className="space-y-2">
                      {[
                        { key: "showSequence" as const, pKey: "showSequence" as const, pDesc: "showSeqDesc" as const },
                        { key: "showTable" as const, pKey: "showTable" as const, pDesc: "showTableDesc" as const },
                        { key: "showTime" as const, pKey: "showTime" as const, pDesc: "showTimeDesc" as const },
                        { key: "showQuantity" as const, pKey: "showQuantity" as const, pDesc: "showQtyDesc" as const },
                        { key: "showTopping" as const, pKey: "showTopping" as const, pDesc: "showToppingDesc" as const },
                        { key: "showNote" as const, pKey: "showNote" as const, pDesc: "showNoteDesc" as const },
                      ].map(item => (
                        <label key={item.key} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                          <div><span className="text-sm text-gray-700">{t.printTemplate[item.pKey]}</span><p className="text-[10px] text-gray-400">{t.printTemplate[item.pDesc]}</p></div>
                          <Switch checked={orderCfg[item.key]} onCheckedChange={v => setOrderCfg(c => ({ ...c, [item.key]: v }))} className="scale-90" />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <span className="w-1 h-4 rounded bg-emerald-400" /> {t.printTemplate.headerSection}
                      </h4>
                      <div className="space-y-2">
                        {[
                          { key: "showLogo" as const, label: t.printTemplate.showLogo },
                          { key: "showAddress" as const, label: t.printTemplate.showAddress },
                          { key: "showPhone" as const, label: t.printTemplate.showPhone },
                          { key: "showTaxCode" as const, label: t.printTemplate.showTaxCode },
                          { key: "showDateTime" as const, label: t.printTemplate.showDateTime },
                        ].map(item => (
                          <label key={item.key} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                            <span className="text-sm text-gray-700">{item.label}</span>
                            <Switch checked={billCfg.header[item.key]} onCheckedChange={v => setBillCfg(c => ({ ...c, header: { ...c.header, [item.key]: v } }))} className="scale-90" />
                          </label>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <span className="w-1 h-4 rounded bg-emerald-400" /> {t.printTemplate.bodySection}
                      </h4>
                      <div className="space-y-2">
                        {[
                          { key: "showOrderNumber" as const, label: t.printTemplate.showOrderNumber },
                          { key: "showTable" as const, label: t.printTemplate.showTable },
                          { key: "showGuestCount" as const, label: t.printTemplate.showGuestCount },
                          { key: "showQuantity" as const, label: t.printTemplate.showQuantity },
                          { key: "showUnitPrice" as const, label: t.printTemplate.showUnitPrice },
                          { key: "showAmount" as const, label: t.printTemplate.showAmount },
                          { key: "showTopping" as const, label: t.printTemplate.showTopping },
                          { key: "showNote" as const, label: t.printTemplate.showNote },
                        ].map(item => (
                          <label key={item.key} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                            <span className="text-sm text-gray-700">{item.label}</span>
                            <Switch checked={billCfg.body[item.key]} onCheckedChange={v => setBillCfg(c => ({ ...c, body: { ...c.body, [item.key]: v } }))} className="scale-90" />
                          </label>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <span className="w-1 h-4 rounded bg-emerald-400" /> {t.printTemplate.footerSection}
                      </h4>
                      <div className="space-y-2">
                        <label className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                          <span className="text-sm text-gray-700">{t.printTemplate.showSubtotal}</span>
                          <Switch checked={billCfg.footer.showSubtotal} onCheckedChange={v => setBillCfg(c => ({ ...c, footer: { ...c.footer, showSubtotal: v } }))} className="scale-90" />
                        </label>
                        {[
                          { key: "showVat" as const, label: t.printTemplate.showVat },
                          { key: "showDiscount" as const, label: t.printTemplate.showDiscount },
                          { key: "showServiceCharge" as const, label: t.printTemplate.showServiceCharge },
                          { key: "showTotal" as const, label: t.printTemplate.showTotal },
                          { key: "showPaymentMethod" as const, label: t.printTemplate.showPaymentMethod },
                          { key: "showCashier" as const, label: t.printTemplate.showCashier },
                        ].map(item => (
                          <label key={item.key} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                            <span className="text-sm text-gray-700">{item.label}</span>
                            <Switch checked={billCfg.footer[item.key]} onCheckedChange={v => setBillCfg(c => ({ ...c, footer: { ...c.footer, [item.key]: v } }))} className="scale-90" />
                          </label>
                        ))}
                        <div className="space-y-1 pt-2">
                          <Label className="text-xs">{t.printTemplate.thankYou}</Label>
                          <Textarea className="h-16 text-sm" value={billCfg.footer.thankYou} onChange={e => setBillCfg(c => ({ ...c, footer: { ...c.footer, thankYou: e.target.value } }))} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* RIGHT: Preview */}
            <div className="h-full flex flex-col bg-gray-100">
              <div className="shrink-0 px-4 py-2.5 bg-white border-b border-gray-100 flex items-center gap-2">
                <Eye className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t.printTemplate.preview}</span>
                <span className="text-[10px] text-gray-400 ml-auto">{form.width}mm · {t.printTemplate.templateTypes[form.type as keyof typeof t.printTemplate.templateTypes]}</span>
              </div>
              <ScrollArea className="flex-1 flex justify-center p-4">
                {isOrder ? (
                  <OrderPreview config={orderCfg} width={form.width} name={form.name} t={t} />
                ) : (
                  <BillPreview config={billCfg} width={form.width} name={form.name} t={t} locale={locale} />
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <Button variant="outline" onClick={() => setOpen(false)}>{t.order.cancel}</Button>
            <Button disabled={pending || !form.name.trim()} onClick={doSave} className="bg-amber-500 hover:bg-amber-600">
              {saveLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ PREVIEW DIALOG ============ */}
      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" /> {previewTemplate.name}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeBadgeClass(previewTemplate.type)}`}>{t.printTemplate.templateTypes[previewTemplate.type as keyof typeof t.printTemplate.templateTypes]}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="bg-gray-100 rounded-xl p-6 flex justify-center">
              {previewTemplate.type === "ORDER" ? (
                <OrderPreview config={unpackConfig(previewTemplate.config).order} width={previewTemplate.width} name={previewTemplate.name} t={t} />
              ) : (
                <BillPreview config={unpackConfig(previewTemplate.config).bill} width={previewTemplate.width} name={previewTemplate.name} t={t} locale={locale} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ======================== ORDER PREVIEW ========================

function getMaxWidth(width: number): number {
  if (width === 48) return 180;
  if (width === 58) return 220;
  return 300;
}

function OrderPreview({ config, width, t }: Readonly<{ config: OrderConfig; width: number; name: string; t: Dictionary }>) {
  const maxW = getMaxWidth(width);

  return (
    <div style={{ width: maxW }} className="bg-white shadow-md rounded-none p-3 font-mono text-[12px] leading-relaxed text-black">
      {config.showSequence && <div className="text-center font-bold text-[28px] leading-tight mb-1">#3</div>}
      {config.showTable && <div className="font-bold">{t.settings.tables}: B01</div>}
      {config.showTime && <div className="text-[10px] text-gray-500 mb-1">14:25</div>}
      <div className="border-t border-dashed border-gray-300 my-1" />

      {t.printTemplate.sampleItems.map((item) => (
        <div key={item.name} className="py-0.5">
          <div>{config.showQuantity ? `${item.qty}x ` : ""}{item.name}</div>
          {config.showTopping && item.toppings && <div className="text-[10px] text-gray-400 ml-2">+ {item.toppings}</div>}
        </div>
      ))}

      {config.showNote && (
        <>
          <div className="border-t border-dashed border-gray-300 my-1" />
          <div className="text-[10px] text-gray-500">* {t.printTemplate.thankYouNote}</div>
        </>
      )}
      <div className="border-t border-dashed border-gray-300 my-1" />
    </div>
  );
}

// ======================== BILL PREVIEW ========================

function BillPreview({ config, width, name, t, locale }: Readonly<{ config: BillConfig; width: number; name: string; t: Dictionary; locale: Locale }>) {
  const maxW = getMaxWidth(width);
  const sampleItems = t.printTemplate.sampleItemsWithPrice;
  const subtotal = sampleItems.reduce((s, i) => s + i.price * i.qty, 0);
  const vat = Math.round(subtotal * 0.08);
  const discount = 25000;
  const service = Math.round(subtotal * 0.05);
  const total = subtotal + vat - discount + service;
  const f = (n: number) => new Intl.NumberFormat().format(n) + (t.common.d || "");

  return (
    <div style={{ width: maxW }} className="bg-white shadow-md rounded-none p-3 font-mono text-[10px] leading-relaxed text-black">
      {config.header.showLogo && <div className="text-center mb-1 text-sm">🍽️</div>}
      <div className="text-center font-bold text-[12px] mb-0.5">{name || t.settings.restaurantName.toUpperCase()}</div>
      {config.header.showAddress && <div className="text-center text-[8px] text-gray-600">123 Nguyễn Huệ, Q.1, TP.HCM</div>}
      {config.header.showPhone && <div className="text-center text-[8px] text-gray-600">📞 0909 123 456</div>}
      {config.header.showTaxCode && <div className="text-center text-[8px] text-gray-600">{t.settings.taxCode}: 0312345678</div>}
      {config.header.showDateTime && <div className="text-center text-[8px] text-gray-600 mb-1">{new Date().toLocaleDateString(dateLocale(locale))} {new Date().toLocaleTimeString(dateLocale(locale))}</div>}
      <div className="border-t border-dashed border-gray-300 my-1" />

      {config.body.showOrderNumber && <div className="text-[9px] text-gray-500">{t.order.orderNumber}: #0042</div>}
      {config.body.showTable && <div className="text-[9px] text-gray-500">{t.settings.tables}: B01</div>}
      {config.body.showGuestCount && <div className="text-[9px] text-gray-500 mb-0.5">{t.order.guestCount}: 4</div>}
      <div className="border-t border-dashed border-gray-300 my-1" />

      <table className="w-full text-[9px]">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 text-[8px]">
            <td className="text-left py-0.5">{t.settings.products}</td>
            {config.body.showQuantity && <td className="text-center py-0.5 w-6">{t.order.addItem}</td>}
            {config.body.showUnitPrice && <td className="text-right py-0.5 w-14">{t.inventory.unitPrice}</td>}
            {config.body.showAmount && <td className="text-right py-0.5 w-14">{t.inventory.totalPrice}</td>}
          </tr>
        </thead>
        <tbody>
          {sampleItems.map((item) => (
            <tr key={item.name} className="border-b border-gray-100">
              <td className="py-0.5">
                <div className="font-medium">{item.name}</div>
                {config.body.showTopping && item.toppings && <div className="text-[7px] text-gray-400">+ {item.toppings}</div>}
              </td>
              {config.body.showQuantity && <td className="text-center py-0.5">{item.qty}</td>}
              {config.body.showUnitPrice && <td className="text-right py-0.5">{f(item.price)}</td>}
              {config.body.showAmount && <td className="text-right py-0.5">{f(item.price * item.qty)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {config.body.showNote && <div className="text-[8px] text-gray-400 italic mt-1">{t.order.note}: {t.printTemplate.thankYouNote}</div>}

      <div className="border-t border-dashed border-gray-300 my-1" />
      {config.footer.showSubtotal && <div className="flex justify-between"><span>{t.order.subtotal}:</span><span>{f(subtotal)}</span></div>}
      {config.footer.showVat && <div className="flex justify-between"><span>{t.order.vat}:</span><span>{f(vat)}</span></div>}
      {config.footer.showDiscount && <div className="flex justify-between"><span>{t.order.discount}:</span><span>-{f(discount)}</span></div>}
      {config.footer.showServiceCharge && <div className="flex justify-between"><span>{t.settings.serviceCharges}:</span><span>{f(service)}</span></div>}
      {config.footer.showTotal && (
        <>
          <div className="border-t border-gray-300 my-0.5" />
          <div className="flex justify-between font-bold text-[11px]"><span>{t.order.total}:</span><span>{f(total)}</span></div>
        </>
      )}
      {config.footer.showPaymentMethod && <div className="flex justify-between mt-1"><span>{t.reports.paymentMethods}:</span><span>{t.order.cash}</span></div>}
      {config.footer.showCashier && <div className="text-[8px] text-gray-500 mt-0.5">{t.printTemplate.showCashier}: Nguyễn Văn A</div>}
      {config.footer.thankYou && (
        <>
          <div className="border-t border-dashed border-gray-300 my-1" />
          <div className="text-center">{config.footer.thankYou}</div>
        </>
      )}
    </div>
  );
}
