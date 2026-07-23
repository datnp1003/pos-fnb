"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { DismissibleBackdrop } from "@/components/shared/dismissible-backdrop";
import { LanguageSwitcher } from "@/i18n/language-switcher";
import { useI18n } from "@/i18n/context";
import { useDeviceInfo } from "@/components/shared/device-provider";
import { MobileBottomNav } from "@/components/shared/mobile-bottom-nav";
import { usePermission } from "@/hooks/use-permission";

export function PosLayoutClient({ children, enabledModuleNames }: Readonly<{ children: React.ReactNode; enabledModuleNames: readonly string[] }>) {
  const enabledModules = new Set(enabledModuleNames);
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useI18n();
  const { isMobile, isTablet, isDesktop } = useDeviceInfo();
  const { canAccessModule } = usePermission();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close user menu on navigation — intentional reactive reset.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setUserMenuOpen(false); }, [pathname]);

  const allNavItems: { href: string; label: string; module?: string }[] = [
    { href: "/dashboard", label: t.nav.dashboard, module: "dashboard" },
    { href: "/order", label: t.nav.sales, module: "order" },
    { href: "/inventory", label: t.nav.inventory, module: "inventory" },
    { href: "/cash", label: t.nav.cash, module: "cash" },
    { href: "/reports", label: t.nav.reports, module: "reports" },
    { href: "/settings", label: t.nav.settings, module: "settings" },
  ];

  // Keep all nav items, just disable ones without permission
  const navItems = allNavItems.map(item => ({
    ...item,
    visible: (!item.module || enabledModules.has(item.module)) && (!item.module || canAccessModule(item.module)),
  }));
  const isCompact = isMobile || isTablet;

  // ── Desktop Header ──────────────────────────────
  function renderDesktopHeader() {
    return (
      <header className="h-12 flex items-center justify-between px-4 shrink-0 bg-white border-b border-[#e5e7eb]">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="Logo" width={28} height={28} className="object-cover" />
            </div>
            <span className="font-bold text-sm text-gray-900">POS F&B</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}
                  aria-disabled={!item.visible}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    item.visible ? "" : "opacity-30 pointer-events-none"
                  } ${
                    active ? "bg-amber-50 text-amber-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold">
              {session?.user?.name?.[0] || "U"}
            </div>
            <span className="text-sm text-gray-700">{session?.user?.name}</span>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
    );
  }

  // ── Mobile / Tablet Compact Header ──────────────
  function renderCompactHeader() {
    return (
      <header className="h-11 flex items-center justify-between px-3 shrink-0 bg-white border-b border-[#e5e7eb]">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Logo" width={28} height={28} className="object-cover" />
          </div>
          <span className="font-bold text-sm text-gray-900">POS F&B</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold touch-manipulation"
            >
              {session?.user?.name?.[0] || "U"}
            </button>
            {userMenuOpen && (
              <>
                <DismissibleBackdrop className="z-10" onDismiss={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 min-w-[160px] py-1">
                  <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-100">
                    {session?.user?.name}
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.nav.logout}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f9fafb]">
      {/* Header: Desktop full / Mobile compact */}
      {isDesktop ? renderDesktopHeader() : renderCompactHeader()}

      {/* Main content — pad bottom on mobile for bottom nav */}
      <div className={`flex-1 overflow-hidden ${isCompact ? "pb-14" : ""}`}>
        {children}
      </div>

      {/* Bottom Tab Bar — mobile & tablet only */}
      {isCompact && <MobileBottomNav enabledModules={enabledModules} />}
    </div>
  );
}
