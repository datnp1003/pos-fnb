import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, userEvent } from "@/test/render";
import { toggleModule } from "@/server/settings/actions";
import { toast } from "sonner";
import { ModulesClient } from "./modules-client";

vi.mock("@/server/settings/actions", () => ({
  toggleModule: vi.fn(),
}));

const toggleModuleMock = vi.mocked(toggleModule);
const toastMock = vi.mocked(toast);

function moduleFixture(enabled = false) {
  return {
    id: "module-1",
    name: "inventory",
    enabled,
    config: null,
    updatedAt: new Date("2026-06-17T00:00:00Z"),
  };
}

describe("ModulesClient", () => {
  it("renders with no modules", () => {
    const { container } = renderWithProviders(<ModulesClient modules={[]} />);

    expect(container.firstChild).toBeTruthy();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("renders a module without a known description", () => {
    renderWithProviders(<ModulesClient modules={[{ ...moduleFixture(false), name: "custom" }]} />);

    expect(screen.getByText("custom")).toBeInTheDocument();
  });

  it("toggles a disabled module and reports success", async () => {
    toggleModuleMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderWithProviders(<ModulesClient modules={[moduleFixture(false)]} />);
    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(toggleModuleMock).toHaveBeenCalledWith("module-1", true));
    expect(toastMock.success).toHaveBeenCalled();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("rolls back an enabled module when the action rejects", async () => {
    toggleModuleMock.mockRejectedValueOnce(new Error("failed"));
    const user = userEvent.setup();

    renderWithProviders(<ModulesClient modules={[moduleFixture(true)]} />);
    await user.click(screen.getByRole("switch"));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
    expect(toggleModuleMock).toHaveBeenCalledWith("module-1", false);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });
});
