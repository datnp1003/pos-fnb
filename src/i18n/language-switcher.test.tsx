import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { LanguageSwitcher } from "./language-switcher";

describe("LanguageSwitcher", () => {
  it("renders a language control", () => {
    const { container } = renderWithProviders(<LanguageSwitcher />);
    expect(container.firstChild).toBeTruthy();
  });
});
