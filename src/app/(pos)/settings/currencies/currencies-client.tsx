"use client";

import { useState, useTransition } from "react";
import { DismissibleBackdrop } from "@/components/shared/dismissible-backdrop";
import { useI18n } from "@/i18n/context";
import { createCurrency, updateCurrency, deleteCurrency } from "@/server/settings/actions";
import { Plus, Trash2, Star, X } from "lucide-react";
import { toast } from "sonner";

type Currency = { id: string; code: string; name: string; symbol: string; rate: number; isDefault: boolean; sortOrder: number };

export function CurrenciesManager({ currencies }: { readonly currencies: Currency[] }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", symbol: "", rate: "1", isDefault: false });

  function openNew() { setEditId(null); setForm({ code: "", name: "", symbol: "", rate: "1", isDefault: false }); setOpen(true); }
  function openEdit(c: Currency) { setEditId(c.id); setForm({ code: c.code, name: c.name, symbol: c.symbol, rate: String(c.rate), isDefault: c.isDefault }); setOpen(true); }

  function save() {
    start(async () => {
      try {
        const data = { code: form.code, name: form.name, symbol: form.symbol, rate: Number.parseFloat(form.rate), isDefault: form.isDefault };
        if (editId) await updateCurrency(editId, data);
        else await createCurrency(data);
        toast.success(t.common.success);
        setOpen(false);
      } catch {
        toast.error(t.common.error);
      }
    });
  }

  function del(id: string) {
    if (!confirm(t.common.confirmDelete)) return;
    start(async () => {
      try {
        await deleteCurrency(id);
        toast.success(t.common.success);
      } catch {
        toast.error(t.common.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <button onClick={openNew} className="btn-pos-secondary text-sm gap-1"><Plus className="h-4 w-4" /> {t.common.add} {t.settings.sidebar.currencies}</button>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left p-3 font-semibold">{t.common.symbol}</th>
            <th className="text-left p-3">{t.inventory.code}</th>
            <th className="text-left p-3">{t.settings.name}</th>
            <th className="text-right p-3">{t.settings.exchangeRate}</th>
            <th className="text-center p-3">{t.settings.primary}</th>
            <th className="text-right p-3"></th>
          </tr></thead>
          <tbody>
            {currencies.map(c => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(c)}>
                <td className="p-3 font-bold text-lg">{c.symbol}</td>
                <td className="p-3 font-mono text-xs">{c.code}</td>
                <td className="p-3">{c.name}</td>
                <td className="p-3 text-right font-mono">{c.rate}</td>
                <td className="p-3 text-center">{c.isDefault && <Star className="h-4 w-4 text-amber-500 mx-auto" />}</td>
                <td className="p-3 text-right">
                  <button onClick={e => { e.stopPropagation(); del(c.id); }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {currencies.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">{t.settings.noData}</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <DismissibleBackdrop
          className="z-50 flex items-center justify-center bg-black/40"
          onDismiss={() => setOpen(false)}
        >
          <dialog open className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4 m-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{editId ? t.common.edit + " " + t.settings.sidebar.currencies : t.common.add + " " + t.settings.sidebar.currencies}</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-sm font-medium text-gray-700 block mb-1">{t.inventory.code}</label><input className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="VND" /></div>
              <div><label className="text-sm font-medium text-gray-700 block mb-1">{t.settings.name || "Name"}</label><input className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="US Dollar" /></div>
              <div><label className="text-sm font-medium text-gray-700 block mb-1">{t.common.symbol}</label><input className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="$" /></div>
              <div><label className="text-sm font-medium text-gray-700 block mb-1">{t.settings.exchangeRate}</label><input type="number" step="0.000001" className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} /></div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} className="h-4 w-4 accent-amber-500" />
                {t.settings.primary}
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setOpen(false)} className="flex-1 h-11 rounded-lg border border-gray-200 font-medium text-sm text-gray-600">{t.order.cancel}</button>
              <button onClick={save} disabled={pending || !form.code || !form.name} className="flex-1 h-11 rounded-lg bg-amber-500 text-white font-semibold text-sm disabled:opacity-40">{t.common.save}</button>
            </div>
          </dialog>
        </DismissibleBackdrop>
      )}
    </div>
  );
}
