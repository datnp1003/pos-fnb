"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UtensilsCrossed, Package, Banknote, BarChart3, Settings,
} from "lucide-react";
import { useI18n } from "@/i18n/context";
import { usePermission } from "@/hooks/use-permission";

interface NavItem {
  href: string;
  icon: typeof UtensilsCrossed;
  labelKey: string;
  module?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/order", icon: UtensilsCrossed, labelKey: "sales", module: "order" },
  { href: "/inventory", icon: Package, labelKey: "inventory", module: "inventory" },
  { href: "/cash", icon: Banknote, labelKey: "cash", module: "cash" },
  { href: "/reports", icon: BarChart3, labelKey: "reports", module: "reports" },
  { href: "/settings", icon: Settings, labelKey: "settings", module: "settings" },
];

export function MobileBottomNav({ enabledModules }: Readonly<{ enabledModules: Set<string> }>) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { canAccessModule } = usePermission();

  // Check visibility per item (module enabled + user has permission)
  function isVisible(item: NavItem) {
    if (item.module && !enabledModules.has(item.module)) return false;
    if (item.module && !canAccessModule(item.module)) return false;
    return true;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-pb"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex justify-around h-14">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          const visible = isVisible(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-disabled={!visible}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-95 touch-manipulation ${
                visible ? "" : "opacity-30 pointer-events-none"
              } ${
                active ? "text-amber-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-semibold leading-none">
                {(t.nav as Record<string, string>)[item.labelKey] || item.labelKey}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
