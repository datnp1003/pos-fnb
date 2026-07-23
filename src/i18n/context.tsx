"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import type { Locale } from "./index";
import { getDictionary, type Dictionary } from "./dictionaries";

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dictionary;
}>({
  locale: "vi",
  setLocale: () => {},
  t: getDictionary("vi"),
});

const STORAGE_KEY = "pos-locale";

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("vi");
  const [t, setT] = useState<Dictionary>(getDictionary("vi"));

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    const cookieLocale = document.cookie.split("; ").find(r => r.startsWith("pos-locale="))?.split("=")[1];
    if (stored && ["vi", "en", "zh", "ko", "ja"].includes(stored)) {
      // Hydrate locale from client-only storage on mount — must run in an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale(stored);
      setT(getDictionary(stored));
      // Set cookie on initial load so server components can pick up the locale
      if (cookieLocale !== stored) {
        document.cookie = `pos-locale=${stored};path=/;max-age=31536000;SameSite=Lax`;
      }
    }
  }, []);

  const changeLocale = useCallback((l: Locale) => {
    setLocale(l);
    setT(getDictionary(l));
    localStorage.setItem(STORAGE_KEY, l);
    // Set cookie so server components can read locale
    document.cookie = `pos-locale=${l};path=/;max-age=31536000;SameSite=Lax`;
  }, []);

  const value = useMemo(() => ({ locale, setLocale: changeLocale, t }), [locale, changeLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
