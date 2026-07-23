import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { renderWithProviders, userEvent } from "@/test/render";
import { ServiceChargesUI } from "./service-charges-ui";

const ok = vi.fn(async () => undefined);
const toastMock = vi.mocked(toast);

const categories = [{ id: "cat-1", name: "Drinks" }];
const areas = [{ id: "area-1", name: "Patio" }];
const baseCharge = {
  id: "charge-1",
  name: "Service",
  type: "PERCENTAGE",
  value: 10,
  scope: "ALL",
  applyCondition: "ALL_DAYS",
  areaId: null,
  area: null,
  categoryIds: null,
  isActive: true,
  startDate: null,
  endDate: null,
  minOrderValue: null,
  minGuestCount: null,
};

function saveButton() {
  return screen.getByText("Lưu").closest("button") as HTMLButtonElement;
}

function renderManager(props: Partial<React.ComponentProps<typeof ServiceChargesUI>> = {}) {
  return renderWithProviders(
    <ServiceChargesUI
      charges={props.charges ?? []}
      categories={props.categories ?? categories}
      areas={props.areas ?? areas}
      createServiceCharge={props.createServiceCharge ?? ok}
      updateServiceCharge={props.updateServiceCharge ?? ok}
      deleteServiceCharge={props.deleteServiceCharge ?? ok}
    />,
  );
}

describe("ServiceChargesUI", () => {
  it("renders empty, fixed, area, category and inactive states", () => {
    const { rerender } = renderManager();

    expect(screen.getByRole("table")).toBeInTheDocument();

    rerender(
      <ServiceChargesUI
        charges={[
          baseCharge,
          { ...baseCharge, id: "charge-2", name: "Fixed", type: "FIXED", value: 5000, scope: "AREA", areaId: "area-1", area: { name: "Patio" }, isActive: false },
          { ...baseCharge, id: "charge-3", name: "Guest", type: "PER_GUEST", value: 2000, scope: "CATEGORY", categoryIds: "[\"cat-1\"]", applyCondition: "GUEST_COUNT", minGuestCount: 4 },
          { ...baseCharge, id: "charge-4", name: "Date", applyCondition: "DATE_RANGE", startDate: new Date("2026-06-01"), endDate: null },
          { ...baseCharge, id: "charge-5", name: "Minimum", applyCondition: "MIN_ORDER", minOrderValue: 100000 },
        ]}
        categories={categories}
        areas={areas}
        createServiceCharge={ok}
        updateServiceCharge={ok}
        deleteServiceCharge={ok}
      />,
    );

    expect(screen.getByText("Service")).toBeInTheDocument();
    expect(screen.getByText("Fixed")).toBeInTheDocument();
    expect(screen.getByText("Guest")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Minimum")).toBeInTheDocument();
    expect(screen.getByText("Drinks")).toBeInTheDocument();
  });

  it("creates a percentage service charge", async () => {
    const createServiceCharge = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderManager({ createServiceCharge });
    await user.click(screen.getAllByRole("button")[0]);
    await user.type(screen.getByRole("textbox"), "Dinner service");
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "12");
    await user.click(saveButton());

    await waitFor(() => expect(createServiceCharge).toHaveBeenCalledWith(expect.objectContaining({
      name: "Dinner service",
      type: "PERCENTAGE",
      value: 12,
      scope: "ALL",
      isActive: true,
    })));
  });

  it("edits, deactivates and deletes a service charge", async () => {
    const updateServiceCharge = vi.fn(async () => undefined);
    const deleteServiceCharge = vi.fn(async () => undefined);
    const user = userEvent.setup();

    renderManager({ charges: [baseCharge], updateServiceCharge, deleteServiceCharge });

    await user.click(screen.getAllByRole("button")[1]);
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Updated service");
    await user.click(screen.getByRole("checkbox"));
    await user.click(saveButton());
    await waitFor(() => expect(updateServiceCharge).toHaveBeenCalledWith("charge-1", expect.objectContaining({
      name: "Updated service",
      isActive: false,
    })));

    await user.click(screen.getAllByRole("button")[2]);
    await waitFor(() => expect(deleteServiceCharge).toHaveBeenCalledWith("charge-1"));
  });

  it("shows an error when submit rejects", async () => {
    const createServiceCharge = vi.fn(async () => { throw new Error("failed"); });
    const user = userEvent.setup();

    renderManager({ createServiceCharge });
    await user.click(screen.getAllByRole("button")[0]);
    await user.type(screen.getByRole("textbox"), "Bad service");
    await user.click(saveButton());

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});
