import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { exerciseUi } from "@/test/interact";

import { PrintersManager } from "./components-printers";
import { ProductsManager } from "./components-products";
import { PrintTemplatesManager } from "./components-templates";
import { ToppingsManager } from "./components-toppings";
import { DiscountsUI } from "./discounts-ui";
import { ServiceChargesUI } from "./service-charges-ui";
import { UsersManager } from "./components";
import { DataTable } from "./data-table";
import { GeneralConfigForm } from "./form";

const fn = vi.fn(async () => undefined);

function ok(ui: React.ReactElement) {
  const { container } = renderWithProviders(ui);
  expect(container.firstChild).toBeTruthy();
}

async function exercise(ui: React.ReactElement) {
  const { container } = renderWithProviders(ui);
  await exerciseUi();
  expect(container).toBeTruthy();
}

describe("settings managers render", () => {
  it("PrintersManager", () => {
    ok(<PrintersManager printers={[]} areas={[]} createPrinter={fn} updatePrinter={fn} deletePrinter={fn} />);
  });

  it("ProductsManager", () => {
    ok(
      <ProductsManager
        products={[]} categories={[]} vats={[]} exciseTaxes={[]} units={[]}
        createProduct={fn} updateProduct={fn} deleteProduct={fn}
        allIngredients={[]} toppingGroups={[]} linkToppingGroup={fn} unlinkToppingGroup={fn}
      />,
    );
  });

  it("PrintTemplatesManager", () => {
    ok(<PrintTemplatesManager templates={[]} printers={[]} createTemplate={fn} updateTemplate={fn} deleteTemplate={fn} />);
  });

  it("ToppingsManager", () => {
    ok(
      <ToppingsManager
        groups={[]} createGroup={fn} updateGroup={fn} deleteGroup={fn}
        createTopping={fn} updateTopping={fn} deleteTopping={fn}
        categories={[]} products={[]} linkToppingGroup={fn} unlinkToppingGroup={fn}
      />,
    );
  });

  it("DiscountsUI", () => {
    ok(<DiscountsUI discounts={[]} categories={[]} createDiscount={fn} updateDiscount={fn} deleteDiscount={fn} />);
  });

  it("ServiceChargesUI", () => {
    ok(<ServiceChargesUI charges={[]} categories={[]} areas={[]} createServiceCharge={fn} updateServiceCharge={fn} deleteServiceCharge={fn} />);
  });

  it("UsersManager", () => {
    ok(<UsersManager users={[]} roles={[]} />);
  });

  it("DataTable", () => {
    ok(<DataTable data={[]} columns={[{ key: "name", label: "Name" }]} onCreate={fn} onUpdate={fn} onDelete={fn} />);
  });

  it("GeneralConfigForm", () => {
    ok(<GeneralConfigForm config={null} action={fn as never} />);
  });
});

describe("settings managers interactions", () => {
  it("PrintersManager dialogs", () =>
    exercise(<PrintersManager printers={[]} areas={[]} createPrinter={fn} updatePrinter={fn} deletePrinter={fn} />));

  it("ProductsManager dialogs", () =>
    exercise(
      <ProductsManager
        products={[]} categories={[]} vats={[]} exciseTaxes={[]} units={[]}
        createProduct={fn} updateProduct={fn} deleteProduct={fn}
        allIngredients={[]} toppingGroups={[]} linkToppingGroup={fn} unlinkToppingGroup={fn}
      />,
    ));

  it("PrintTemplatesManager dialogs", () =>
    exercise(<PrintTemplatesManager templates={[]} printers={[]} createTemplate={fn} updateTemplate={fn} deleteTemplate={fn} />));

  it("ToppingsManager dialogs", () =>
    exercise(
      <ToppingsManager
        groups={[]} createGroup={fn} updateGroup={fn} deleteGroup={fn}
        createTopping={fn} updateTopping={fn} deleteTopping={fn}
        categories={[]} products={[]} linkToppingGroup={fn} unlinkToppingGroup={fn}
      />,
    ));

  it("DiscountsUI dialogs", () =>
    exercise(<DiscountsUI discounts={[]} categories={[]} createDiscount={fn} updateDiscount={fn} deleteDiscount={fn} />));

  it("ServiceChargesUI dialogs", () =>
    exercise(<ServiceChargesUI charges={[]} categories={[]} areas={[]} createServiceCharge={fn} updateServiceCharge={fn} deleteServiceCharge={fn} />));

  it("UsersManager dialogs", () => exercise(<UsersManager users={[]} roles={[]} />));

  it("DataTable dialogs", () =>
    exercise(<DataTable data={[]} columns={[{ key: "name", label: "Name" }, { key: "rate", label: "Rate", type: "percent" }]} onCreate={fn} onUpdate={fn} onDelete={fn} />));

  it("GeneralConfigForm submit", () => exercise(<GeneralConfigForm config={null} action={fn as never} />));
});
