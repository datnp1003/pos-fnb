import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, userEvent } from "@/test/render";
import { createCurrency, deleteCurrency, updateCurrency } from "@/server/settings/actions";
import { toast } from "sonner";
import { CurrenciesManager } from "./currencies-client";

vi.mock("@/server/settings/actions", () => ({
  createCurrency: vi.fn(),
  deleteCurrency: vi.fn(),
  updateCurrency: vi.fn(),
}));

const createCurrencyMock = vi.mocked(createCurrency);
const updateCurrencyMock = vi.mocked(updateCurrency);
const deleteCurrencyMock = vi.mocked(deleteCurrency);
const toastMock = vi.mocked(toast);

const usd = {
  id: "currency-1",
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  rate: 1,
  isDefault: true,
  sortOrder: 1,
};

describe("CurrenciesManager", () => {
  it("renders the empty currencies state", () => {
    renderWithProviders(<CurrenciesManager currencies={[]} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("renders the default currency", () => {
    renderWithProviders(<CurrenciesManager currencies={[usd]} />);

    const row = screen.getByText("USD").closest("tr");
    expect(row).toBeTruthy();
    expect(within(row as HTMLTableRowElement).getByText("$")).toBeInTheDocument();
    expect(within(row as HTMLTableRowElement).getByText("US Dollar")).toBeInTheDocument();
  });

  it("creates a currency from the dialog", async () => {
    createCurrencyMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderWithProviders(<CurrenciesManager currencies={[]} />);
    await user.click(screen.getAllByRole("button")[0]);

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "brl");
    await user.type(inputs[1], "Brazilian Real");
    await user.type(inputs[2], "R$");
    await user.clear(screen.getByRole("spinbutton"));
    await user.type(screen.getByRole("spinbutton"), "5.25");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getAllByRole("button").at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(createCurrencyMock).toHaveBeenCalledWith({
        code: "BRL",
        name: "Brazilian Real",
        symbol: "R$",
        rate: 5.25,
        isDefault: true,
      });
    });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it("updates an existing currency", async () => {
    updateCurrencyMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderWithProviders(<CurrenciesManager currencies={[usd]} />);
    await user.click(screen.getByText("USD"));
    await user.clear(screen.getByDisplayValue("US Dollar"));
    await user.type(screen.getByDisplayValue(""), "Dollar");
    await user.click(screen.getAllByRole("button").at(-1) as HTMLButtonElement);

    await waitFor(() => {
      expect(updateCurrencyMock).toHaveBeenCalledWith("currency-1", expect.objectContaining({
        code: "USD",
        name: "Dollar",
        isDefault: true,
      }));
    });
  });

  it("shows an error when the save action rejects", async () => {
    createCurrencyMock.mockRejectedValueOnce(new Error("failed"));
    const user = userEvent.setup();

    renderWithProviders(<CurrenciesManager currencies={[]} />);
    await user.click(screen.getAllByRole("button")[0]);
    await user.type(screen.getAllByRole("textbox")[0], "eur");
    await user.type(screen.getAllByRole("textbox")[1], "Euro");
    await user.type(screen.getAllByRole("textbox")[2], "EUR");
    await user.click(screen.getAllByRole("button").at(-1) as HTMLButtonElement);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });

  it("closes the currency dialog without saving", async () => {
    const user = userEvent.setup();

    renderWithProviders(<CurrenciesManager currencies={[]} />);
    await user.click(screen.getAllByRole("button")[0]);
    await user.click(screen.getAllByRole("button").at(-2) as HTMLButtonElement);

    expect(createCurrencyMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("does not delete when confirmation is cancelled", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    const user = userEvent.setup();

    renderWithProviders(<CurrenciesManager currencies={[usd]} />);
    await user.click(screen.getAllByRole("button").at(-1) as HTMLButtonElement);

    expect(deleteCurrencyMock).not.toHaveBeenCalled();
  });

  it("deletes a currency after confirmation", async () => {
    deleteCurrencyMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderWithProviders(<CurrenciesManager currencies={[usd]} />);
    await user.click(screen.getAllByRole("button").at(-1) as HTMLButtonElement);

    await waitFor(() => expect(deleteCurrencyMock).toHaveBeenCalledWith("currency-1"));
  });

  it("shows an error when delete rejects", async () => {
    deleteCurrencyMock.mockRejectedValueOnce(new Error("failed"));
    const user = userEvent.setup();

    renderWithProviders(<CurrenciesManager currencies={[usd]} />);
    await user.click(screen.getAllByRole("button").at(-1) as HTMLButtonElement);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});
