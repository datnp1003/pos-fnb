"use client";

import { useState, useEffect, useRef } from "react";

export type Device = "mobile" | "tablet" | "desktop";

export interface DeviceInfo {
  device: Device;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
}

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

function getDevice(width: number): Device {
  if (width <= MOBILE_MAX) return "mobile";
  if (width <= TABLET_MAX) return "tablet";
  return "desktop";
}

function getDeviceInfo(width: number, height: number): DeviceInfo {
  const device = getDevice(width);
  return {
    device,
    isMobile: device === "mobile",
    isTablet: device === "tablet",
    isDesktop: device === "desktop",
    screenWidth: width,
    screenHeight: height,
  };
}

function getInitialInfo(): DeviceInfo {
  if (globalThis.window !== undefined) {
    return getDeviceInfo(globalThis.innerWidth, globalThis.innerHeight);
  }
  return getDeviceInfo(1024, 768); // SSR fallback
}

export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(getInitialInfo);
  const lastDeviceRef = useRef<Device>(getDevice(globalThis.window === undefined ? 1024 : globalThis.innerWidth));

  useEffect(() => {
    let raf = 0;
    function handleResize() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const newDevice = getDevice(globalThis.innerWidth);
        // Only re-render if the device category actually changed
        if (newDevice !== lastDeviceRef.current) {
          lastDeviceRef.current = newDevice;
          setInfo(getDeviceInfo(globalThis.innerWidth, globalThis.innerHeight));
        }
      });
    }
    globalThis.addEventListener("resize", handleResize, { passive: true });
    return () => {
      globalThis.removeEventListener("resize", handleResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return info;
}
