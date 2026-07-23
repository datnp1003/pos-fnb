import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { renderWithProviders, userEvent } from "@/test/render";
import { ToppingsManager } from "./components-toppings";

const ok = vi.fn(async () => undefined);
const toastMock = vi.mocked(toast);

const group = {
  id: "group-1",
  name: "Extras",
  type: "MULTIPLE",
  _count: { toppings: 1 },
  toppings: [{ id: "top-1", name: "Milk", price: 1000, toppingGroupId: "group-1" }],
};

function saveButton() {
  return screen.getByText("Lưu").closest("button") as HTMLButtonElement;
}

function renderManager(props: Partial<React.ComponentProps<typeof ToppingsManager>> = {}) {
  return renderWithProviders(
    <ToppingsManager
      groups={props.groups ?? [group]}
      createGroup={props.createGroup ?? ok as never}
      updateGroup={props.updateGroup ?? ok as never}
      deleteGroup={props.deleteGroup ?? ok as never}
      createTopping={props.createTopping ?? ok as never}
      updateTopping={props.updateTopping ?? ok as never}
      deleteTopping={props.deleteTopping ?? ok as never}
      categories={props.categories ?? [{ id: "cat-1", name: "Drinks" }]}
      products={props.products ?? []}
      linkToppingGroup={props.linkToppingGroup ?? ok as never}
      unlinkToppingGroup={props.unlinkToppingGroup ?? ok as never}
    />,
  );
}

describe("ToppingsManager", () => {
  it("renders an existing topping group", () => {
    renderManager();

    expect(screen.getByText("Extras")).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
  });

  it("creates and edits a topping", async () => {
    const createTopping = vi.fn(async () => undefined);
    const updateTopping = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderManager({ createTopping: createTopping as never, updateTopping: updateTopping as never });

    await user.click(screen.getAllByRole("button")[5]);
    await user.type(screen.getByRole("textbox"), "Cheese");
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "2500");
    await user.click(saveButton());
    await waitFor(() => expect(createTopping).toHaveBeenCalledWith({
      name: "Cheese",
      price: 2500,
      toppingGroupId: "group-1",
      sortOrder: 0,
    }));

    await user.click(screen.getAllByRole("button")[3]);
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Soy milk");
    await user.click(saveButton());
    await waitFor(() => expect(updateTopping).toHaveBeenCalledWith("top-1", expect.objectContaining({ name: "Soy milk" })));
  });

  it("removes a topping and handles rejected actions", async () => {
    const deleteTopping = vi.fn(async () => undefined);
    const deleteGroup = vi.fn(async () => { throw new Error("failed"); });
    const user = userEvent.setup();

    renderManager({ deleteTopping: deleteTopping as never, deleteGroup: deleteGroup as never });

    await user.click(screen.getAllByRole("button")[4]);
    await waitFor(() => expect(deleteTopping).toHaveBeenCalledWith("top-1"));

    await user.click(screen.getAllByRole("button")[2]);
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});
