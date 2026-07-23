"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ClipboardList, Package, DollarSign, BarChart3, Settings,
  UtensilsCrossed, Coffee, ShoppingCart,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import { useDeviceInfo } from "@/components/shared/device-provider";
import { getDashboardStats } from "@/server/dashboard/actions";

type Stats = Awaited<ReturnType<typeof getDashboardStats>>;

const fmt = (v: number) => new Intl.NumberFormat("vi-VN").format(v);

function getDateLocale(loc: string): string {
  if (loc === "pt") return "pt-BR";
  if (loc === "en") return "en-US";
  return "vi-VN";
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { isMobile } = useDeviceInfo();
  const [stats, setStats] = useState<Stats | null>(null);
  const [, start] = useTransition();
  const dateLocale = getDateLocale(locale);

  const moduleKeys = ["sales", "inventory", "cash", "reports", "settings"] as const;
  const moduleIcons = [ClipboardList, Package, DollarSign, BarChart3, Settings];
  const moduleHrefs = ["/order", "/inventory", "/cash", "/reports", "/settings"];
  const moduleColors = ["text-amber-600", "text-blue-600", "text-emerald-600", "text-violet-600", "text-gray-600"];
  const moduleBgs = ["bg-amber-50", "bg-blue-50", "bg-emerald-50", "bg-violet-50", "bg-gray-100"];

  useEffect(() => {
    start(async () => { setStats(await getDashboardStats()); });
  }, []);

  return (
    <div className={`h-full overflow-y-auto space-y-8 ${isMobile ? "px-3 py-4" : "p-6"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold text-gray-900`}>{t.dashboard.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        {!isMobile && (
          <Link href="/order" className="btn-pos-primary">
            <ShoppingCart className="h-4 w-4" /> {t.dashboard.newOrder}
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"} gap-3`}>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50">
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">{t.dashboard.revenue} {t.dashboard.today.toLowerCase()}</p>
            <p className="text-xl font-bold text-gray-900">{stats ? fmt(stats.revenue) + (t.common.d || "") : "—"}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50">
            <ClipboardList className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">{t.dashboard.orders}</p>
            <p className="text-xl font-bold text-gray-900">{stats?.orderCount ?? "—"}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-50">
            <UtensilsCrossed className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">{t.dashboard.activeTables}</p>
            <p className="text-xl font-bold text-gray-900">{stats ? `${stats.occupiedTables} / ${stats.activeTables}` : "—"}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50">
            <Coffee className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">{t.dashboard.topProduct}</p>
            <p className="text-xl font-bold text-gray-900">{stats?.topProduct ?? "—"}</p>
            {stats?.topQty ? <p className="text-xs text-gray-400 mt-0.5">{stats.topQty} {t.dashboard.orders_unit}</p> : null}
          </div>
        </div>
      </div>

      {/* Modules + Timeline */}
      <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3"} gap-4`}>
        <div className={`lg:col-span-2 grid ${isMobile ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"} gap-3`}>
          {moduleKeys.map((key, i) => {
            const Icon = moduleIcons[i];
            return (
              <Link key={key} href={moduleHrefs[i]}
                className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md active:scale-[0.98] transition-all">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${moduleBgs[i]}`}>
                  <Icon className={`h-6 w-6 ${moduleColors[i]}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-900">{t.nav[key]}</h3>
                  <p className="text-xs text-gray-500 mt-1">{t.dashboard.modules[key]}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm text-gray-900">{t.dashboard.recentActivity}</h3>
            <Link href="/reports" className="text-xs font-medium text-amber-600 hover:underline">{t.dashboard.viewAll}</Link>
          </div>
          <div className="flex-1 space-y-4">
            {(!stats || stats.timeline.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-8">{t.dashboard.noActivity}</p>
            )}
            {stats?.timeline.map((item, i) => (
              <div key={item.id} className="relative pl-8">
                <div className="absolute left-0 top-0 w-5 h-5 rounded-full flex items-center justify-center border-[3px] border-white" style={{ backgroundColor: item.color + "20" }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
                {i < stats.timeline.length - 1 && <div className="absolute left-[9px] top-5 bottom-[-16px] w-0.5 bg-gray-200" />}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.time} {t.dashboard.ago}</p>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: item.color }}>{fmt(item.amount)}{t.common.d || ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
