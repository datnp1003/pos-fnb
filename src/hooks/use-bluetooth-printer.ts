"use client";

import { useI18n } from "@/i18n/context";
import { useState, useEffect, useCallback, useRef } from "react";

// Web Bluetooth types for browser-only (minimal subset of the Web Bluetooth API)
type BTChar = { writeValueWithoutResponse(data: BufferSource): Promise<void> };
type BTService = { getCharacteristic(uuid: string): Promise<BTChar> };
type BTServer = { getPrimaryService(uuid: string): Promise<BTService>; disconnect(): void };
type BTDevice = {
  gatt?: { connect(): Promise<BTServer> };
  addEventListener(type: string, listener: () => void): void;
};
type BTNavigator = Navigator & {
  bluetooth?: { requestDevice(options: { acceptAllDevices?: boolean; optionalServices?: string[] }): Promise<BTDevice> };
};

const SPP_SERVICE = "00001101-0000-1000-8000-00805f9b34fb";

interface BluetoothPrinterState {
  device: BTDevice | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

let cachedDevice: BTDevice | null = null;

export function useBluetoothPrinter() {
    const { t } = useI18n();
const [state, setState] = useState<BluetoothPrinterState>({
    device: cachedDevice,
    connected: false,
    connecting: false,
    error: null,
  });
  const serverRef = useRef<BTServer | null>(null);
  const charRef = useRef<BTChar | null>(null);

  useEffect(() => {
    if (!cachedDevice) return;
    reconnect(cachedDevice);
  }, []);

  async function reconnect(device: BTDevice) {
    if (!device.gatt) return;
    setState(s => ({ ...s, connecting: true, error: null }));
    try {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SPP_SERVICE);
      const char = await service.getCharacteristic(SPP_SERVICE);
      serverRef.current = server;
      charRef.current = char;
      setState({ device, connected: true, connecting: false, error: null });
    } catch (e) {
      setState({ device, connected: false, connecting: false, error: (e as Error).message });
    }
  }

  const connect = useCallback(async () => {
    const nav = navigator as BTNavigator;
    if (!nav.bluetooth) {
      setState(s => ({ ...s, error: t.settings.bluetoothNotSupported }));
      return;
    }

    setState(s => ({ ...s, connecting: true, error: null }));

    try {
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SPP_SERVICE],
      });

      cachedDevice = device;
      device.addEventListener("gattserverdisconnected", () => {
        setState(s => ({ ...s, connected: false }));
        serverRef.current = null;
        charRef.current = null;
      });

      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(SPP_SERVICE);
      const char = await service.getCharacteristic(SPP_SERVICE);

      serverRef.current = server;
      charRef.current = char;
      setState({ device, connected: true, connecting: false, error: null });
    } catch (e) {
      const error = (e as Error).name === "NotFoundError" ? null : (e as Error).message;
      setState(s => ({ ...s, connecting: false, error }));
    }
  }, [t.settings.bluetoothNotSupported]);

  const print = useCallback(async (text: string): Promise<boolean> => {
    if (!charRef.current) {
      if (cachedDevice?.gatt) {
        try { await reconnect(cachedDevice); } catch {}
      }
      if (!charRef.current) {
        setState(s => ({ ...s, error: t.settings.bluetoothNotConnected }));
        return false;
      }
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const CHUNK = 200;
      for (let i = 0; i < data.length; i += CHUNK) {
        await charRef.current.writeValueWithoutResponse(data.slice(i, i + CHUNK));
      }
      return true;
    } catch (e) {
      setState(s => ({ ...s, error: t.settings.bluetoothPrintError + (e as Error).message }));
      return false;
    }
  }, [t.settings.bluetoothNotConnected, t.settings.bluetoothPrintError]);

  const disconnect = useCallback(() => {
    if (serverRef.current) {
      serverRef.current.disconnect();
      serverRef.current = null;
      charRef.current = null;
      cachedDevice = null;
      setState({ device: null, connected: false, connecting: false, error: null });
    }
  }, []);

  return { ...state, connect, print, disconnect };
}
