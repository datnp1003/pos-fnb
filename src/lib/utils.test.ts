import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("merges conditional class names", () => {
    expect(cn("px-2", false && "hidden", ["text-sm", "font-bold"])).toBe(
      "px-2 text-sm font-bold",
    );
  });

  it("uses tailwind-merge conflict resolution", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});
