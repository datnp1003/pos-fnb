import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { exerciseUi } from "@/test/interact";

import { CashClient } from "./cash/cash-client";
import { InventoryClient } from "./inventory/inventory-client";

async function exercise(ui: React.ReactElement) {
  const { container } = renderWithProviders(ui);
  expect(container.firstChild).toBeTruthy();
  await exerciseUi(2);
}

describe("(pos) clients with data", () => {
  it("CashClient renders flows + registers", () => {
    const flows = [
      { id: "f1", createdAt: new Date(), type: "INCOME", amount: 1000, description: "Sale", category: { name: "Sales" } },
      { id: "f2", createdAt: new Date(), type: "EXPENSE", amount: 500, description: "Buy", category: { name: "Supplies" } },
    ];
    const registers = [
      { id: "rg1", openingAt: new Date(), user: { name: "Admin" }, openingBalance: 5000, status: "OPEN", closingBalance: null },
    ];
    const categories = [
      { id: "cc1", name: "Sales", type: "INCOME" },
      { id: "cc2", name: "Supplies", type: "EXPENSE" },
    ];
    return exercise(
      <CashClient registers={registers as never} flows={flows as never} categories={categories as never} today="2026-01-01" />,
    );
  });

  it("InventoryClient renders stock tables", () => {
    const ingredients = [
      { id: "ing1", name: "Milk", baseUnit: "ml", currentStock: 100, minStock: 10 },
      { id: "ing2", name: "Sugar", baseUnit: "g", currentStock: 5, minStock: 20 },
    ];
    const stockIns = [
      { id: "si1", code: "SI1", createdAt: new Date(), supplier: "Acme", items: [{ id: "x" }], totalAmount: 1000, user: { name: "Admin" } },
    ];
    const stockOuts = [
      { id: "so1", createdAt: new Date(), ingredient: { name: "Milk" }, quantity: 5, reason: "WASTE", user: { name: "Admin" } },
    ];
    return exercise(
      <InventoryClient
        ingredients={ingredients as never}
        stockIns={stockIns as never}
        stockOuts={stockOuts as never}
        lowStock={[{ id: "ing2", name: "Sugar", baseUnit: "g", currentStock: 5 }] as never}
        allIngredients={[{ id: "ing1", name: "Milk", baseUnit: "ml" }] as never}
        suppliers={[{ id: "sup1", name: "Acme" }] as never}
      />,
    );
  });
});
