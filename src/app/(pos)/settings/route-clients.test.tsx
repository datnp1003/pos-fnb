import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { exerciseUi } from "@/test/interact";

import { ModulesClient } from "./modules/modules-client";
import { CurrenciesManager } from "./currencies/currencies-client";
import { HolidaysUI } from "./holidays/holidays-ui";
import { KaraokePricingManager } from "./karaoke/karaoke-ui";

const fn = vi.fn(async () => undefined);

async function exercise(ui: React.ReactElement) {
  const { container } = renderWithProviders(ui);
  expect(container.firstChild).toBeTruthy();
  await exerciseUi();
}

describe("settings route clients", () => {
  it("ModulesClient", () => exercise(<ModulesClient modules={[]} />));
  it("CurrenciesManager", () => exercise(<CurrenciesManager currencies={[]} />));
  it("HolidaysUI", () => exercise(<HolidaysUI holidays={[]} createHoliday={fn} updateHoliday={fn} deleteHoliday={fn} />));
  it("KaraokePricingManager", () => exercise(<KaraokePricingManager pricings={[]} areas={[]} createKP={fn} updateKP={fn} deleteKP={fn} />));
});
