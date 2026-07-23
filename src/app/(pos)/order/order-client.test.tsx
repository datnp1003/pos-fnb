import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderWithProviders, screen, waitFor, within, userEvent } from "@/test/render";

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
  useDeviceInfo: () => ({ isMobile: false, isTablet: false, isDesktop: true }),
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

const baseOrder = {
  id: "o1",
  type: "NORMAL",
  status: "OPEN",
  orderNumber: 7,
  orderNumberSuffix: null,
  openedAt: new Date("2026-06-17T10:00:00.000Z"),
  closedAt: null,
  guestCount: 2,
  table: { id: "t1", name: "T1" },
  subtotal: 100000,
  vatAmount: 8000,
  exciseTaxAmount: 3000,
  serviceCharge: 5000,
  discountAmount: 1000,
  totalAmount: 115000,
  items: [
    {
      id: "i1",
      status: "PENDING",
      quantity: 2,
      unitPrice: 25000,
      product: { name: "Coffee", slug: "coffee" },
      toppings: [],
    },
    {
      id: "i2",
      status: "SENT",
      quantity: 1,
      unitPrice: 50000,
      product: { name: "Tea", slug: "tea" },
      toppings: [{ topping: { name: "Sugar" } }],
    },
    {
      id: "i3",
      status: "PENDING",
      quantity: 1,
      unitPrice: 15000,
      product: { name: "Cake", slug: "cake" },
      toppings: [],
    },
    {
      id: "i4",
      status: "CANCELLED",
      quantity: 1,
      unitPrice: 12000,
      product: { name: "Old Soda", slug: "old-soda" },
      toppings: [],
    },
  ],
};

const emptyOrder = {
  ...baseOrder,
  id: "empty-order",
  subtotal: 0,
  vatAmount: 0,
  exciseTaxAmount: 0,
  serviceCharge: 0,
  discountAmount: 0,
  totalAmount: 0,
  items: [],
};

const areas = [
  {
    id: "area-1",
    name: "Main",
    type: "RESTAURANT",
    tables: [
      { id: "t1", name: "T1", capacity: 4, isKaraoke: false, orders: [] },
      {
        id: "t2",
        name: "T2",
        capacity: 2,
        isKaraoke: false,
        orders: [{ id: "o1", status: "OPEN", orderNumber: 1, type: "NORMAL", openedAt: new Date("2026-06-17T09:00:00.000Z"), guestCount: 2, totalAmount: 50000 }],
      },
      {
        id: "t3",
        name: "T3",
        capacity: 6,
        isKaraoke: false,
        orders: [{ id: "o2", status: "SENT", orderNumber: 2, orderNumberSuffix: "A", type: "NORMAL", openedAt: new Date("2026-06-17T08:30:00.000Z"), guestCount: 3, totalAmount: 75000 }],
      },
    ],
  },
  {
    id: "area-2",
    name: "Patio",
    type: "RESTAURANT",
    tables: [{ id: "p1", name: "P1", capacity: 2, isKaraoke: false, orders: [] }],
  },
];

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
              type: "MULTIPLE",
              toppings: [
                { id: "tp1", name: "Honey", price: 3000 },
                { id: "tp2", name: "Cream", price: 0 },
              ],
            },
          },
        ],
      },
    ],
  },
  { id: "c2", name: "Empty", products: [] },
];

function setupOrder(order = baseOrder) {
  actionsMock.openTable.mockResolvedValue({ id: order.id });
  actionsMock.getOrder.mockResolvedValue(order);
  actionsMock.addItem.mockResolvedValue({});
  actionsMock.updateItemQuantity.mockResolvedValue({});
  actionsMock.removeItem.mockResolvedValue({});
  actionsMock.cancelItem.mockResolvedValue({});
  actionsMock.sendOrder.mockResolvedValue({});
  actionsMock.mergeTables.mockResolvedValue({});
  actionsMock.splitItemsEvenly.mockResolvedValue({});
  actionsMock.printTempBill.mockResolvedValue({ content: "prebill" });
  actionsMock.checkoutOrder.mockResolvedValue({});
  actionsMock.updateOrderGuest.mockResolvedValue({});
  actionsMock.refreshKaraokeTime.mockResolvedValue({});
}

async function openFreeTable() {
  const user = userEvent.setup();
  renderWithProviders(<OrderClient areas={areas as never} categories={categories as never} />);

  await user.click(screen.getByRole("button", { name: /T1/ }));
  await screen.findByText("Tea");

  return user;
}

function itemRow(name: string) {
  let element = screen.getByText(name) as HTMLElement;
  while (element.parentElement && element.querySelectorAll("button").length === 0) {
    element = element.parentElement;
  }
  return element;
}

function moneyInput() {
  return document.querySelector<HTMLInputElement>('input[inputmode="numeric"]')!;
}

function paymentSelect() {
  return document.querySelector<HTMLSelectElement>("select")!;
}

describe("OrderClient", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = "pos-locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    setupOrder();
  });

  it("renders an empty shell when no tables are configured", () => {
    const { container } = renderWithProviders(<OrderClient areas={[]} categories={[]} />);

    expect(container.firstChild).toBeTruthy();
    expect(screen.queryByText("Main")).not.toBeInTheDocument();
  });

  it("renders free and occupied tables and switches areas", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderClient areas={areas as never} categories={categories as never} />);

    expect(screen.getByRole("button", { name: /T1/ })).toHaveTextContent("4");
    expect(screen.getByRole("button", { name: /T2/ })).toHaveTextContent("#00000001");
    expect(screen.getByRole("button", { name: /T3/ })).toHaveTextContent("#00000002-A");

    await user.click(screen.getByRole("button", { name: "Patio" }));

    expect(screen.getByRole("button", { name: /P1/ })).toBeInTheDocument();
  });

  it("opens a free table and handles product, item, guest, print and checkout actions", async () => {
    const user = await openFreeTable();

    await user.click(screen.getByText("Latte"));
    await waitFor(() => expect(actionsMock.addItem).toHaveBeenCalledWith("o1", "p1", 1));

    const coffeeRow = itemRow("Coffee");
    const coffeeButtons = within(coffeeRow).getAllByRole("button");
    await user.click(coffeeButtons[1]);
    expect(actionsMock.updateItemQuantity).toHaveBeenCalledWith("i1", 3);

    await user.click(coffeeButtons[0]);
    expect(actionsMock.updateItemQuantity).toHaveBeenCalledWith("i1", 1);

    const cakeRow = itemRow("Cake");
    await user.click(within(cakeRow).getAllByRole("button")[0]);
    expect(actionsMock.removeItem).toHaveBeenCalledWith("i3");

    await user.click(within(coffeeRow).getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(actionsMock.cancelItem).toHaveBeenCalledWith("i1", "user"));

    const sendButton = screen.getByRole("button", { name: "Gửi bếp" });
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);
    await waitFor(() => expect(actionsMock.sendOrder).toHaveBeenCalledWith("o1", "area-1"));
    expect(toast.success).toHaveBeenCalledWith("Đã gửi bếp!");

    await user.click(screen.getAllByRole("button", { name: /Tạm tính/ }).at(-1)!);
    await waitFor(() => expect(actionsMock.printTempBill).toHaveBeenCalledWith("o1"));

    await user.click(screen.getAllByRole("button", { name: "+" })[0]);
    await waitFor(() => expect(actionsMock.updateOrderGuest).toHaveBeenCalledWith("o1", 3));
    await user.click(screen.getAllByRole("button", { name: "−" })[0]);
    await waitFor(() => expect(actionsMock.updateOrderGuest).toHaveBeenCalledWith("o1", 1));

    await user.click(screen.getByRole("button", { name: /Thanh toán/ }));
    expect(moneyInput()).toHaveValue("115.000");

    await user.click(screen.getAllByRole("button", { name: "Huỷ" }).at(-1)!);
    await waitFor(() => expect(screen.queryByText("Phương thức")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Thanh toán/ }));

    await user.selectOptions(paymentSelect(), "BANK_TRANSFER");
    await user.clear(moneyInput());
    await user.type(moneyInput(), "120000");
    await user.click(screen.getAllByRole("button", { name: "Thanh toán" }).at(-1)!);

    await waitFor(() => expect(actionsMock.checkoutOrder).toHaveBeenCalledWith("o1", [{ method: "BANK_TRANSFER", amount: 120000 }]));
    expect(toast.success).toHaveBeenCalledWith("Thanh toán thành công!");
  });

  it("opens topping selection and submits selected toppings", async () => {
    const user = await openFreeTable();

    await user.click(screen.getByText("Waffle"));
    await user.click(screen.getAllByRole("button", { name: "Huỷ" }).at(-1)!);
    await waitFor(() => expect(screen.queryByText("Honey")).not.toBeInTheDocument());

    await user.click(screen.getByText("Waffle"));
    await user.click((await screen.findByText("Honey")).closest("label")!);
    await user.click(screen.getByRole("button", { name: "Thêm món" }));

    await waitFor(() => {
      expect(actionsMock.addItem).toHaveBeenCalledWith("o1", "p2", 1, [{ toppingId: "tp1", price: 3000 }]);
    });
  });

  it("selects an occupied table and renders empty orders", async () => {
    setupOrder(emptyOrder);
    const user = userEvent.setup();
    renderWithProviders(<OrderClient areas={areas as never} categories={categories as never} />);

    await user.click(screen.getByRole("button", { name: /T2/ }));

    await screen.findByText("Chọn món tách");
    expect(actionsMock.refreshKaraokeTime).toHaveBeenCalledWith("o1");
    expect(actionsMock.getOrder).toHaveBeenCalledWith("o1");
  });

  it("merges and splits occupied tables from the table grid", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrderClient areas={areas as never} categories={categories as never} />);

    await user.click(screen.getByRole("button", { name: "Gộp" }));
    await user.click(screen.getByRole("button", { name: /T2/ }));
    await user.click(screen.getByRole("button", { name: /T3/ }));
    await user.click(screen.getByRole("button", { name: /Xác nhận gộp/ }));

    await waitFor(() => expect(actionsMock.mergeTables).toHaveBeenCalledWith(["o2"], "t2"));

    await user.click(screen.getByRole("button", { name: "Tách" }));
    await user.click(screen.getByRole("button", { name: /T2/ }));
    await user.click(screen.getByRole("button", { name: "Chọn món tách" }));
    await screen.findByText("Coffee x2");
    await user.click(screen.getAllByRole("button", { name: "Huỷ" }).at(-1)!);
    await waitFor(() => expect(screen.queryByText("Coffee x2")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Chọn món tách" }));
    await screen.findByText("Coffee x2");
    await user.click(screen.getByText("Coffee x2").closest("label")!);
    await user.click(screen.getAllByRole("button", { name: "Tách" }).at(-1)!);

    await waitFor(() => expect(actionsMock.splitItemsEvenly).toHaveBeenCalledWith("o1", ["i1"]));
  });

  it("TableGridView renders standalone and validates merge selection", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TableGridView
        areas={areas as never}
        activeAreaId="area-1"
        setActiveAreaId={() => {}}
        onOpenTable={() => {}}
        onSelectOrder={() => {}}
        onMergeTables={async () => {}}
        onSplitTable={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Gộp" }));

    expect(screen.getByText("🔀 Chọn bàn cần gộp (bàn đầu tiên làm đích):")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Huỷ" }));

    expect(screen.queryByText("🔀 Chọn bàn cần gộp (bàn đầu tiên làm đích):")).not.toBeInTheDocument();
  });
});
