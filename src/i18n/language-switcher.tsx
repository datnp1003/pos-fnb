"use client";

import { useI18n } from "./context";
import { locales, type Locale } from "./index";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="relative">
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="h-8 px-2 pr-6 rounded-lg border border-gray-200 text-xs font-medium bg-white cursor-pointer hover:border-gray-300 transition-colors appearance-none"
        style={{ backgroundImage: 'none' }}
      >
        {locales.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
