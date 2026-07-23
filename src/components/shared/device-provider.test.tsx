import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { DeviceProvider, useDeviceInfo } from "./device-provider";

describe("DeviceProvider", () => {
  it("throws when useDeviceInfo is used outside the provider", () => {
    expect(() => renderHook(() => useDeviceInfo())).toThrow(/within DeviceProvider/);
  });

  it("provides device info to consumers", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DeviceProvider>{children}</DeviceProvider>
    );
    const { result } = renderHook(() => useDeviceInfo(), { wrapper });
    expect(result.current.isMobile).toBe(true);
    expect(result.current.device).toBe("mobile");
  });
});
