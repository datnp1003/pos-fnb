import { vi } from "@/i18n/vi";
import { en } from "@/i18n/en";
import { zh } from "@/i18n/zh";
import { ko } from "@/i18n/ko";
import { ja } from "@/i18n/ja";
import { pt } from "@/i18n/pt";

const dicts: Record<string, typeof vi> = { vi, en, zh, ko, ja, pt };

export function t(locale?: string | null) {
  return dicts[locale || "vi"] || vi;
}
