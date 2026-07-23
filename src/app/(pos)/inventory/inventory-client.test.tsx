import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { renderWithProviders, userEvent } from "@/test/render";
import { createStockIn } from "@/server/inventory/actions";
import { getLastStockInBySupplier } from "@/server/inventory/supplier-actions";
import { InventoryClient } from "./inventory-client";

vi.mock("@/server/inventory/actions", () => ({
  getInventoryStatus: vi.fn(),
  getStockIns: vi.fn(),
  getStockOuts: vi.fn(),
  createStockIn: vi.fn(async () => undefined),
  getLowStockIngredients: vi.fn(),
}));

vi.mock("@/server/inventory/supplier-actions", () => ({
  getLastStockInBySupplier: vi.fn(async () => []),
}));

vi.mock("@/server/settings/actions", () => ({
  getIngredients: vi.fn(),
}));

const createStockInMock = vi.mocked(createStockIn);
const getLastStockInBySupplierMock = vi.mocked(getLastStockInBySupplier);
const toastMock = vi.mocked(toast);

const flour = {
  id: "ingredient-1",
  name: "Flour",
  baseUnit: "kg",
  purchaseUnit: "bag",
  currentStock: 2,
  minStock: 5,
};
const sugar = {
  id: "ingredient-2",
  name: "Sugar",
  baseUnit: "kg",
  purchaseUnit: "bag",
  currentStock: 20,
  minStock: 3,
};
const supplier = { id: "supplier-1", name: "Local Farm", contact: null, phone: null, email: null, address: null, note: null };
const stockIn = {
  id: "stock-in-1",
  code: "SI-001",
  createdAt: new Date("2026-06-17T10:00:00Z"),
  supplier: "Local Farm",
  totalAmount: 30000,
  items: [{ id: "item-1" }],
  user: { name: "Admin" },
};
const stockOut = {
  id: "stock-out-1",
  createdAt: new Date("2026-06-17T11:00:00Z"),
  ingredient: { name: "Flour" },
  quantity: 1,
  reason: "WASTE",
  user: { name: "Admin" },
};

function renderClient(props: Partial<React.ComponentProps<typeof InventoryClient>> = {}) {
  return renderWithProviders(
    <InventoryClient
      ingredients={props.ingredients ?? [flour, sugar] as never}
      stockIns={props.stockIns ?? [stockIn] as never}
      stockOuts={props.stockOuts ?? [stockOut] as never}
      lowStock={props.lowStock ?? [flour] as never}
      allIngredients={props.allIngredients ?? [flour, sugar] as never}
      suppliers={props.suppliers ?? [supplier]}
    />,
  );
}

function panel() {
  return document.querySelector(".fixed.inset-0.z-50") as HTMLElement;
}

describe("InventoryClient", () => {
  it("renders empty inventory states", async () => {
    const user = userEvent.setup();

    renderClient({ ingredients: [], stockIns: [], stockOuts: [], lowStock: [] });
    expect(screen.getByText("Chưa có dữ liệu")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Nhập kho" }));
    expect(screen.getByText(/Không có dữ liệu/)).toBeInTheDocument();
    expect(screen.getByText(/Chưa có phiếu nhập kho nào/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Xuất kho" }));
    expect(screen.getByText(/Chưa có phiếu xuất kho nào/)).toBeInTheDocument();
  });

  it("renders low-stock rows and sorts stock table", async () => {
    const user = userEvent.setup();

    renderClient();
    expect(screen.getAllByText(/Flour/).length).toBeGreaterThan(1);
    expect(screen.getByText("Sugar")).toBeInTheDocument();

    await user.click(screen.getByText(/Tồn hiện tại/));
    const rows = screen.getAllByRole("row");
    expect(rows.map(row => row.textContent).join(" ")).toContain("Flour");
  });

  it("shows stock-in and stock-out history tabs", async () => {
    const user = userEvent.setup();

    renderClient();
    await user.click(screen.getByRole("tab", { name: "Nhập kho" }));
    expect(screen.getByText("SI-001")).toBeInTheDocument();
    expect(screen.getByText("Local Farm")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Xuất kho" }));
    expect(screen.getByText("WASTE")).toBeInTheDocument();
  });

  it("creates stock-in from last supplier items and manual rows", async () => {
    getLastStockInBySupplierMock.mockResolvedValueOnce([
      { ingredientId: "ingredient-1", ingredientName: "Flour", unitPrice: 10000, purchaseUnit: "bag", baseUnit: "kg" },
    ] as never);
    const user = userEvent.setup();

    renderClient();
    await user.click(screen.getByRole("button", { name: /Nhập kho|Tạo phiếu nhập/ }));
    await user.click(screen.getByText("Chọn nhà cung cấp"));
    await user.click(await screen.findByText("Local Farm"));
    await waitFor(() => expect(getLastStockInBySupplierMock).toHaveBeenCalledWith("supplier-1"));

    await user.type(within(panel()).getByPlaceholderText("Số lượng"), "3");
    await user.click(within(panel()).getByText("Lưu").closest("button") as HTMLButtonElement);
    await waitFor(() => expect(createStockInMock).toHaveBeenCalledWith(expect.objectContaining({
      supplier: "Local Farm",
      supplierId: "supplier-1",
      userId: "admin",
      items: [{ ingredientId: "ingredient-1", quantity: 3, unitPrice: 10000 }],
    })));
  });

  it("adds and removes manual stock-in rows and handles submit errors", async () => {
    createStockInMock.mockRejectedValueOnce(new Error("failed"));
    const user = userEvent.setup();

    renderClient({ stockIns: [], stockOuts: [] });
    await user.click(screen.getByRole("button", { name: /Nhập kho|Tạo phiếu nhập/ }));
    await user.click(screen.getByText(/thêm dòng thủ công/i));
    expect(screen.getByText("Danh sách nguyên liệu (1)")).toBeInTheDocument();

    await user.click(within(panel()).getByText("— Nguyên liệu —"));
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    const spinButtons = within(panel()).getAllByRole("spinbutton");
    await user.type(spinButtons[0], "4");
    await user.type(spinButtons[1], "12000");
    await user.click(within(panel()).getByText("Lưu").closest("button") as HTMLButtonElement);
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());

    await user.click(within(panel()).getAllByRole("button").find(button => button.querySelector("svg") && button.className.includes("hover:bg-red")) as HTMLButtonElement);
    expect(screen.getByText("Danh sách nguyên liệu (0)")).toBeInTheDocument();
  });
});
