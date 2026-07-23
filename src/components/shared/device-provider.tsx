"use client";

import { createContext, useContext, ReactNode } from "react";
import { DeviceInfo, useDevice } from "@/hooks/use-device";

const DeviceContext = createContext<DeviceInfo | null>(null);

export function DeviceProvider({ children }: Readonly<{ children: ReactNode }>) {
  const deviceInfo = useDevice();
  return (
    <DeviceContext.Provider value={deviceInfo}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDeviceInfo(): DeviceInfo {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error("useDeviceInfo must be used within DeviceProvider");
  return ctx;
}
