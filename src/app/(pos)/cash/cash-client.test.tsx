import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { renderWithProviders, userEvent } from "@/test/render";
import {
  closeCashRegister,
  createCashFlow,
  createPettyTransaction,
  openCashRegister,
} from "@/server/inventory/actions";
import { CashClient } from "./cash-client";

vi.mock("@/server/inventory/actions", () => ({
  getCashRegisters: vi.fn(),
  getCashFlow: vi.fn(),
  getCashFlowCategories: vi.fn(),
  createCashFlow: vi.fn(async () => undefined),
  openCashRegister: vi.fn(async () => undefined),
  closeCashRegister: vi.fn(async () => undefined),
  createPettyTransaction: vi.fn(async () => undefined),
}));

const openCashRegisterMock = vi.mocked(openCashRegister);
const closeCashRegisterMock = vi.mocked(closeCashRegister);
const createCashFlowMock = vi.mocked(createCashFlow);
const createPettyTransactionMock = vi.mocked(createPettyTransaction);
const toastMock = vi.mocked(toast);

const incomeCategory = { id: "cat-income", name: "Sales", type: "INCOME" };
const expenseCategory = { id: "cat-expense", name: "Supplies", type: "EXPENSE" };
const openRegister = {
  id: "register-1",
  status: "OPEN",
  openingAt: new Date("2026-06-17T08:00:00Z"),
  openingBalance: 100000,
  closingBalance: null,
  expectedBalance: null,
  discrepancy: null,
  user: { name: "Admin" },
};
const closedRegister = {
  ...openRegister,
  id: "register-2",
  status: "CLOSED",
  closingBalance: 150000,
  expectedBalance: 150000,
  discrepancy: 0,
};
const incomeFlow = {
  id: "flow-1",
  type: "INCOME",
  amount: 50000,
  description: "cash sale",
  createdAt: new Date("2026-06-17T10:00:00Z"),
  category: incomeCategory,
};
const expenseFlow = {
  id: "flow-2",
  type: "EXPENSE",
  amount: 10000,
  description: "napkins",
  createdAt: new Date("2026-06-17T11:00:00Z"),
  category: expenseCategory,
};

function renderCash(props: Partial<React.ComponentProps<typeof CashClient>> = {}) {
  return renderWithProviders(
    <CashClient
      registers={props.registers ?? [] as never}
      flows={props.flows ?? [] as never}
      categories={props.categories ?? [incomeCategory, expenseCategory] as never}
      today={props.today ?? "2026-06-17T12:00:00"}
    />,
  );
}

function dialog() {
  return document.querySelector(".fixed.inset-0.z-50") as HTMLElement;
}

function dialogSaveButton(name = "Lưu") {
  return within(dialog()).getAllByText(name).at(-1)?.closest("button") as HTMLButtonElement;
}

describe("CashClient", () => {
  it("renders closed register state and opens cash register", async () => {
    const user = userEvent.setup();

    renderCash();
    expect(screen.getByText("Không có dữ liệu")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Mở quỹ/ }));
    await user.clear(within(dialog()).getByRole("spinbutton"));
    await user.type(within(dialog()).getByRole("spinbutton"), "250000");
    await user.click(dialogSaveButton("Mở quỹ"));

    await waitFor(() => expect(openCashRegisterMock).toHaveBeenCalledWith({ openingBalance: 250000, userId: "admin" }));
  });

  it("renders open register totals, closes register, and shows register tab", async () => {
    const user = userEvent.setup();

    renderCash({ registers: [openRegister, closedRegister] as never, flows: [incomeFlow, expenseFlow] as never });
    expect(screen.getByText("+50.000đ")).toBeInTheDocument();
    expect(screen.getByText("-10.000đ")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Sổ quỹ" }));
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.getByText("Mở")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Đóng quỹ" }));
    await user.clear(within(dialog()).getByRole("spinbutton"));
    await user.type(within(dialog()).getByRole("spinbutton"), "140000");
    await user.click(dialogSaveButton("Đóng quỹ"));

    await waitFor(() => expect(closeCashRegisterMock).toHaveBeenCalledWith("register-1", { closingBalance: 140000, closedBy: "admin" }));
  });

  it("creates normal cash flow and reports action errors", async () => {
    createCashFlowMock.mockRejectedValueOnce(new Error("failed"));
    const user = userEvent.setup();

    renderCash({ registers: [openRegister] as never, flows: [incomeFlow] as never });
    await user.click(screen.getByRole("button", { name: /Thu\/Chi/ }));
    await user.clear(within(dialog()).getByRole("spinbutton"));
    await user.type(within(dialog()).getByRole("spinbutton"), "75000");
    await user.type(within(dialog()).getByRole("textbox"), "manual entry");
    await user.click(dialogSaveButton());

    await waitFor(() => expect(createCashFlowMock).toHaveBeenCalledWith({
      categoryId: "cat-income",
      amount: 75000,
      description: "manual entry",
      type: "INCOME",
      userId: "admin",
    }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });

  it("creates petty cash income and expense entries", async () => {
    const user = userEvent.setup();

    renderCash({ registers: [openRegister] as never, flows: [] as never });
    await user.click(screen.getByRole("tab", { name: "Tạm ứng" }));
    await user.click(screen.getAllByRole("button", { name: "Chi" }).at(-1) as HTMLButtonElement);
    await user.clear(within(dialog()).getByRole("spinbutton"));
    await user.type(within(dialog()).getByRole("spinbutton"), "12000");
    await user.type(within(dialog()).getByRole("textbox"), "ice");
    await user.click(dialogSaveButton());
    await waitFor(() => expect(createPettyTransactionMock).toHaveBeenCalledWith({
      cashRegisterId: "register-1",
      category: "MISC",
      amount: 12000,
      description: "ice",
      type: "EXPENSE",
      userId: "admin",
    }));

    await user.click(screen.getByRole("tab", { name: "Tạm ứng" }));
    await user.click(screen.getAllByRole("button", { name: "Thu" }).at(-1) as HTMLButtonElement);
    await user.clear(within(dialog()).getByRole("spinbutton"));
    await user.type(within(dialog()).getByRole("spinbutton"), "5000");
    await user.click(dialogSaveButton());
    await waitFor(() => expect(createPettyTransactionMock).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "INCOME",
      amount: 5000,
    })));
  });
});
