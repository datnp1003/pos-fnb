import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { renderWithProviders, userEvent } from "@/test/render";
import { getProductRecipe, removeRecipeItem } from "@/server/recipe/actions";
import { ProductsManager } from "./components-products";

vi.mock("@/server/recipe/actions", () => ({
  getProductRecipe: vi.fn(async () => []),
  addRecipeItem: vi.fn(async () => undefined),
  removeRecipeItem: vi.fn(async () => undefined),
}));

const ok = vi.fn(async () => undefined);
const toastMock = vi.mocked(toast);
const getRecipeMock = vi.mocked(getProductRecipe);
const removeRecipeMock = vi.mocked(removeRecipeItem);

const category = { id: "cat-1", name: "Drinks" };
const otherCategory = { id: "cat-2", name: "Food" };
const vat = { id: "vat-1", name: "VAT8", rate: 0.08 };
const exciseTax = { id: "excise-1", name: "Luxury", rate: 0.1 };
const unit = { id: "unit-1", name: "cup" };
const milk = { id: "ingredient-1", name: "Milk", baseUnit: "ml", currentStock: 10 };
const toppingGroup = {
  id: "topping-group-1",
  name: "Extras",
  type: "MULTIPLE",
  _count: { toppings: 2 },
  toppings: [
    { id: "top-1", name: "Milk foam", price: 5000 },
    { id: "top-2", name: "No sugar", price: 0 },
  ],
};
const coffee = {
  id: "product-1",
  name: "Coffee",
  slug: "coffee",
  price: 25000,
  costPrice: 8000,
  categoryId: category.id,
  category,
  vatId: vat.id,
  vat,
  exciseTaxId: null,
  exciseTax: null,
  unitId: unit.id,
  unit,
  isAvailable: true,
  sortOrder: 1,
  toppingGroups: [{ toppingGroup }],
};
const tea = {
  ...coffee,
  id: "product-2",
  name: "Tea",
  slug: "tea",
  categoryId: otherCategory.id,
  category: otherCategory,
  isAvailable: false,
  toppingGroups: [],
};

function renderManager(props: Partial<React.ComponentProps<typeof ProductsManager>> = {}) {
  return renderWithProviders(
    <ProductsManager
      products={props.products ?? [coffee, tea] as never}
      categories={props.categories ?? [category, otherCategory]}
      vats={props.vats ?? [vat]}
      exciseTaxes={props.exciseTaxes ?? [exciseTax]}
      units={props.units ?? [unit]}
      createProduct={props.createProduct ?? ok as never}
      updateProduct={props.updateProduct ?? ok as never}
      deleteProduct={props.deleteProduct ?? ok as never}
      allIngredients={props.allIngredients ?? [milk] as never}
      toppingGroups={props.toppingGroups ?? [toppingGroup] as never}
      linkToppingGroup={props.linkToppingGroup ?? ok as never}
      unlinkToppingGroup={props.unlinkToppingGroup ?? ok as never}
    />,
  );
}

function rowAction(rowText: string, index: number) {
  const row = screen.getByText(rowText).closest("tr") as HTMLTableRowElement;
  return within(row).getAllByRole("button")[index];
}

function saveButton() {
  return screen.getByText("Lưu").closest("button") as HTMLButtonElement;
}

describe("ProductsManager", () => {
  it("renders products and filters by search and category", async () => {
    const user = userEvent.setup();

    renderManager();
    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(screen.getByText("Tea")).toBeInTheDocument();
    expect(screen.getByText("Đang tắt")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Tìm kiếm..."), "cof");
    expect(screen.getByText(/Tìm:/)).toBeInTheDocument();
    expect(screen.queryByText("Tea")).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("Tìm kiếm..."));
    await user.click(screen.getByRole("button", { name: "Food" }));
    expect(screen.getByText(/Lọc:/)).toBeInTheDocument();
    expect(screen.queryByText("Coffee")).not.toBeInTheDocument();
    expect(screen.getByText("Tea")).toBeInTheDocument();
  });

  it("creates, edits, and removes a product", async () => {
    const createProduct = vi.fn(async () => undefined);
    const updateProduct = vi.fn(async () => undefined);
    const deleteProduct = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderManager({ createProduct: createProduct as never, updateProduct: updateProduct as never, deleteProduct: deleteProduct as never });

    await user.click(screen.getByRole("button", { name: /Thêm/ }));
    await user.type(screen.getAllByRole("textbox")[0], "Latte");
    const spinButtons = screen.getAllByRole("spinbutton");
    await user.clear(spinButtons[0]);
    await user.type(spinButtons[0], "45000");
    await user.clear(spinButtons[1]);
    await user.type(spinButtons[1], "15000");
    await user.click(saveButton());
    await waitFor(() => expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({
      name: "Latte",
      slug: "latte",
      price: 45000,
      costPrice: 15000,
      categoryId: "cat-1",
      vatId: "vat-1",
      unitId: "unit-1",
    })));

    await user.click(rowAction("Coffee", 2));
    await user.clear(screen.getAllByRole("textbox")[0]);
    await user.type(screen.getAllByRole("textbox")[0], "Espresso");
    await user.click(saveButton());
    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith("product-1", expect.objectContaining({ name: "Espresso" })));

    await user.click(rowAction("Coffee", 3));
    await waitFor(() => expect(deleteProduct).toHaveBeenCalledWith("product-1"));
  });

  it("handles save errors", async () => {
    const createProduct = vi.fn(async () => { throw new Error("failed"); });
    const user = userEvent.setup();

    renderManager({ createProduct: createProduct as never });
    await user.click(screen.getByRole("button", { name: /Thêm/ }));
    await user.type(screen.getAllByRole("textbox")[0], "Broken");
    await user.click(saveButton());

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });

  it("opens recipe dialog and removes ingredients", async () => {
    getRecipeMock
      .mockResolvedValueOnce([{ id: "recipe-1", ingredient: milk, quantity: 2, unit: null }] as never)
      .mockResolvedValueOnce([] as never);
    const user = userEvent.setup();

    renderManager();
    await user.click(rowAction("Coffee", 1));

    expect(await screen.findByText("Milk")).toBeInTheDocument();
    expect(getRecipeMock).toHaveBeenCalledWith("product-1");

    const dialog = screen.getByRole("dialog");
    const addButton = () => within(dialog).getAllByRole("button").find(button => button.querySelector(".lucide-plus")) as HTMLButtonElement;
    expect(addButton()).toBeDisabled();

    await user.click(within(dialog).getAllByRole("button").find(button => button.className.includes("text-destructive")) as HTMLButtonElement);
    await waitFor(() => expect(removeRecipeMock).toHaveBeenCalledWith("recipe-1"));
  });

  it("links and unlinks topping groups", async () => {
    const linkToppingGroup = vi.fn(async () => undefined);
    const unlinkToppingGroup = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderManager({ linkToppingGroup: linkToppingGroup as never, unlinkToppingGroup: unlinkToppingGroup as never });
    await user.click(rowAction("Tea", 0));
    await user.click(screen.getByText("Extras"));
    await waitFor(() => expect(linkToppingGroup).toHaveBeenCalledWith("product-2", "topping-group-1"));

    await user.click(screen.getByText("Extras"));
    await waitFor(() => expect(unlinkToppingGroup).toHaveBeenCalledWith("product-2", "topping-group-1"));
  });
});
