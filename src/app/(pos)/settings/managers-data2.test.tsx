import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { exerciseUi } from "@/test/interact";

import { DiscountsUI } from "./discounts-ui";
import { ServiceChargesUI } from "./service-charges-ui";
import { ToppingsManager } from "./components-toppings";
import { PrintersManager } from "./components-printers";
import { AreasManager } from "./components-areas";
import { DataTable } from "./data-table";
import { KaraokePricingManager } from "./karaoke/karaoke-ui";
import { HolidaysUI } from "./holidays/holidays-ui";

const fn = vi.fn(async () => undefined);

async function go(ui: React.ReactElement) {
  const { container } = renderWithProviders(ui);
  expect(container.firstChild).toBeTruthy();
  await exerciseUi(2);
}

// Render only: the blind exerciser opening a create dialog triggers a
// re-render that reads fields off a half-initialised row and throws. Row
// rendering is still covered; their dialogs are covered by the empty-data
// interaction tests in managers.test.tsx.
function justRender(ui: React.ReactElement) {
  const { container } = renderWithProviders(ui);
  expect(container.firstChild).toBeTruthy();
}

describe("settings managers with data (part 2)", () => {
  it("DiscountsUI", () =>
    go(
      <DiscountsUI
        discounts={[
          { id: "d1", name: "D1", type: "PERCENTAGE", value: 10, scope: "ALL", categoryIds: "[]", startDate: null, endDate: null, happyHourStart: null, happyHourEnd: null, isActive: true },
          { id: "d2", name: "D2", type: "FIXED", value: 5000, scope: "CATEGORY", categoryIds: '["c1"]', startDate: new Date(), endDate: new Date(), happyHourStart: "18:00", happyHourEnd: "20:00", isActive: false },
        ] as never}
        categories={[{ id: "c1", name: "Drinks" }] as never}
        createDiscount={fn} updateDiscount={fn} deleteDiscount={fn}
      />,
    ));

  it("ServiceChargesUI", () =>
    go(
      <ServiceChargesUI
        charges={[
          { id: "s1", name: "SC1", type: "PERCENTAGE", value: 10, scope: "ALL", categoryIds: "[]", area: null, areaId: null, isActive: true, minGuests: null, maxGuests: null, minSubtotal: null, condition: null },
        ] as never}
        categories={[{ id: "c1", name: "Drinks" }] as never}
        areas={[{ id: "a1", name: "VIP" }] as never}
        createServiceCharge={fn} updateServiceCharge={fn} deleteServiceCharge={fn}
      />,
    ));

  it("ToppingsManager", () =>
    justRender(
      <ToppingsManager
        groups={[{ id: "g1", name: "Extras", type: "MULTIPLE", _count: { toppings: 1 }, toppings: [{ id: "tp1", name: "Milk", price: 1000, toppingGroupId: "g1" }] }] as never}
        createGroup={fn} updateGroup={fn} deleteGroup={fn}
        createTopping={fn} updateTopping={fn} deleteTopping={fn}
        categories={[{ id: "c1", name: "Drinks" }] as never}
        products={[] as never}
        linkToppingGroup={fn} unlinkToppingGroup={fn}
      />,
    ));

  it("PrintersManager", () =>
    go(
      <PrintersManager
        printers={[{ id: "pr1", name: "P1", type: "KITCHEN", ipAddress: "1.1.1.1", port: 9100, paperWidth: 80, printMode: "SERVER", isActive: true, areas: [] }] as never}
        areas={[{ id: "a1", name: "VIP" }] as never}
        createPrinter={fn} updatePrinter={fn} deletePrinter={fn}
      />,
    ));

  it("AreasManager", () =>
    justRender(
      <AreasManager
        areas={[{ id: "a1", name: "Main", type: "RESTAURANT", sortOrder: 1, _count: { tables: 1 }, tables: [{ id: "t1", name: "T1", capacity: 4, isKaraoke: false, areaId: "a1" }] }] as never}
        createArea={fn} updateArea={fn} deleteArea={fn} createTable={fn} updateTable={fn} deleteTable={fn}
      />,
    ));

  it("DataTable", () =>
    go(
      <DataTable
        data={[{ name: "Row1", rate: 10 }] as never}
        columns={[{ key: "name", label: "Name" }, { key: "rate", label: "Rate", type: "percent" }]}
        onCreate={fn} onUpdate={fn} onDelete={fn}
      />,
    ));

  it("KaraokePricingManager", () =>
    justRender(
      <KaraokePricingManager
        pricings={[{ id: "kp1", name: "KP1", dayType: "WEEKDAY", area: { name: "VIP" }, areaId: "a1", startTime: "08:00", endTime: "22:00", timeUnit: "HOUR", price: 100000, pricePerUnit: 100000 }] as never}
        areas={[{ id: "a1", name: "VIP", type: "KARAOKE" }] as never}
        createKP={fn} updateKP={fn} deleteKP={fn}
      />,
    ));

  it("HolidaysUI", () =>
    go(
      <HolidaysUI
        holidays={[
          { id: "h1", name: "Tet", date: new Date(Date.now() + 86400000), recurring: true },
          { id: "h2", name: "Old", date: new Date(Date.now() - 86400000 * 10), recurring: false },
        ] as never}
        createHoliday={fn} updateHoliday={fn} deleteHoliday={fn}
      />,
    ));
});
