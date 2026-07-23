import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { renderWithProviders, userEvent } from "@/test/render";
import { PrintTemplatesManager } from "./components-templates";

const ok = vi.fn(async () => undefined);
const toastMock = vi.mocked(toast);

const printer = { id: "printer-1", name: "Kitchen" };
const orderConfig = JSON.stringify({
  _version: 2,
  type: "ORDER",
  order: { showSequence: true, showTable: true, showTime: true, showQuantity: true, showTopping: true, showNote: true },
});
const billConfig = JSON.stringify({
  _version: 2,
  type: "BILL",
  bill: {
    header: { showLogo: true, showAddress: true, showPhone: true, showTaxCode: true, showDateTime: true },
    body: { showTable: true, showGuestCount: true, showQuantity: true, showUnitPrice: true, showAmount: true, showTopping: true, showNote: true, showOrderNumber: true },
    footer: { showSubtotal: true, showVat: true, showDiscount: true, showServiceCharge: true, showTotal: true, showPaymentMethod: true, showCashier: true, thankYou: "Thanks" },
  },
});

const orderTemplate = {
  id: "tpl-1",
  name: "Kitchen order",
  type: "ORDER",
  width: 80,
  config: orderConfig,
  isDefault: true,
  printer,
};

function saveTemplateButton() {
  const dialog = screen.getByRole("dialog");
  return Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"))
    .find(button => /Tạo mẫu in|Cập nhật/.test(button.textContent ?? "")) as HTMLButtonElement;
}

function titledButton(title: string, index = 0) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button[title]"))
    .filter(button => button.title.toLowerCase().includes(title))[index];
}

function renderManager(props: Partial<React.ComponentProps<typeof PrintTemplatesManager>> = {}) {
  return renderWithProviders(
    <PrintTemplatesManager
      templates={props.templates ?? []}
      printers={props.printers ?? [printer]}
      createTemplate={props.createTemplate ?? ok as never}
      updateTemplate={props.updateTemplate ?? ok as never}
      deleteTemplate={props.deleteTemplate ?? ok as never}
    />,
  );
}

describe("PrintTemplatesManager", () => {
  it("renders empty state and creates an order template", async () => {
    const createTemplate = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderManager({ createTemplate: createTemplate as never });
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByRole("textbox"), "Kitchen ticket");
    await user.click(saveTemplateButton());

    await waitFor(() => expect(createTemplate).toHaveBeenCalledWith(expect.objectContaining({
      name: "Kitchen ticket",
      type: "ORDER",
      printerId: "printer-1",
      width: 80,
      config: expect.stringContaining("\"_version\":2"),
    })));
  });

  it("renders templates, opens preview and removes a template", async () => {
    const deleteTemplate = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderManager({
      templates: [
        orderTemplate,
        { ...orderTemplate, id: "tpl-2", name: "Bill", type: "BILL", width: 58, config: billConfig, isDefault: false },
        { ...orderTemplate, id: "tpl-3", name: "Invalid", type: "TEMP_BILL", width: 48, config: "not-json", isDefault: false, printer: undefined },
      ],
      deleteTemplate: deleteTemplate as never,
    });

    expect(screen.getByText("Kitchen order")).toBeInTheDocument();
    expect(screen.getByText("Bill")).toBeInTheDocument();
    expect(screen.getByText("Invalid")).toBeInTheDocument();

    await user.click(titledButton("xem"));
    expect(screen.getAllByText("Kitchen order").length).toBeGreaterThan(1);
    await user.keyboard("{Escape}");

    await user.click(titledButton("xoa") ?? titledButton("xoá"));
    await waitFor(() => expect(deleteTemplate).toHaveBeenCalledWith("tpl-1"));
  });

  it("edits a bill template and handles save errors", async () => {
    const updateTemplate = vi.fn(async () => undefined);
    const createTemplate = vi.fn(async () => { throw new Error("failed"); });
    const user = userEvent.setup();

    renderManager({
      templates: [{ ...orderTemplate, type: "BILL", config: billConfig }],
      updateTemplate: updateTemplate as never,
      createTemplate: createTemplate as never,
    });

    await user.click(titledButton("sua") ?? titledButton("sửa"));
    await user.clear(screen.getAllByRole("textbox")[0]);
    await user.type(screen.getAllByRole("textbox")[0], "Updated bill");
    await user.click(saveTemplateButton());
    await waitFor(() => expect(updateTemplate).toHaveBeenCalledWith("tpl-1", expect.objectContaining({ name: "Updated bill" })));

    await user.click(screen.getAllByRole("button")[0]);
    await user.type(screen.getByRole("textbox"), "Broken");
    await user.click(saveTemplateButton());
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});
