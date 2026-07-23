import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderWithProviders, screen, waitFor, userEvent } from "@/test/render";

const actionsMock = vi.hoisted(() => ({
  openTable: vi.fn(),
  getOrder: vi.fn(),
  addItem: vi.fn(),
  updateItemQuantity: vi.fn(),
  removeItem: vi.fn(),
  cancelItem: vi.fn(),
  sendOrder: vi.fn(),
  mergeTables: vi.fn(),
  splitItemsEvenly: vi.fn(),
  printTempBill: vi.fn(),
  checkoutOrder: vi.fn(),
  updateOrderGuest: vi.fn(),
  refreshKaraokeTime: vi.fn(),
}));

vi.mock("@/server/order/actions", () => actionsMock);

vi.mock("@/components/shared/device-provider", () => ({
  DeviceProvider: ({ children }: { children: React.ReactNode }) => children,
  useDeviceInfo: () => ({ isMobile: true, isTablet: false, isDesktop: false }),
}));

vi.mock("@/hooks/use-bluetooth-printer", () => ({
  useBluetoothPrinter: () => ({
    connected: false,
    connecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    print: vi.fn(),
  }),
}));

import { OrderClient, TableGridView } from "./order-client";

const orderDetail = {
  id: "o1",
  type: "NORMAL",
  status: "OPEN",
  orderNumber: 9,
  openedAt: new Date("2026-06-17T11:00:00.000Z"),
  closedAt: null,
  guestCount: 2,
  table: { id: "t1", name: "T1" },
  subtotal: 100000,
  vatAmount: 8000,
  exciseTaxAmount: 0,
  serviceCharge: 5000,
  discountAmount: 1000,
  totalAmount: 112000,
  items: [
    { id: "i1", status: "PENDING", quantity: 2, unitPrice: 25000, product: { name: "Coffee", slug: "coffee" }, toppings: [] },
  ],
};

const area = {
  id: "area-1",
  name: "Main",
  type: "RESTAURANT",
  tables: [{ id: "t1", name: "T1", capacity: 4, isKaraoke: false, orders: [] }],
};

const occupiedArea = {
  id: "area-1",
  name: "Main",
  type: "RESTAURANT",
  tables: [
    {
      id: "t1",
      name: "T1",
      capacity: 4,
      isKaraoke: false,
      orders: [{ id: "o1", status: "OPEN", orderNumber: 1, type: "NORMAL", openedAt: new Date("2026-06-17T10:00:00.000Z"), guestCount: 2, totalAmount: 50000 }],
    },
    {
      id: "t2",
      name: "T2",
      capacity: 4,
      isKaraoke: false,
      orders: [{ id: "o2", status: "OPEN", orderNumber: 2, type: "NORMAL", openedAt: new Date("2026-06-17T10:10:00.000Z"), guestCount: 2, totalAmount: 60000 }],
    },
  ],
};

const categories = [
  {
    id: "c1",
    name: "Drinks",
    products: [
      { id: "p1", name: "Latte", price: 25000, unit: { name: "cup" }, toppingGroups: [] },
      {
        id: "p2",
        name: "Waffle",
        price: 40000,
        unit: { name: "plate" },
        toppingGroups: [
          {
            toppingGroup: {
              id: "tg1",
              name: "Extras",
              type: "SINGLE",
              toppings: [{ id: "tp1", name: "Milk", price: 2000 }],
            },
          },
        ],
      },
    ],
  },
];

function setupOrder() {
  actionsMock.openTable.mockResolvedValue({ id: "o1" });
  actionsMock.getOrder.mockResolvedValue(orderDetail);
  actionsMock.addItem.mockResolvedValue({});
  actionsMock.updateItemQuantity.mockResolvedValue({});
  actionsMock.removeItem.mockResolvedValue({});
  actionsMock.cancelItem.mockResolvedValue({});
  actionsMock.sendOrder.mockResolvedValue({});
  actionsMock.mergeTables.mockResolvedValue({});
  actionsMock.splitItemsEvenly.mockResolvedValue({});
  actionsMock.printTempBill.mockResolvedValue({ content: "x" });
  actionsMock.checkoutOrder.mockResolvedValue({});
  actionsMock.updateOrderGuest.mockResolvedValue({});
  actionsMock.refreshKaraokeTime.mockResolvedValue({});
}

async function openMobileOrder() {
  const user = userEvent.setup();
  renderWithProviders(<OrderClient areas={[area] as never} categories={categories as never} />);

  await user.click(screen.getByRole("button", { name: /T1/ }));
  await screen.findByText("Latte");

  return user;
}

function moneyInput() {
  return document.querySelector<HTMLInputElement>('input[inputmode="numeric"]')!;
}

function paymentSelect() {
  return document.querySelector<HTMLSelectElement>("select")!;
}

describe("OrderClient (mobile)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "pos-locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    setupOrder();
  });

  it("adds products and toppings from the mobile catalog", async () => {
    const user = await openMobileOrder();

    await user.click(screen.getByText("Latte"));
    await waitFor(() => expect(actionsMock.addItem).toHaveBeenCalledWith("o1", "p1", 1));

    await user.click(screen.getByText("Waffle"));
    await user.click((await screen.findByText("Milk")).closest("label")!);
    await user.click(screen.getByRole("button", { name: "Thêm món" }));

    await waitFor(() => {
      expect(actionsMock.addItem).toHaveBeenCalledWith("o1", "p2", 1, [{ toppingId: "tp1", price: 2000 }]);
    });
  });

  it("opens the mobile order sheet and completes checkout", async () => {
    const user = await openMobileOrder();

    await user.click(screen.getByRole("button", { name: "+" }));
    await waitFor(() => expect(actionsMock.updateOrderGuest).toHaveBeenCalledWith("o1", 3));
    await user.click(screen.getByRole("button", { name: "−" }));
    await waitFor(() => expect(actionsMock.updateOrderGuest).toHaveBeenCalledWith("o1", 1));

    await user.click(screen.getByRole("button", { name: /Món đã gọi/ }));
    await screen.findByText("Coffee");
    await user.click(screen.getByRole("button", { name: /Thanh toán/ }));

    expect(moneyInput()).toHaveValue("112.000");

    await user.selectOptions(paymentSelect(), "MOMO");
    await user.click(screen.getByRole("button", { name: /Xác nhận/ }));

    await waitFor(() => expect(actionsMock.checkoutOrder).toHaveBeenCalledWith("o1", [{ method: "MOMO", amount: 112000 }]));
    expect(toast.success).toHaveBeenCalledWith("Thanh toán thành công!");
  });

  it("shows an error when mobile checkout action rejects", async () => {
    actionsMock.checkoutOrder.mockRejectedValueOnce(new Error("payment failed"));
    const user = await openMobileOrder();

    await user.click(screen.getByRole("button", { name: /Món đã gọi/ }));
    await user.click(screen.getByRole("button", { name: /Thanh toán/ }));
    await user.click(screen.getByRole("button", { name: /Xác nhận/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Lỗi!"));
  });

  it("uses the mobile table merge and split action bars", async () => {
    const user = userEvent.setup();
    const onMergeTables = vi.fn(async () => {});
    const onSplitTable = vi.fn();

    renderWithProviders(
      <TableGridView
        areas={[occupiedArea] as never}
        activeAreaId="area-1"
        setActiveAreaId={() => {}}
        onOpenTable={() => {}}
        onSelectOrder={() => {}}
        onMergeTables={onMergeTables}
        onSplitTable={onSplitTable}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Gộp" }));
    await user.click(screen.getByRole("button", { name: /T1/ }));
    await user.click(screen.getByRole("button", { name: /T2/ }));
    await user.click(screen.getByRole("button", { name: /Xác nhận gộp/ }));

    await waitFor(() => expect(onMergeTables).toHaveBeenCalledWith(["o2"], "t1"));

    await user.click(screen.getByRole("button", { name: "Tách" }));
    await user.click(screen.getByRole("button", { name: /T1/ }));
    await user.click(screen.getByRole("button", { name: "Chọn món tách" }));

    expect(onSplitTable).toHaveBeenCalledWith("o1");

    await user.click(screen.getByRole("button", { name: "Huỷ" }));

    expect(screen.queryByText("✂️ Chọn bàn cần tách:")).not.toBeInTheDocument();
  });
});
