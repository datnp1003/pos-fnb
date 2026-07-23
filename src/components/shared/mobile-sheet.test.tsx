import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test/render";
import { MobileSheet } from "./mobile-sheet";

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

describe("MobileSheet (desktop modal)", () => {
  afterEach(() => setWidth(1024));

  it("renders nothing when closed", () => {
    setWidth(1024);
    renderWithProviders(
      <MobileSheet open={false} onClose={vi.fn()} title="Hi">
        <p>body</p>
      </MobileSheet>,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("renders title and children as a centered modal when open", () => {
    setWidth(1024);
    renderWithProviders(
      <MobileSheet open onClose={vi.fn()} title="My Title">
        <p>body</p>
      </MobileSheet>,
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("closes when the backdrop is clicked but not the panel", async () => {
    setWidth(1024);
    const onClose = vi.fn();
    renderWithProviders(
      <MobileSheet open onClose={onClose} title="T">
        <button>inner</button>
      </MobileSheet>,
    );
    await userEvent.click(screen.getByText("inner"));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
