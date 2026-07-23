import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, userEvent } from "@/test/render";
import { toast } from "sonner";
import { AreasManager } from "./components-areas";

const noop = vi.fn(async () => undefined);
const toastMock = vi.mocked(toast);

const area = {
  id: "area-1",
  name: "Main",
  type: "RESTAURANT",
  sortOrder: 1,
  _count: { tables: 1 },
  tables: [{ id: "table-1", name: "T1", capacity: 4, isKaraoke: false }],
};

function saveButton() {
  return screen.getByText("Lưu").closest("button") as HTMLButtonElement;
}

function AM(props: Partial<React.ComponentProps<typeof AreasManager>> = {}) {
  return (
    <AreasManager
      areas={props.areas ?? []}
      createArea={noop}
      updateArea={noop}
      deleteArea={noop}
      createTable={noop}
      updateTable={noop}
      deleteTable={noop}
    />
  );
}

describe("AreasManager", () => {
  it("renders with no areas", () => {
    const { container } = renderWithProviders(<AM />);
    expect(container.firstChild).toBeTruthy();
  });

  it("creates an area", async () => {
    const createArea = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderWithProviders(<AreasManager areas={[]} createArea={createArea as never} updateArea={noop} deleteArea={noop} createTable={noop} updateTable={noop} deleteTable={noop} />);
    await user.click(screen.getAllByRole("button")[0]);
    await user.type(screen.getByRole("textbox"), "Patio");
    await user.click(saveButton());

    await waitFor(() => expect(createArea).toHaveBeenCalledWith({
      name: "Patio",
      type: "RESTAURANT",
      sortOrder: 0,
    }));
  });

  it("edits and deletes an area", async () => {
    const updateArea = vi.fn(async () => undefined);
    const deleteArea = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderWithProviders(<AreasManager areas={[area]} createArea={noop} updateArea={updateArea as never} deleteArea={deleteArea as never} createTable={noop} updateTable={noop} deleteTable={noop} />);
    expect(screen.getByText("Main")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button")[1]);
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Garden");
    await user.click(saveButton());
    await waitFor(() => expect(updateArea).toHaveBeenCalledWith("area-1", expect.objectContaining({ name: "Garden" })));

    await user.click(screen.getAllByRole("button")[2]);
    await waitFor(() => expect(deleteArea).toHaveBeenCalledWith("area-1"));
  });

  it("creates and edits tables", async () => {
    const createTable = vi.fn(async () => undefined);
    const updateTable = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderWithProviders(<AreasManager areas={[area]} createArea={noop} updateArea={noop} deleteArea={noop} createTable={createTable as never} updateTable={updateTable as never} deleteTable={noop} />);

    await user.click(screen.getAllByRole("button")[5]);
    await user.type(screen.getByRole("textbox"), "T2");
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "6");
    await user.click(saveButton());
    await waitFor(() => expect(createTable).toHaveBeenCalledWith(expect.objectContaining({ name: "T2", areaId: "area-1", capacity: "6" })));

    await user.click(screen.getAllByRole("button")[3]);
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "T1A");
    await user.click(saveButton());
    await waitFor(() => expect(updateTable).toHaveBeenCalledWith("table-1", expect.objectContaining({ name: "T1A" })));
  });

  it("shows an error when an action rejects", async () => {
    const createArea = vi.fn(async () => { throw new Error("failed"); });
    const user = userEvent.setup();

    renderWithProviders(<AreasManager areas={[]} createArea={createArea as never} updateArea={noop} deleteArea={noop} createTable={noop} updateTable={noop} deleteTable={noop} />);
    await user.click(screen.getAllByRole("button")[0]);
    await user.type(screen.getByRole("textbox"), "Patio");
    await user.click(saveButton());

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});
