import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDevice } from "./use-device";

function setWidth(width: number, height = 800) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

describe("useDevice", () => {
  beforeEach(() => {
    // rAF resolves synchronously so resize handling is observable.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports mobile at narrow widths", () => {
    setWidth(500);
    const { result } = renderHook(() => useDevice());
    expect(result.current.device).toBe("mobile");
    expect(result.current.isMobile).toBe(true);
    expect(result.current.screenWidth).toBe(500);
  });

  it("reports tablet between breakpoints", () => {
    setWidth(800);
    const { result } = renderHook(() => useDevice());
    expect(result.current.device).toBe("tablet");
    expect(result.current.isTablet).toBe(true);
  });

  it("reports desktop above tablet breakpoint", () => {
    setWidth(1280);
    const { result } = renderHook(() => useDevice());
    expect(result.current.device).toBe("desktop");
    expect(result.current.isDesktop).toBe(true);
  });

  it("updates only when the device category changes on resize", () => {
    setWidth(1280);
    const { result } = renderHook(() => useDevice());
    expect(result.current.device).toBe("desktop");

    act(() => {
      setWidth(500);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.device).toBe("mobile");
    expect(result.current.screenWidth).toBe(500);
  });

  it("ignores resizes that stay in the same category", () => {
    setWidth(1280);
    const { result } = renderHook(() => useDevice());
    const before = result.current;

    act(() => {
      setWidth(1400);
      window.dispatchEvent(new Event("resize"));
    });
    // No category change → state object kept (no re-render with new width).
    expect(result.current).toBe(before);
    expect(result.current.screenWidth).toBe(1280);
  });

  it("removes the resize listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useDevice());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
