import { describe, expect, it, vi } from "vitest";

const cookieGetMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: cookieGetMock,
  })),
}));

describe("locale helpers", () => {
  it("reads supported locale from cookies", async () => {
    cookieGetMock.mockReturnValueOnce({ value: "en" });
    const { getLocale } = await import("./locale");

    await expect(getLocale()).resolves.toBe("en");
    expect(cookieGetMock).toHaveBeenCalledWith("pos-locale");
  });

  it("falls back to Vietnamese for unsupported cookie values", async () => {
    cookieGetMock.mockReturnValueOnce({ value: "unsupported" });
    const { getLocale, getServerDictionary } = await import("./locale");

    await expect(getLocale()).resolves.toBe("vi");
    cookieGetMock.mockReturnValueOnce(undefined);
    await expect(getServerDictionary()).resolves.toHaveProperty("common");
  });
});
