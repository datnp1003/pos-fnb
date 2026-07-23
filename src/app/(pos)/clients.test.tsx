import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { exerciseUi } from "@/test/interact";

import { CashClient } from "./cash/cash-client";
import { PosLayoutClient } from "./pos-layout-client";
import { InventoryClient } from "./inventory/inventory-client";

async function exercise(ui: React.ReactElement) {
  const { container } = renderWithProviders(ui);
  expect(container.firstChild).toBeTruthy();
  await exerciseUi();
}

describe("(pos) clients", () => {
  it("CashClient", () =>
    exercise(<CashClient registers={[]} flows={[]} categories={[]} today="2026-01-01" />));

  it("PosLayoutClient", () =>
    exercise(
      <PosLayoutClient enabledModuleNames={["order", "settings"]}>
        <div>child</div>
      </PosLayoutClient>,
    ));

  it("InventoryClient", () =>
    exercise(
      <InventoryClient
        ingredients={[]}
        stockIns={[]}
        stockOuts={[]}
        lowStock={[]}
        allIngredients={[]}
        suppliers={[]}
      />,
    ));
});
