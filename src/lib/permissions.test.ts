import { beforeEach, describe, expect, it } from "vitest";

import {
  accessibleModules,
  canAccessModule,
  canDo,
  initPermissions,
  parsePermissions,
} from "./permissions";

describe("permission helpers", () => {
  beforeEach(() => {
    initPermissions("[]", "[]");
  });

  it("allows all modules and actions for wildcard permissions", () => {
    initPermissions(JSON.stringify(["*"]), "[]");

    expect(canAccessModule("order")).toBe(true);
    expect(canDo("settings", "delete")).toBe(true);
    expect(accessibleModules()).toEqual([
      "order",
      "dashboard",
      "inventory",
      "cash",
      "reports",
      "settings",
      "kds",
      "karaoke",
    ]);
  });

  it("allows scoped read access when no explicit action exists", () => {
    initPermissions("[]", JSON.stringify(["inventory"]));

    expect(canAccessModule("inventory")).toBe(true);
    expect(canDo("inventory", "read")).toBe(true);
    expect(canDo("inventory", "edit")).toBe(false);
    expect(accessibleModules()).toEqual(["inventory"]);
  });

  it("maps write and read aliases to concrete actions", () => {
    initPermissions(JSON.stringify(["order:create", "reports:view"]), "[]");

    expect(canDo("order", "write")).toBe(true);
    expect(canDo("reports", "read")).toBe(true);
    expect(canDo("order", "delete")).toBe(false);
  });

  it("supports dot wildcard permissions per module", () => {
    initPermissions(JSON.stringify(["cash.*"]), "[]");

    expect(canAccessModule("cash")).toBe(true);
    expect(canDo("cash", "delete")).toBe(true);
    expect(canDo("order", "read")).toBe(false);
  });

  it("does not grant scoped read when explicit module permissions omit read", () => {
    initPermissions(JSON.stringify(["inventory:create"]), JSON.stringify(["inventory"]));

    expect(canAccessModule("inventory")).toBe(true);
    expect(canDo("inventory", "read")).toBe(false);
  });

  it("falls back to empty permissions for invalid JSON", () => {
    initPermissions("not-json", "not-json");

    expect(canAccessModule("order")).toBe(false);
    expect(canDo("order", "read")).toBe(false);
    expect(accessibleModules()).toEqual([]);
  });

  it("parses permissions into a module map", () => {
    const parsed = parsePermissions(JSON.stringify(["order:create", "order.edit", "reports.*"]));

    expect(parsed.order).toEqual(new Set(["create", "edit"]));
    expect(parsed.reports).toEqual(new Set(["*"]));
  });

  it("returns wildcard and invalid parse results", () => {
    expect(parsePermissions(JSON.stringify(["*"]))).toEqual({ "*": new Set(["*"]) });
    expect(parsePermissions("{")).toEqual({});
  });
});
