"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useI18n } from "@/i18n/context";

type Config = { restaurantName: string; address?: string | null; phone?: string | null; email?: string | null; taxCode?: string | null; taxMode?: string | null; qrBankCode?: string | null; qrAccountNumber?: string | null; qrAccountName?: string | null };

const vietnameseBanks = [
  { code: "ICB", name: "VietinBank", logo: "https://img.vietqr.io/image/ICB.png" },
  { code: "VCB", name: "Vietcombank", logo: "https://img.vietqr.io/image/VCB.png" },
  { code: "BIDV", name: "BIDV", logo: "https://img.vietqr.io/image/BIDV.png" },
  { code: "VBA", name: "Agribank", logo: "https://img.vietqr.io/image/VBA.png" },
  { code: "OCB", name: "OCB", logo: "https://img.vietqr.io/image/OCB.png" },
  { code: "MB", name: "MBBank", logo: "https://img.vietqr.io/image/MB.png" },
  { code: "TCB", name: "Techcombank", logo: "https://img.vietqr.io/image/TCB.png" },
  { code: "ACB", name: "ACB", logo: "https://img.vietqr.io/image/ACB.png" },
  { code: "VPB", name: "VPBank", logo: "https://img.vietqr.io/image/VPB.png" },
  { code: "TPB", name: "TPBank", logo: "https://img.vietqr.io/image/TPB.png" },
  { code: "STB", name: "Sacombank", logo: "https://img.vietqr.io/image/STB.png" },
  { code: "HDB", name: "HDBank", logo: "https://img.vietqr.io/image/HDB.png" },
  { code: "VCCB", name: "VietCapitalBank", logo: "https://img.vietqr.io/image/VCCB.png" },
  { code: "SCB", name: "SCB", logo: "https://img.vietqr.io/image/SCB.png" },
  { code: "VIB", name: "VIB", logo: "https://img.vietqr.io/image/VIB.png" },
  { code: "SHB", name: "SHB", logo: "https://img.vietqr.io/image/SHB.png" },
  { code: "EIB", name: "Eximbank", logo: "https://img.vietqr.io/image/EIB.png" },
  { code: "MSB", name: "MSB", logo: "https://img.vietqr.io/image/MSB.png" },
  { code: "CAKE", name: "CAKE", logo: "https://img.vietqr.io/image/CAKE.png" },
  { code: "Ubank", name: "Ubank", logo: "https://img.vietqr.io/image/Ubank.png" },
  { code: "VTLMONEY", name: "ViettelMoney", logo: "https://img.vietqr.io/image/VTLMONEY.png" },
  { code: "TIMO", name: "Timo", logo: "https://img.vietqr.io/image/TIMO.png" },
  { code: "VNPTMONEY", name: "VNPTMoney", logo: "https://img.vietqr.io/image/VNPTMONEY.png" },
  { code: "SGICB", name: "SaigonBank", logo: "https://img.vietqr.io/image/SGICB.png" },
  { code: "BAB", name: "BacABank", logo: "https://img.vietqr.io/image/BAB.png" },
  { code: "momo", name: "MoMo", logo: "https://img.vietqr.io/image/momo.png" },
  { code: "PVDB", name: "PVcomBank Pay", logo: "https://img.vietqr.io/image/PVDB.png" },
  { code: "PVCB", name: "PVcomBank", logo: "https://img.vietqr.io/image/PVCB.png" },
  { code: "MBV", name: "MBV", logo: "https://img.vietqr.io/image/MBV.png" },
  { code: "NCB", name: "NCB", logo: "https://img.vietqr.io/image/NCB.png" },
  { code: "SHBVN", name: "ShinhanBank", logo: "https://img.vietqr.io/image/SHBVN.png" },
  { code: "ABB", name: "ABBANK", logo: "https://img.vietqr.io/image/ABB.png" },
  { code: "VAB", name: "VietABank", logo: "https://img.vietqr.io/image/VAB.png" },
  { code: "NAB", name: "NamABank", logo: "https://img.vietqr.io/image/NAB.png" },
  { code: "PGB", name: "PGBank", logo: "https://img.vietqr.io/image/PGB.png" },
  { code: "VIETBANK", name: "VietBank", logo: "https://img.vietqr.io/image/VIETBANK.png" },
  { code: "BVB", name: "BaoVietBank", logo: "https://img.vietqr.io/image/BVB.png" },
  { code: "SEAB", name: "SeABank", logo: "https://img.vietqr.io/image/SEAB.png" },
  { code: "COOPBANK", name: "COOPBANK", logo: "https://img.vietqr.io/image/COOPBANK.png" },
  { code: "LPB", name: "LPBank", logo: "https://img.vietqr.io/image/LPB.png" },
  { code: "KLB", name: "KienLongBank", logo: "https://img.vietqr.io/image/KLB.png" },
  { code: "KBank", name: "KBank", logo: "https://img.vietqr.io/image/KBank.png" },
  { code: "MAFC", name: "MAFC", logo: "https://img.vietqr.io/image/MAFC.png" },
  { code: "HLBVN", name: "Hong Leong", logo: "https://img.vietqr.io/image/HLBVN.png" },
  { code: "KEBHANAHN", name: "KEB Hana Hà Nội", logo: "https://img.vietqr.io/image/KEBHANAHN.png" },
  { code: "KEBHANAHCM", name: "KEB Hana Hồ Chí Minh", logo: "https://img.vietqr.io/image/KEBHANAHCM.png" },
  { code: "CITIBANK", name: "Citibank", logo: "https://img.vietqr.io/image/CITIBANK.png" },
  { code: "CBBank", name: "CBBank", logo: "https://img.vietqr.io/image/CBBank.png" },
  { code: "CIMB", name: "CIMB", logo: "https://img.vietqr.io/image/CIMB.png" },
  { code: "DBS", name: "DBSBank", logo: "https://img.vietqr.io/image/DBS.png" },
  { code: "Vikki", name: "Vikki", logo: "https://img.vietqr.io/image/Vikki.png" },
  { code: "VBSP", name: "VBSP", logo: "https://img.vietqr.io/image/VBSP.png" },
  { code: "GPB", name: "GPBank", logo: "https://img.vietqr.io/image/GPB.png" },
  { code: "KookminHCM", name: "Kookmin Hồ Chí Minh", logo: "https://img.vietqr.io/image/KookminHCM.png" },
  { code: "KookminHN", name: "Kookmin Hà Nội", logo: "https://img.vietqr.io/image/KookminHN.png" },
  { code: "WOO", name: "Woori", logo: "https://img.vietqr.io/image/WOO.png" },
  { code: "VRB", name: "VRB", logo: "https://img.vietqr.io/image/VRB.png" },
  { code: "HSBC", name: "HSBC", logo: "https://img.vietqr.io/image/HSBC.png" },
  { code: "IBKHN", name: "IBK Hà Nội", logo: "https://img.vietqr.io/image/IBKHN.png" },
  { code: "IBKHCM", name: "IBK Hồ Chí Minh", logo: "https://img.vietqr.io/image/IBKHCM.png" },
  { code: "IVB", name: "IndovinaBank", logo: "https://img.vietqr.io/image/IVB.png" },
  { code: "UnitedOverseas", name: "United Overseas", logo: "https://img.vietqr.io/image/UnitedOverseas.png" },
  { code: "Nonghyup", name: "Nonghyup", logo: "https://img.vietqr.io/image/Nonghyup.png" },
  { code: "StandardChartered", name: "Standard Chartered", logo: "https://img.vietqr.io/image/StandardChartered.png" },
  { code: "PublicBank", name: "Public Bank", logo: "https://img.vietqr.io/image/PublicBank.png" },
];
type ActionResult = void;

export function GeneralConfigForm({ config, action }: { config: Config | null; action: (data: any) => ActionResult }) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    restaurantName: config?.restaurantName ?? "",
    address: config?.address ?? "",
    phone: config?.phone ?? "",
    email: config?.email ?? "",
    taxCode: config?.taxCode ?? "",
    taxMode: config?.taxMode ?? "EXCLUSIVE",
    qrBankCode: config?.qrBankCode ?? "ICB",
    qrAccountNumber: config?.qrAccountNumber ?? "11415686",
    qrAccountName: config?.qrAccountName ?? "HO KINH DOANH SAI GON AN COFFEE",
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
          <div className="border-t pt-5">
            <h3 className="font-semibold">Thanh toán QR động</h3>
            <p className="mt-1 text-sm text-muted-foreground">Thông tin này được dùng để tạo mã VietQR theo đúng số tiền của hóa đơn.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="qrBankCode">Ngân hàng</Label>
                <Select value={form.qrBankCode} onValueChange={v => setForm(f => ({ ...f, qrBankCode: v || "ICB" }))}>
                  <SelectTrigger id="qrBankCode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {vietnameseBanks.map(bank => <SelectItem key={bank.code} value={bank.code}><span className="inline-flex items-center gap-2"><img src={bank.logo} alt="" className="size-5 rounded object-contain" />{bank.name}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qrAccountNumber">Số tài khoản</Label>
                <Input id="qrAccountNumber" inputMode="numeric" value={form.qrAccountNumber} onChange={e => setForm(f => ({ ...f, qrAccountNumber: e.target.value.replace(/[^0-9]/g, "") }))} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="qrAccountName">Tên tài khoản</Label>
                <Input id="qrAccountName" value={form.qrAccountName} onChange={e => setForm(f => ({ ...f, qrAccountName: e.target.value.toUpperCase() }))} required />
              </div>
            </div>
          </div>
          <Button type="submit" disabled={saving}>{saving ? t.common.saving : t.common.save}</Button>
        </CardContent>
      </Card>
    </form>
  );
}
