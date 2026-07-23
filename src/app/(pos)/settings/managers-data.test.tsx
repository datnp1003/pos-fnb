import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { exerciseUi } from "@/test/interact";

import { ProductsManager } from "./components-products";
import { PrintTemplatesManager } from "./components-templates";
import { UsersManager } from "./components";

const fn = vi.fn(async () => ({ success: true }));

async function exercise(ui: React.ReactElement, expectText: string) {
  const { container } = renderWithProviders(ui);
  expect(container.textContent).toContain(expectText);
  await exerciseUi(2);
}

describe("settings managers with data", () => {
  it("ProductsManager renders rows + dialogs", () => {
    const products = [
      {
        id: "p1", name: "Coffee", slug: "coffee", price: 25000, costPrice: 10000,
        categoryId: "c1", vatId: "v1", exciseTaxId: null, unitId: "u1", sortOrder: 1, isAvailable: true,
        category: { name: "Drinks" }, vat: { name: "VAT8", rate: 0.08 }, exciseTax: null, unit: { name: "cup" }, toppingGroups: [],
      },
    ];
    return exercise(
      <ProductsManager
        products={products as never}
        categories={[{ id: "c1", name: "Drinks" }] as never}
        vats={[{ id: "v1", name: "VAT8", rate: 0.08 }] as never}
        exciseTaxes={[{ id: "e1", name: "Excise", rate: 0.1 }] as never}
        units={[{ id: "u1", name: "cup" }] as never}
        createProduct={fn} updateProduct={fn} deleteProduct={fn}
        allIngredients={[{ id: "i1", name: "Milk", baseUnit: "ml" }] as never}
        toppingGroups={[{ id: "tg1", name: "Extras", type: "MULTIPLE", toppings: [] }] as never}
        linkToppingGroup={fn} unlinkToppingGroup={fn}
      />,
      "Coffee",
    );
  });

  it("PrintTemplatesManager renders rows + dialogs", () => {
    const templates = [
      { id: "tpl1", name: "Bill", type: "ORDER", width: 80, printer: { id: "pr1", name: "P1" }, config: null },
    ];
    return exercise(
      <PrintTemplatesManager
        templates={templates as never}
        printers={[{ id: "pr1", name: "P1" }] as never}
        createTemplate={fn} updateTemplate={fn} deleteTemplate={fn}
      />,
      "Bill",
    );
  });

  it("UsersManager renders rows + dialogs", () => {
    const users = [
      { id: "u1", name: "Admin", username: "admin", roleId: "r1", role: { name: "Admin" } },
    ];
    const roles = [
      { id: "r1", name: "Admin", permissions: '["*"]', scopes: '["*"]' },
    ];
    return exercise(<UsersManager users={users as never} roles={roles as never} />, "Admin");
  });
});
