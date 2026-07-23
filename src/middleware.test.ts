import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    auth: (handler: (req: unknown) => Response) => handler,
  })),
}));

vi.mock("./lib/auth.config", () => ({
  default: {},
}));

import middleware from "./middleware";

function request(pathname: string, user?: { permissions?: string; scopes?: string }) {
  const url = `https://pos.test${pathname}`;
  return {
    auth: user ? { user } : null,
    nextUrl: new URL(url),
    url,
  };
}

function locationOf(response: Response) {
  return response.headers.get("location");
}

function runMiddleware(pathname: string, user?: { permissions?: string; scopes?: string }) {
  return middleware(request(pathname, user) as never, {} as never) as Response;
}

describe("middleware", () => {
  it("allows public routes without authentication", () => {
    const response = runMiddleware("/login");

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects unauthenticated users to login", () => {
    const response = runMiddleware("/order");

    expect(locationOf(response)).toBe("https://pos.test/login");
  });

  it("allows wildcard permissions", () => {
    const response = runMiddleware("/settings", { permissions: "[\"*\"]", scopes: "[]" });

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows module scopes and redirects blocked modules to the first allowed scope", () => {
    const allowed = runMiddleware("/inventory/items", { permissions: "[]", scopes: "[\"inventory\"]" });
    const blocked = runMiddleware("/reports", { permissions: "[]", scopes: "[\"inventory\"]" });

    expect(allowed.headers.get("x-middleware-next")).toBe("1");
    expect(locationOf(blocked)).toBe("https://pos.test/inventory");
  });

  it("falls back to order when the authenticated user has no module scopes", () => {
    const response = runMiddleware("/cash", { permissions: "not-json", scopes: "not-json" });

    expect(locationOf(response)).toBe("https://pos.test/order");
  });
});
