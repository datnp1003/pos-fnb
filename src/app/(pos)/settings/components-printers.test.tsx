import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { renderWithProviders, userEvent } from "@/test/render";
import { PrintersManager } from "./components-printers";

const ok = vi.fn(async () => undefined);
const toastMock = vi.mocked(toast);

const area = { id: "area-1", name: "Kitchen" };
const printer = {
  id: "printer-1",
  name: "Kitchen Printer",
  type: "KITCHEN",
  ipAddress: "192.168.1.10",
  port: 9100,
  paperWidth: 80,
  printMode: "SERVER",
  isActive: true,
  areas: [{ areaId: "area-1", area }],
  printTemplates: [{}],
};

function saveButton() {
  return screen.getByText("Lưu").closest("button") as HTMLButtonElement;
}

function renderManager(props: Partial<React.ComponentProps<typeof PrintersManager>> = {}) {
  return renderWithProviders(
    <PrintersManager
      printers={props.printers ?? [printer]}
      areas={props.areas ?? [area]}
      createPrinter={props.createPrinter ?? ok as never}
      updatePrinter={props.updatePrinter ?? ok as never}
      deletePrinter={props.deletePrinter ?? ok as never}
    />,
  );
}

describe("PrintersManager", () => {
  it("renders the empty state", () => {
    renderManager({ printers: [] });

    expect(screen.queryByText("Kitchen Printer")).not.toBeInTheDocument();
  });

  it("creates a printer with selected areas", async () => {
    const createPrinter = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderManager({ printers: [], createPrinter: createPrinter as never });
    await user.click(screen.getAllByRole("button")[0]);
    await user.type(screen.getAllByRole("textbox")[0], "Bar Printer");
    await user.type(screen.getByPlaceholderText("192.168.1.100"), "10.0.0.2");
    await user.click(screen.getByRole("checkbox"));
    await user.click(saveButton());

    await waitFor(() => expect(createPrinter).toHaveBeenCalledWith(expect.objectContaining({
      name: "Bar Printer",
      ipAddress: "10.0.0.2",
      port: 9100,
      paperWidth: 80,
      areaIds: ["area-1"],
    })));
  });

  it("edits and removes a printer", async () => {
    const updatePrinter = vi.fn(async () => undefined);
    const deletePrinter = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderManager({ updatePrinter: updatePrinter as never, deletePrinter: deletePrinter as never });
    expect(screen.getByText("Kitchen Printer")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button")[1]);
    await user.clear(screen.getAllByRole("textbox")[0]);
    await user.type(screen.getAllByRole("textbox")[0], "Main Printer");
    await user.click(saveButton());
    await waitFor(() => expect(updatePrinter).toHaveBeenCalledWith("printer-1", expect.objectContaining({ name: "Main Printer" })));

    await user.click(screen.getAllByRole("button")[2]);
    await waitFor(() => expect(deletePrinter).toHaveBeenCalledWith("printer-1"));
  });

  it("renders client-mode disabled printers and reports action errors", async () => {
    const deletePrinter = vi.fn(async () => { throw new Error("failed"); });
    const user = userEvent.setup();

    renderManager({
      printers: [{ ...printer, printMode: "CLIENT", isActive: false, printTemplates: [] }],
      deletePrinter: deletePrinter as never,
    });

    await user.click(screen.getAllByRole("button")[2]);
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});
