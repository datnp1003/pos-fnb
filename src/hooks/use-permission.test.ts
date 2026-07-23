import { renderHook } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { describe, expect, it, vi } from "vitest";

import { usePermission } from "./use-permission";

const mockUseSession = vi.mocked(useSession);

function mockSession(permissions: string, scopes: string, status = "authenticated") {
  mockUseSession.mockReturnValue({
    data: { user: { permissions, scopes } },
    status,
    update: vi.fn(),
  } as never);
}

describe("usePermission", () => {
  it("treats unauthenticated sessions as allowed to avoid UI flash", () => {
    mockUseSession.mockReturnValue({ data: null, status: "loading", update: vi.fn() } as never);
    const { result } = renderHook(() => usePermission());
    expect(result.current.canAccessModule("order")).toBe(true);
    expect(result.current.permissions).toEqual([]);
    expect(result.current.scopes).toEqual([]);
    expect(result.current.isAdmin).toBe(false);
  });

  it("grants everything to wildcard permission", () => {
    mockSession(JSON.stringify(["*"]), "[]");
    const { result } = renderHook(() => usePermission());
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.canAccessModule("settings")).toBe(true);
    expect(result.current.canDo("inventory", "delete")).toBe(true);
  });

  it("grants module access from scopes", () => {
    mockSession("[]", JSON.stringify(["order"]));
    const { result } = renderHook(() => usePermission());
    expect(result.current.canAccessModule("order")).toBe(true);
    expect(result.current.canAccessModule("reports")).toBe(false);
  });

  it("infers module access from permissions when scopes empty (legacy)", () => {
    mockSession(JSON.stringify(["inventory:view"]), "[]");
    const { result } = renderHook(() => usePermission());
    expect(result.current.canAccessModule("inventory")).toBe(true);
    expect(result.current.canAccessModule("cash")).toBe(false);
  });

  it("supports dot-separated permission syntax", () => {
    mockSession(JSON.stringify(["reports.view"]), "[]");
    const { result } = renderHook(() => usePermission());
    expect(result.current.canAccessModule("reports")).toBe(true);
    expect(result.current.canDo("reports", "read")).toBe(true);
  });

  it("maps write action to create/edit/delete", () => {
    mockSession(JSON.stringify(["inventory:edit"]), "[]");
    const { result } = renderHook(() => usePermission());
    expect(result.current.canDo("inventory", "write")).toBe(true);
    expect(result.current.canDo("inventory", "delete")).toBe(false);
  });

  it("honors module wildcard action", () => {
    mockSession(JSON.stringify(["order:*"]), "[]");
    const { result } = renderHook(() => usePermission());
    expect(result.current.canDo("order", "create")).toBe(true);
    expect(result.current.canDo("order", "delete")).toBe(true);
    expect(result.current.canDo("settings", "create")).toBe(false);
  });

  it("grants read from scope only when no explicit module permission exists", () => {
    mockSession("[]", JSON.stringify(["reports"]));
    const { result } = renderHook(() => usePermission());
    expect(result.current.canDo("reports", "read")).toBe(true);

    mockSession(JSON.stringify(["reports:edit"]), JSON.stringify(["reports"]));
    const { result: r2 } = renderHook(() => usePermission());
    // Explicit perm exists but is not read → scope fallback must NOT apply.
    expect(r2.current.canDo("reports", "read")).toBe(false);
  });

  it("returns empty arrays on invalid JSON", () => {
    mockSession("not-json", "also-bad");
    const { result } = renderHook(() => usePermission());
    expect(result.current.permissions).toEqual([]);
    expect(result.current.scopes).toEqual([]);
  });
});
