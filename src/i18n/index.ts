export type Locale = "vi" | "en" | "zh" | "ko" | "ja" | "pt";

export const locales: { code: Locale; label: string; flag: string }[] = [
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ko", label: "한국어", flag: "🇰🇷" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
];

export const localeNames: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
  zh: "中文",
  ko: "한국어",
  ja: "日本語",
  pt: "Português",
};
