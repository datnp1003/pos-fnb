import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "@/test/prisma-mock";

// --- net.Socket mock -------------------------------------------------------
let socketBehavior: (sock: FakeSocket, connectCb: () => void) => void;
let writeErr: Error | undefined;

interface FakeSocket {
  on: (ev: string, cb: (e?: Error) => void) => FakeSocket;
  connect: (port: number, ip: string, cb: () => void) => void;
  write: (content: string, enc: string, cb: (e?: Error) => void) => void;
  destroy: () => void;
  handlers: Record<string, (e?: Error) => void>;
}

vi.mock("node:net", () => {
  class Socket implements FakeSocket {
    handlers: Record<string, (e?: Error) => void> = {};
    on(ev: string, cb: (e?: Error) => void) { this.handlers[ev] = cb; return this; }
    connect(_port: number, _ip: string, cb: () => void) {
      // Defer so sendToPrinter's later .on("error") handler is registered first.
      queueMicrotask(() => socketBehavior(this, cb));
    }
    write(_content: string, _enc: string, cb: (e?: Error) => void) { cb(writeErr); }
    destroy() {}
  }
  return { Socket };
});

import { createPrintJob, getPrintJobs, getPrintJobStats } from "./print-actions";

const fullOrder = {
  id: "order-1",
  orderNumber: 12,
  orderNumberSuffix: "1",
  guestCount: 3,
  note: "no onions",
  subtotal: 200,
  vatAmount: 20,
  exciseTaxAmount: 10,
  discountAmount: 5,
  serviceCharge: 8,
  totalAmount: 233,
  table: { name: "T1", areaId: "area-1" },
  user: { name: "Cashier" },
  payments: [{ method: "CASH", amount: 233 }],
  items: [
    {
      quantity: 2,
      unitPrice: 50,
      product: { name: "Pho", slug: "pho" },
      toppings: [{ topping: { name: "Extra" } }],
    },
    {
      quantity: 1,
      unitPrice: 100,
      product: { name: "Karaoke", slug: "karaoke-1" },
      toppings: [],
    },
  ],
};

function mockOrderLookups() {
  prismaMock.order.findUnique.mockImplementation(async (a: unknown) => {
    const q = a as { include?: { items?: unknown } };
    if (q.include?.items) return fullOrder as never;
    return { table: { areaId: "area-1" } } as never;
  });
}

function mockPrinter(overrides: Record<string, unknown> = {}) {
  prismaMock.printer.findFirst.mockResolvedValue({
    id: "printer-1",
    printMode: "CLIENT",
    ipAddress: "10.0.0.5",
    port: 9100,
    printTemplates: [{ id: "tpl-1", config: '{"_version":2,"bill":{"footer":{"thankYou":"Cam on"}}}' }],
    ...overrides,
  } as never);
  prismaMock.printJob.count.mockResolvedValue(4);
  prismaMock.printJob.create.mockResolvedValue({ id: "job-1" } as never);
  prismaMock.generalConfig.findFirst.mockResolvedValue({
    restaurantName: "My Resto",
    address: "123 St",
    phone: "555",
    taxCode: "TAX1",
  } as never);
}

describe("print-actions createPrintJob", () => {
  beforeEach(() => {
    socketBehavior = (_s, cb) => cb();
    writeErr = undefined;
  });
  afterEach(() => vi.useRealTimers());

  it("returns an error when the order is missing", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);
    const res = await createPrintJob({ orderId: "x", type: "BILL" });
    expect(res).toEqual({ success: false, error: "Order not found" });
  });

  it("returns an error when no active printer is found", async () => {
    mockOrderLookups();
    prismaMock.printer.findFirst.mockResolvedValue(null);
    const res = await createPrintJob({ orderId: "order-1", type: "BILL" });
    expect(res).toEqual({ success: false, error: "No active printer found" });
  });

  it("builds an ORDER ticket in CLIENT mode and returns content", async () => {
    mockOrderLookups();
    mockPrinter();
    const res = await createPrintJob({ orderId: "order-1", type: "ORDER" });
    expect(res.success).toBe(true);
    expect(res.jobId).toBe("job-1");
    // Karaoke item excluded from kitchen ticket; food item kept.
    expect(res.content).toContain("Pho");
    expect(res.content).not.toContain("Karaoke");
    expect(res.content).toContain("Ban: T1");
  });

  it("builds a BILL with totals, taxes and payment lines", async () => {
    mockOrderLookups();
    mockPrinter();
    const res = await createPrintJob({ orderId: "order-1", type: "BILL", userId: "u1" });
    expect(res.success).toBe(true);
    expect(res.content).toContain("MY RESTO");
    expect(res.content).toContain("TONG CONG");
    expect(res.content).toContain("CASH");
    expect(res.content).toContain("Cam on");
  });

  it("builds a TEMP_BILL via the bill builder", async () => {
    mockOrderLookups();
    mockPrinter();
    const res = await createPrintJob({ orderId: "order-1", type: "TEMP_BILL" });
    expect(res.success).toBe(true);
    expect(res.content).toContain("HOA DON BAN HANG");
  });

  it("falls back to any active printer when none match the area", async () => {
    mockOrderLookups();
    prismaMock.printer.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "printer-2",
        printMode: "CLIENT",
        ipAddress: "1.1.1.1",
        port: 9100,
        printTemplates: [],
      } as never);
    prismaMock.printJob.count.mockResolvedValue(0);
    prismaMock.printJob.create.mockResolvedValue({ id: "job-2" } as never);
    prismaMock.generalConfig.findFirst.mockResolvedValue(null);
    const res = await createPrintJob({ orderId: "order-1", type: "BILL" });
    expect(res.success).toBe(true);
    expect(res.content).toContain("RESTAURANT");
  });

  it("sends over TCP in SERVER mode and records success", async () => {
    mockOrderLookups();
    mockPrinter({ printMode: "SERVER" });
    // Real timers: production resolves ~500ms after a successful write, well
    // under the test timeout. Fake timers don't control the mock socket's
    // queueMicrotask, which desyncs ordering and leaks into later tests.
    const res = await createPrintJob({ orderId: "order-1", type: "BILL" });
    expect(res.success).toBe(true);
    // CLIENT-only content is undefined in SERVER mode.
    expect(res.content).toBeUndefined();
  });

  it("records a failure when the printer connection errors", async () => {
    mockOrderLookups();
    mockPrinter({ printMode: "SERVER" });
    socketBehavior = (sock) => sock.handlers.error?.(new Error("ECONNREFUSED"));
    const res = await createPrintJob({ orderId: "order-1", type: "BILL" });
    expect(res.success).toBe(false);
    expect(res.error).toBe("ECONNREFUSED");
  });
});

describe("print-actions queries", () => {
  it("filters print jobs by date and type", async () => {
    prismaMock.printJob.findMany.mockResolvedValue([{ id: "job-1" }] as never);
    await getPrintJobs("2026-06-16", "BILL");
    const arg = prismaMock.printJob.findMany.mock.calls[0][0] as {
      where: { type?: string; createdAt?: { gte: Date; lte: Date } };
    };
    expect(arg.where.type).toBe("BILL");
    expect(arg.where.createdAt?.gte).toBeInstanceOf(Date);
  });

  it("lists all print jobs when no filters are given", async () => {
    prismaMock.printJob.findMany.mockResolvedValue([] as never);
    await getPrintJobs();
    const arg = prismaMock.printJob.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(arg.where).toEqual({});
  });

  it("aggregates today's print job stats", async () => {
    prismaMock.printJob.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(9);
    const stats = await getPrintJobStats();
    expect(stats).toEqual({ orderCount: 3, billCount: 5, failedCount: 1, totalToday: 9 });
  });
});
