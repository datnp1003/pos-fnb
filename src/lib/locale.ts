import { cookies } from "next/headers";
import type { Locale } from "@/i18n/index";
import { getDictionary } from "@/i18n/dictionaries";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const cookieLocale = store.get("pos-locale")?.value;
  if (cookieLocale && ["vi", "en", "zh", "ko", "ja", "pt"].includes(cookieLocale)) {
    return cookieLocale as Locale;
  }
  return "vi";
}

export async function getServerDictionary() {
  return getDictionary(await getLocale());
}
