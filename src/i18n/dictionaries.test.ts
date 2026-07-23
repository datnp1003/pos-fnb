import { describe, expect, it } from "vitest";

import { en } from "./en";
import { ja } from "./ja";
import { ko } from "./ko";
import { pt } from "./pt";
import { vi } from "./vi";
import { zh } from "./zh";
import { getDictionary } from "./dictionaries";
import { localeNames, locales, type Locale } from "./index";

const dictionaries = { vi, en, zh, ko, ja, pt };

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];

  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(child, next);
  });
}

describe("i18n dictionaries", () => {
  it("returns dictionaries for each supported locale", () => {
    for (const locale of locales) {
      expect(getDictionary(locale.code)).toBe(dictionaries[locale.code]);
      expect(localeNames[locale.code]).toBe(locale.label);
    }
  });

  it("falls back to Vietnamese for unknown locales at runtime", () => {
    expect(getDictionary("missing" as Locale)).toBe(vi);
  });

  it("keeps translated dictionaries structurally aligned with Vietnamese", () => {
    const referenceKeys = flattenKeys(vi).sort();

    for (const [locale, dictionary] of Object.entries(dictionaries)) {
      expect(flattenKeys(dictionary).sort(), locale).toEqual(referenceKeys);
    }
  });
});
