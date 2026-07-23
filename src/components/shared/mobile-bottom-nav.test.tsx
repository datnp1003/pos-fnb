import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test/render";
import { MobileBottomNav } from "./mobile-bottom-nav";

const mockUsePathname = vi.mocked(usePathname);

const ALL = new Set(["order", "inventory", "cash", "reports", "settings"]);

describe("MobileBottomNav", () => {
  it("renders a link per enabled module", () => {
    mockUsePathname.mockReturnValue("/order");
    renderWithProviders(<MobileBottomNav enabledModules={ALL} />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("disables links for modules that are not enabled", () => {
    mockUsePathname.mockReturnValue("/order");
    renderWithProviders(<MobileBottomNav enabledModules={new Set(["order"])} />);
    const links = screen.getAllByRole("link");
    const enabled = links.filter(l => l.getAttribute("aria-disabled") === "false");
    const disabled = links.filter(l => l.getAttribute("aria-disabled") === "true");
    expect(enabled).toHaveLength(1);
    expect(disabled).toHaveLength(4);
  });

  it("marks the active route via amber styling", () => {
    mockUsePathname.mockReturnValue("/inventory");
    renderWithProviders(<MobileBottomNav enabledModules={ALL} />);
    const active = screen.getAllByRole("link").find(l => l.getAttribute("href") === "/inventory");
    expect(active?.className).toContain("text-amber-600");
  });

  it("treats nested paths as active for their parent route", () => {
    mockUsePathname.mockReturnValue("/order/123");
    renderWithProviders(<MobileBottomNav enabledModules={ALL} />);
    const active = screen.getAllByRole("link").find(l => l.getAttribute("href") === "/order");
    expect(active?.className).toContain("text-amber-600");
  });
});
