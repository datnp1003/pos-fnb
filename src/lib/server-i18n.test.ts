import { describe, expect, it } from "vitest";

import { en } from "@/i18n/en";
import { vi } from "@/i18n/vi";
import { t } from "./server-i18n";

describe("server i18n helper", () => {
  it("returns the requested dictionary", () => {
    expect(t("en")).toBe(en);
  });

  it("falls back to Vietnamese for missing or unknown locales", () => {
    expect(t()).toBe(vi);
    expect(t(null)).toBe(vi);
    expect(t("unknown")).toBe(vi);
  });
});
