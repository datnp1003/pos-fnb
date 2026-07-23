import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBluetoothPrinter } from "./use-bluetooth-printer";

type BluetoothMock = { requestDevice: ReturnType<typeof vi.fn> };

function makeChar() {
  return { writeValueWithoutResponse: vi.fn().mockResolvedValue(undefined) };
}

function makeDevice(char = makeChar()) {
  const server = {
    connect: vi.fn(),
    getPrimaryService: vi.fn(),
    disconnect: vi.fn(),
  };
  const service = { getCharacteristic: vi.fn().mockResolvedValue(char) };
  server.connect.mockResolvedValue(server);
  server.getPrimaryService.mockResolvedValue(service);
  const device = {
    gatt: { connect: server.connect },
    addEventListener: vi.fn(),
    __server: server,
    __char: char,
  };
  return device;
}

function setBluetooth(value: unknown) {
  Object.defineProperty(navigator, "bluetooth", { configurable: true, value });
}

function bluetoothMock() {
  return (navigator as Navigator & { bluetooth: BluetoothMock }).bluetooth;
}

describe("useBluetoothPrinter", () => {
  beforeEach(() => {
    setBluetooth({ requestDevice: vi.fn() });
  });

  afterEach(() => {
    // Clear cached device so module state does not leak between tests.
    setBluetooth({ requestDevice: vi.fn() });
  });

  it("errors when the browser has no Bluetooth support", async () => {
    setBluetooth(undefined);
    const { result } = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.error).toBeTruthy();
    expect(result.current.connected).toBe(false);
  });

  it("connects and exposes connected state", async () => {
    const device = makeDevice();
    bluetoothMock().requestDevice.mockResolvedValue(device);

    const { result } = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBeNull();
    expect(device.addEventListener).toHaveBeenCalledWith("gattserverdisconnected", expect.any(Function));

    act(() => result.current.disconnect());
    expect(device.__server.disconnect).toHaveBeenCalled();
  });

  it("treats user cancellation (NotFoundError) as a silent no-op", async () => {
    const err = Object.assign(new Error("cancelled"), { name: "NotFoundError" });
    bluetoothMock().requestDevice.mockRejectedValue(err);

    const { result } = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.connecting).toBe(false);
  });

  it("surfaces other connection errors", async () => {
    const err = Object.assign(new Error("boom"), { name: "NetworkError" });
    bluetoothMock().requestDevice.mockRejectedValue(err);

    const { result } = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.error).toBe("boom");
  });

  it("surfaces an error when the selected device has no gatt server", async () => {
    bluetoothMock().requestDevice.mockResolvedValue({
      addEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.error).toBeTruthy();

    const device = makeDevice();
    bluetoothMock().requestDevice.mockResolvedValue(device);
    await act(async () => {
      await result.current.connect();
    });
    act(() => result.current.disconnect());
  });

  it("prints text in chunks once connected", async () => {
    const char = makeChar();
    const device = makeDevice(char);
    bluetoothMock().requestDevice.mockResolvedValue(device);

    const { result } = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await result.current.connect();
    });

    let ok = false;
    await act(async () => {
      ok = await result.current.print("x".repeat(450));
    });
    expect(ok).toBe(true);
    // 450 bytes / 200-byte chunks → 3 writes.
    expect(char.writeValueWithoutResponse).toHaveBeenCalledTimes(3);

    act(() => result.current.disconnect());
  });

  it("reconnects a cached device on mount", async () => {
    const device = makeDevice();
    bluetoothMock().requestDevice.mockResolvedValue(device);

    const first = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await first.result.current.connect();
    });
    first.unmount();

    const second = renderHook(() => useBluetoothPrinter());
    await waitFor(() => expect(second.result.current.connected).toBe(true));
    expect(device.gatt.connect).toHaveBeenCalledTimes(2);

    act(() => second.result.current.disconnect());
  });

  it("reports cached reconnect failures on mount", async () => {
    const device = makeDevice();
    bluetoothMock().requestDevice.mockResolvedValue(device);

    const first = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await first.result.current.connect();
    });
    first.unmount();

    device.gatt.connect.mockRejectedValueOnce(new Error("reconnect-fail"));

    const second = renderHook(() => useBluetoothPrinter());
    await waitFor(() => expect(second.result.current.error).toBe("reconnect-fail"));
    expect(second.result.current.connected).toBe(false);

    device.gatt.connect.mockResolvedValue(device.__server);
    await act(async () => {
      await second.result.current.connect();
    });
    act(() => second.result.current.disconnect());
  });

  it("fails to print and sets an error when not connected", async () => {
    setBluetooth({ requestDevice: vi.fn() });
    const { result } = renderHook(() => useBluetoothPrinter());

    let ok = true;
    await act(async () => {
      ok = await result.current.print("hello");
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it("reports a print error when the write fails", async () => {
    const char = makeChar();
    char.writeValueWithoutResponse.mockRejectedValue(new Error("write-fail"));
    const device = makeDevice(char);
    bluetoothMock().requestDevice.mockResolvedValue(device);

    const { result } = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await result.current.connect();
    });

    let ok = true;
    await act(async () => {
      ok = await result.current.print("data");
    });
    expect(ok).toBe(false);
    await waitFor(() => expect(result.current.error).toContain("write-fail"));

    act(() => result.current.disconnect());
  });

  it("clears connection state when the device disconnects", async () => {
    const device = makeDevice();
    bluetoothMock().requestDevice.mockResolvedValue(device);

    const { result } = renderHook(() => useBluetoothPrinter());
    await act(async () => {
      await result.current.connect();
    });

    const disconnectListener = device.addEventListener.mock.calls[0][1];
    act(() => {
      disconnectListener();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.device).toBe(device);

    act(() => result.current.disconnect());
  });
});
