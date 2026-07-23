"use client";

import { useState, useTransition, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Plus, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { DismissibleBackdrop } from "@/components/shared/dismissible-backdrop";
import { useDeviceInfo } from "@/components/shared/device-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/context";
import {
  closeCashRegister,
  createCashFlow,
  createPettyTransaction,
  getCashFlow,
  getCashFlowCategories,
  getCashRegisters,
  openCashRegister,
} from "@/server/inventory/actions";

type CashRegister = Awaited<ReturnType<typeof getCashRegisters>>[0];
type CashFlow = Awaited<ReturnType<typeof getCashFlow>>[0];
type CashCategory = Awaited<ReturnType<typeof getCashFlowCategories>>[0];
type FlowType = "INCOME" | "EXPENSE";
type PettyCategory = "ICECUBE" | "GAS" | "VEGGIE" | "REPAIR" | "TIP" | "MISC";

type FlowFormState = {
  categoryId: string;
  amount: string;
  description: string;
  type: FlowType;
};

type PettyFormState = {
  category: PettyCategory;
  amount: string;
  description: string;
  type: FlowType;
};

type SummaryCard = {
  label: string;
  value: string;
  color: string;
};

type TranslationMap = ReturnType<typeof useI18n>["t"];

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n || 0);
}

function getDateLocale(locale: string) {
  if (locale === "pt") {
    return "pt-BR";
  }

  if (locale === "en") {
    return "en-US";
  }

  return "vi-VN";
}

function formatMoney(value: number, suffix: string) {
  return `${fmt(value)}${suffix}`;
}

function closeAllDialogs(
  setOpenReg: (open: boolean) => void,
  setCloseReg: (open: boolean) => void,
  setOpenFlow: (open: boolean) => void,
  setOpenPetty: (open: boolean) => void,
) {
  setOpenReg(false);
  setCloseReg(false);
  setOpenFlow(false);
  setOpenPetty(false);
}

function getPettyCategoryLabel(
  category: PettyCategory,
  t: TranslationMap,
) {
  const categoryLabels: Record<PettyCategory, string> = {
    ICECUBE: `🧊 ${t.inventory.icecube}`,
    GAS: `🔥 ${t.inventory.gas}`,
    VEGGIE: `🥬 ${t.inventory.veggie}`,
    REPAIR: `🔧 ${t.inventory.repair}`,
    TIP: `💝 ${t.inventory.tip}`,
    MISC: `📦 ${t.inventory.other}`,
  };

  return categoryLabels[category];
}

function SummaryCards({ cards }: Readonly<{ cards: SummaryCard[] }>) {
  return (
    <>
      {cards.map((card) => (
        <div key={card.label} className="stat-card">
          <p className="text-xs font-medium text-gray-500">{card.label}</p>
          <p className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </>
  );
}

function FlowsTable({
  flows,
  locale,
  t,
  moneySuffix,
}: Readonly<{
  flows: CashFlow[];
  locale: string;
  t: TranslationMap;
  moneySuffix: string;
}>) {
  const dateLocale = getDateLocale(locale);

  return (
    <div className="section-amber overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left p-4">{t.inventory.date}</th>
            <th className="text-left p-4">{t.settings.type}</th>
            <th className="text-left p-4">{t.cash.category}</th>
            <th className="text-left p-4">{t.cash.description}</th>
            <th className="text-right p-4">{t.order.amount}</th>
          </tr>
        </thead>
        <tbody>
          {flows.map((flow) => {
            const isExpense = flow.type === "EXPENSE";

            return (
              <tr key={flow.id} className="border-b border-gray-100">
                <td className="p-4">
                  {new Date(flow.createdAt).toLocaleTimeString(dateLocale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex text-xs rounded-full px-2.5 py-1 font-bold ${
                      isExpense
                        ? "bg-red-50 text-red-600"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {isExpense
                      ? t.cash.expense.toUpperCase()
                      : t.cash.income.toUpperCase()}
                  </span>
                </td>
                <td className="p-4">{flow.category?.name}</td>
                <td className="p-4 text-gray-500">{flow.description || "—"}</td>
                <td
                  className={`p-4 text-right font-mono font-bold ${
                    isExpense ? "text-red-500" : "text-emerald-600"
                  }`}
                >
                  {isExpense ? "-" : "+"}
                  {fmt(flow.amount)}
                  {moneySuffix}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {flows.length === 0 ? (
        <p className="text-center text-gray-400 py-12">{t.reports.noData}</p>
      ) : null}
    </div>
  );
}

function RegistersTable({
  registers,
  locale,
  t,
  moneySuffix,
}: Readonly<{
  registers: CashRegister[];
  locale: string;
  t: TranslationMap;
  moneySuffix: string;
}>) {
  const dateLocale = getDateLocale(locale);

  return (
    <div className="section-amber overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left p-4">{t.inventory.date}</th>
            <th className="text-left p-4">{t.inventory.openedBy}</th>
            <th className="text-right p-4">{t.cash.openingBalance}</th>
            <th className="text-right p-4">{t.cash.closingBalance}</th>
            <th className="text-right p-4">{t.cash.expectedBalance}</th>
            <th className="text-right p-4">{t.cash.discrepancy}</th>
            <th className="text-left p-4">{t.inventory.registerStatus}</th>
          </tr>
        </thead>
        <tbody>
          {registers.map((register) => {
            const hasDiscrepancy = (register.discrepancy ?? 0) !== 0;

            return (
              <tr key={register.id} className="border-b border-gray-100">
                <td className="p-4 font-semibold">
                  {new Date(register.openingAt).toLocaleDateString(dateLocale)}
                </td>
                <td className="p-4">{register.user?.name}</td>
                <td className="p-4 text-right font-mono">
                  {fmt(register.openingBalance)}
                  {moneySuffix}
                </td>
                <td className="p-4 text-right font-mono">
                  {register.closingBalance
                    ? formatMoney(register.closingBalance, moneySuffix || "")
                    : "—"}
                </td>
                <td className="p-4 text-right font-mono">
                  {register.expectedBalance
                    ? formatMoney(register.expectedBalance, moneySuffix || "")
                    : "—"}
                </td>
                <td
                  className={`p-4 text-right font-mono font-bold ${
                    hasDiscrepancy ? "text-red-500" : "text-emerald-600"
                  }`}
                >
                  {register.discrepancy == null
                    ? "—"
                    : formatMoney(register.discrepancy, moneySuffix || "")}
                </td>
                <td className="p-4">
                  <span
                    className={`inline-flex text-xs rounded-full px-2 py-1 font-medium ${
                      register.status === "OPEN"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {register.status === "OPEN" ? t.cash.open : t.cash.locked}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CashDialog({
  children,
  onClose,
  title,
}: Readonly<{
  children: ReactNode;
  onClose: () => void;
  title: string;
}>) {
  return (
    <DismissibleBackdrop
      className="z-50 flex items-center justify-center bg-black/40"
      onDismiss={onClose}
    >
      <dialog
        open
        aria-label={title}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6"
      >
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        {children}
      </dialog>
    </DismissibleBackdrop>
  );
}

function CashHeader({
  activeRegister,
  isMobile,
  onOpenRegister,
  onCloseRegister,
  onOpenFlow,
  t,
}: Readonly<{
  activeRegister?: CashRegister;
  isMobile: boolean;
  onOpenRegister: () => void;
  onCloseRegister: () => void;
  onOpenFlow: () => void;
  t: TranslationMap;
}>) {
  return (
    <div className={`flex items-center justify-between ${isMobile ? "flex-wrap gap-2" : ""}`}>
      <div>
        <h2 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold text-gray-900`}>
          {t.cash.title}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{t.dashboard.modules.cash}</p>
      </div>
      <div className="flex gap-2">
        {activeRegister === undefined ? (
          <button
            onClick={onOpenRegister}
            className={`${isMobile ? "btn-pos-secondary text-sm" : "btn-pos-primary"}`}
          >
            <Plus className="h-4 w-4" /> {t.cash.openRegister}
          </button>
        ) : (
          <button
            onClick={onCloseRegister}
            className="btn-pos-secondary text-red-600 hover:bg-red-50 text-sm"
          >
            {t.cash.closeRegister}
          </button>
        )}
        <button
          onClick={onOpenFlow}
          className="btn-pos-secondary text-sm"
        >
          <Plus className="h-4 w-4" />{" "}
          {isMobile ? "+" : `${t.cash.income}/${t.cash.expense}`}
        </button>
      </div>
    </div>
  );
}

function CashTabsSection({
  activeRegister,
  flows,
  isMobile,
  locale,
  moneySuffix,
  registers,
  setOpenPetty,
  setPettyForm,
  t,
}: Readonly<{
  activeRegister?: CashRegister;
  flows: CashFlow[];
  isMobile: boolean;
  locale: string;
  moneySuffix: string;
  registers: CashRegister[];
  setOpenPetty: (open: boolean) => void;
  setPettyForm: Dispatch<SetStateAction<PettyFormState>>;
  t: TranslationMap;
}>) {
  return (
    <Tabs defaultValue="flows">
      <TabsList
        className={`bg-gray-100 border border-gray-200 p-1 rounded-full ${
          isMobile ? "flex flex-wrap" : ""
        }`}
      >
        <TabsTrigger
          value="flows"
          className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium"
        >
          {t.cash.title}
        </TabsTrigger>
        <TabsTrigger
          value="register"
          className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium"
        >
          {t.cash.cashRegister}
        </TabsTrigger>
        {activeRegister ? (
          <TabsTrigger
            value="petty"
            className="data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm rounded-full px-4 py-2 text-sm font-medium"
          >
            {t.cash.pettyCash}
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="flows" className="mt-4">
        <FlowsTable
          flows={flows}
          locale={locale}
          t={t}
          moneySuffix={moneySuffix}
        />
      </TabsContent>

      <TabsContent value="register" className="mt-4">
        <RegistersTable
          registers={registers}
          locale={locale}
          t={t}
          moneySuffix={moneySuffix}
        />
      </TabsContent>

      {activeRegister ? (
        <TabsContent value="petty" className="mt-4">
          <div className="flex gap-4">
            <button
              onClick={() => {
                setPettyForm((current) => ({ ...current, type: "EXPENSE" }));
                setOpenPetty(true);
              }}
              className="flex-1 h-16 rounded-2xl border-2 border-red-200 bg-red-50 text-red-600 font-bold text-sm flex items-center justify-center gap-2 hover:border-red-300 active:scale-[0.98] transition-all"
            >
              <TrendingDown className="h-5 w-5" /> {t.cash.expense}
            </button>
            <button
              onClick={() => {
                setPettyForm((current) => ({ ...current, type: "INCOME" }));
                setOpenPetty(true);
              }}
              className="flex-1 h-16 rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-sm flex items-center justify-center gap-2 hover:border-emerald-300 active:scale-[0.98] transition-all"
            >
              <TrendingUp className="h-5 w-5" /> {t.cash.income}
            </button>
          </div>
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

function OpenRegisterDialog({
  onClose,
  onChange,
  onSubmit,
  openingBalance,
  pending,
  t,
}: Readonly<{
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
  openingBalance: string;
  pending: boolean;
  t: TranslationMap;
}>) {
  return (
    <CashDialog title={t.cash.openRegister} onClose={onClose}>
      <div className="space-y-3">
        <Label>
          {t.cash.openingBalance} ({t.common.d})
        </Label>
        <Input
          type="number"
          className="h-11 rounded-lg"
          value={openingBalance}
          onChange={(event) => onChange(event.target.value)}
          autoFocus
        />
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onClose}
          className="flex-1 h-11 rounded-lg border border-gray-200 text-sm text-gray-600"
        >
          {t.order.cancel}
        </button>
        <button
          onClick={onSubmit}
          disabled={pending}
          className="flex-1 h-11 rounded-lg bg-amber-500 text-white font-semibold text-sm"
        >
          {t.cash.openRegister}
        </button>
      </div>
    </CashDialog>
  );
}

function CloseRegisterDialog({
  closingBalance,
  onClose,
  onChange,
  onSubmit,
  pending,
  t,
}: Readonly<{
  closingBalance: string;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  t: TranslationMap;
}>) {
  return (
    <CashDialog title={t.cash.closeRegister} onClose={onClose}>
      <div className="space-y-3">
        <Label>
          {t.cash.closingBalance} ({t.common.d})
        </Label>
        <Input
          type="number"
          className="h-11 rounded-lg"
          value={closingBalance}
          onChange={(event) => onChange(event.target.value)}
          autoFocus
        />
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onClose}
          className="flex-1 h-11 rounded-lg border border-gray-200 text-sm text-gray-600"
        >
          {t.order.cancel}
        </button>
        <button
          onClick={onSubmit}
          disabled={pending}
          className="flex-1 h-11 rounded-lg bg-amber-500 text-white font-semibold text-sm"
        >
          {t.cash.closeRegister}
        </button>
      </div>
    </CashDialog>
  );
}

function FlowDialog({
  categories,
  flowForm,
  onClose,
  onSubmit,
  pending,
  setFlowForm,
  t,
}: Readonly<{
  categories: CashCategory[];
  flowForm: FlowFormState;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  setFlowForm: Dispatch<SetStateAction<FlowFormState>>;
  t: TranslationMap;
}>) {
  return (
    <CashDialog
      title={`${t.cash.income}/${t.cash.expense}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>{t.settings.type}</Label>
          <Select
            value={flowForm.type}
            onValueChange={(value) =>
              setFlowForm((current) => ({
                ...current,
                type: value as FlowType,
              }))
            }
          >
            <SelectTrigger className="h-11 rounded-lg">
              <SelectValue placeholder={t.settings.type}>
                {flowForm.type === "INCOME"
                  ? `${t.cash.income} (INCOME)`
                  : `${t.cash.expense} (EXPENSE)`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INCOME">{t.cash.income} (INCOME)</SelectItem>
              <SelectItem value="EXPENSE">{t.cash.expense} (EXPENSE)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>{t.cash.category}</Label>
          <Select
            value={flowForm.categoryId}
            onValueChange={(value) =>
              setFlowForm((current) => ({
                ...current,
                categoryId: value ?? "",
              }))
            }
          >
            <SelectTrigger className="h-11 rounded-lg">
              <SelectValue placeholder={t.cash.category}>
                {categories.find((category) => category.id === flowForm.categoryId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories
                .filter((category) => category.type === flowForm.type)
                .map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>
            {t.order.amount} ({t.common.d})
          </Label>
          <Input
            type="number"
            className="h-11 rounded-lg"
            value={flowForm.amount}
            onChange={(event) =>
              setFlowForm((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
          />
        </div>

        <div className="space-y-1">
          <Label>{t.cash.description}</Label>
          <Input
            className="h-11 rounded-lg"
            value={flowForm.description}
            onChange={(event) =>
              setFlowForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onClose}
          className="flex-1 h-11 rounded-lg border border-gray-200 text-sm text-gray-600"
        >
          {t.order.cancel}
        </button>
        <button
          onClick={onSubmit}
          disabled={pending}
          className="flex-1 h-11 rounded-lg bg-amber-500 text-white font-semibold text-sm"
        >
          {t.common.save}
        </button>
      </div>
    </CashDialog>
  );
}

function PettyDialog({
  activeRegisterId,
  onClose,
  onSubmit,
  pending,
  pettyForm,
  setPettyForm,
  t,
}: Readonly<{
  activeRegisterId: string;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  pettyForm: PettyFormState;
  setPettyForm: Dispatch<SetStateAction<PettyFormState>>;
  t: TranslationMap;
}>) {
  return (
    <CashDialog
      title={pettyForm.type === "EXPENSE" ? t.cash.expense : t.cash.income}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>{t.settings.type}</Label>
          <Select
            value={pettyForm.category}
            onValueChange={(value) =>
              setPettyForm((current) => ({
                ...current,
                category: (value ?? "") as PettyCategory,
              }))
            }
          >
            <SelectTrigger className="h-11 rounded-lg">
              <SelectValue placeholder={t.settings.type}>
                {getPettyCategoryLabel(pettyForm.category, t)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ICECUBE">🧊 {t.inventory.icecube}</SelectItem>
              <SelectItem value="GAS">🔥 {t.inventory.gas}</SelectItem>
              <SelectItem value="VEGGIE">🥬 {t.inventory.veggie}</SelectItem>
              <SelectItem value="REPAIR">🔧 {t.inventory.repair}</SelectItem>
              <SelectItem value="TIP">💝 {t.inventory.tip}</SelectItem>
              <SelectItem value="MISC">📦 {t.inventory.other}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>
            {t.order.amount} ({t.common.d})
          </Label>
          <Input
            type="number"
            className="h-11 rounded-lg"
            value={pettyForm.amount}
            onChange={(event) =>
              setPettyForm((current) => ({
                ...current,
                amount: event.target.value,
              }))
            }
          />
        </div>

        <div className="space-y-1">
          <Label>{t.order.note}</Label>
          <Input
            className="h-11 rounded-lg"
            value={pettyForm.description}
            onChange={(event) =>
              setPettyForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={onClose}
          className="flex-1 h-11 rounded-lg border border-gray-200 text-sm text-gray-600"
        >
          {t.order.cancel}
        </button>
        <button
          onClick={onSubmit}
          disabled={pending || !activeRegisterId}
          className="flex-1 h-11 rounded-lg bg-amber-500 text-white font-semibold text-sm"
        >
          {t.common.save}
        </button>
      </div>
    </CashDialog>
  );
}

export function CashClient({
  registers,
  flows,
  categories,
  today,
}: Readonly<{
  registers: CashRegister[];
  flows: CashFlow[];
  categories: CashCategory[];
  today: string;
}>) {
  const { t, locale } = useI18n();
  const { isMobile } = useDeviceInfo();
  const [pending, start] = useTransition();
  const [openReg, setOpenReg] = useState(false);
  const [closeReg, setCloseReg] = useState(false);
  const [openFlow, setOpenFlow] = useState(false);
  const [openPetty, setOpenPetty] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [closingBalance, setClosingBalance] = useState("0");
  const [activeRegisterId, setActiveRegisterId] = useState(
    registers.find((register) => register.status === "OPEN")?.id ?? "",
  );
  const [flowForm, setFlowForm] = useState<FlowFormState>({
    categoryId: categories[0]?.id ?? "",
    amount: "0",
    description: "",
    type: "INCOME",
  });
  const [pettyForm, setPettyForm] = useState<PettyFormState>({
    category: "MISC",
    amount: "0",
    description: "",
    type: "EXPENSE",
  });

  const moneySuffix = t.common.d || "";
  const todayDate = new Date(today).toDateString();
  const todayFlows = flows.filter(
    (flow) => new Date(flow.createdAt).toDateString() === todayDate,
  );
  const totalIncome = todayFlows
    .filter((flow) => flow.type === "INCOME")
    .reduce((sum, flow) => sum + flow.amount, 0);
  const totalExpense = todayFlows
    .filter((flow) => flow.type === "EXPENSE")
    .reduce((sum, flow) => sum + flow.amount, 0);
  const activeRegister = registers.find((register) => register.status === "OPEN");
  const summaryCards: SummaryCard[] = [
    {
      label: `${t.cash.income} ${t.reports.today.toLowerCase()}`,
      value: formatMoney(totalIncome, moneySuffix),
      color: "text-emerald-600",
    },
    {
      label: `${t.cash.expense} ${t.reports.today.toLowerCase()}`,
      value: formatMoney(totalExpense, moneySuffix),
      color: "text-red-500",
    },
    {
      label: t.cash.cashRegister,
      value: activeRegister
        ? formatMoney(activeRegister.openingBalance, moneySuffix)
        : "—",
      color: "text-amber-600",
    },
  ];

  function handleAction<TArgs extends unknown[]>(
    action: (...args: TArgs) => Promise<unknown>,
    ...args: TArgs
  ) {
    start(async () => {
      try {
        await action(...args);
        toast.success(t.common.success);
        closeAllDialogs(setOpenReg, setCloseReg, setOpenFlow, setOpenPetty);
      } catch {
        toast.error(t.common.error);
      }
    });
  }

  function openCloseRegisterDialog() {
    if (!activeRegister) {
      return;
    }

    setActiveRegisterId(activeRegister.id);
    setCloseReg(true);
  }

  function submitOpenRegister() {
    handleAction(openCashRegister, {
      openingBalance: Number.parseFloat(openingBalance) || 0,
      userId: "admin",
    });
  }

  function submitCloseRegister() {
    handleAction(closeCashRegister, activeRegisterId, {
      closingBalance: Number.parseFloat(closingBalance) || 0,
      closedBy: "admin",
    });
  }

  function submitFlow() {
    handleAction(createCashFlow, {
      ...flowForm,
      amount: Number.parseFloat(flowForm.amount),
      userId: "admin",
    });
  }

  function submitPetty() {
    handleAction(createPettyTransaction, {
      cashRegisterId: activeRegisterId,
      ...pettyForm,
      amount: Number.parseFloat(pettyForm.amount),
      userId: "admin",
    });
  }

  return (
    <div className={`h-full overflow-y-auto space-y-6 ${isMobile ? "px-3 py-4" : "p-6"}`}>
      <CashHeader
        activeRegister={activeRegister}
        isMobile={isMobile}
        onOpenRegister={() => setOpenReg(true)}
        onCloseRegister={openCloseRegisterDialog}
        onOpenFlow={() => setOpenFlow(true)}
        t={t}
      />

      <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-3"} gap-4`}>
        <SummaryCards cards={summaryCards} />
      </div>

      <CashTabsSection
        activeRegister={activeRegister}
        flows={flows}
        isMobile={isMobile}
        locale={locale}
        moneySuffix={moneySuffix}
        registers={registers}
        setOpenPetty={setOpenPetty}
        setPettyForm={setPettyForm}
        t={t}
      />

      {openReg ? (
        <OpenRegisterDialog
          onClose={() => setOpenReg(false)}
          onChange={setOpeningBalance}
          onSubmit={submitOpenRegister}
          openingBalance={openingBalance}
          pending={pending}
          t={t}
        />
      ) : null}

      {closeReg ? (
        <CloseRegisterDialog
          closingBalance={closingBalance}
          onClose={() => setCloseReg(false)}
          onChange={setClosingBalance}
          onSubmit={submitCloseRegister}
          pending={pending}
          t={t}
        />
      ) : null}

      {openFlow ? (
        <FlowDialog
          categories={categories}
          flowForm={flowForm}
          onClose={() => setOpenFlow(false)}
          onSubmit={submitFlow}
          pending={pending}
          setFlowForm={setFlowForm}
          t={t}
        />
      ) : null}

      {openPetty ? (
        <PettyDialog
          activeRegisterId={activeRegisterId}
          onClose={() => setOpenPetty(false)}
          onSubmit={submitPetty}
          pending={pending}
          pettyForm={pettyForm}
          setPettyForm={setPettyForm}
          t={t}
        />
      ) : null}
    </div>
  );
}
