import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider, useI18n } from "./context";

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe("I18nProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "pos-locale=; max-age=0";
  });
  afterEach(() => localStorage.clear());

  it("defaults to Vietnamese", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe("vi");
  });

  it("loads a stored locale on mount and sets the cookie", () => {
    localStorage.setItem("pos-locale", "en");
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe("en");
    expect(document.cookie).toContain("pos-locale=en");
  });

  it("ignores an unsupported stored locale", () => {
    localStorage.setItem("pos-locale", "xx");
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe("vi");
  });

  it("switches locale and persists it via setLocale", () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => result.current.setLocale("ko"));
    expect(result.current.locale).toBe("ko");
    expect(localStorage.getItem("pos-locale")).toBe("ko");
    expect(document.cookie).toContain("pos-locale=ko");
  });

  it("exposes a dictionary through the provider to consumers", () => {
    function Consumer() {
      const { t } = useI18n();
      return <span>{typeof t === "object" ? "has-dict" : "no-dict"}</span>;
    }
    render(<Consumer />, { wrapper });
    expect(screen.getByText("has-dict")).toBeInTheDocument();
  });
});
