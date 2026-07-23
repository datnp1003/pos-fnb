"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useI18n } from "@/i18n/context";

type Config = { restaurantName: string; address?: string | null; phone?: string | null; email?: string | null; taxCode?: string | null; taxMode?: string | null };
type ConfigInput = { restaurantName: string; address: string; phone: string; email: string; taxCode: string; taxMode: string };

export function GeneralConfigForm({ config, action }: { readonly config: Config | null; readonly action: (data: ConfigInput) => Promise<void> }) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    restaurantName: config?.restaurantName ?? "",
    address: config?.address ?? "",
    phone: config?.phone ?? "",
    email: config?.email ?? "",
    taxCode: config?.taxCode ?? "",
    taxMode: config?.taxMode ?? "EXCLUSIVE",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await action(form);
    toast.success(t.common.success);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="restaurantName">{t.settings.restaurantName} *</Label>
            <Input id="restaurantName" value={form.restaurantName} onChange={e => setForm(f => ({ ...f, restaurantName: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">{t.settings.address}</Label>
            <Input id="address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">{t.settings.phone}</Label>
              <Input id="phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t.settings.email}</Label>
              <Input id="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="taxCode">{t.settings.taxCode}</Label>
            <Input id="taxCode" value={form.taxCode} onChange={e => setForm(f => ({ ...f, taxCode: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t.settings.taxMode}</Label>
            <Select value={form.taxMode} onValueChange={v => setForm(f => ({ ...f, taxMode: v || "EXCLUSIVE" }))}>
              <SelectTrigger className="h-10 rounded-lg max-w-xs"><SelectValue>{form.taxMode === "INCLUSIVE" ? t.inventory.taxIncluded : t.inventory.taxNotIncluded}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="EXCLUSIVE">{t.inventory.taxNotIncluded} ({t.order.subtotal.toLowerCase()} + {t.order.vat}, {t.order.exciseTax})</SelectItem>
                <SelectItem value="INCLUSIVE">{t.inventory.taxIncluded} ({t.reports.revenue.toLowerCase()} {t.order.vat}, {t.order.exciseTax})</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {form.taxMode === "INCLUSIVE"
                ? t.inventory.taxIncludedDesc
                : t.inventory.taxNotIncludedDesc}
            </p>
          </div>
          <Button type="submit" disabled={saving}>{saving ? t.common.saving : t.common.save}</Button>
        </CardContent>
      </Card>
    </form>
  );
}
