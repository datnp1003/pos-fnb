import { describe, expect, it, vi } from "vitest";
import { revalidatePath, revalidateTag } from "next/cache";

import { prismaMock } from "@/test/prisma-mock";
import {
  createArea,
  createCategory,
  createCurrency,
  createDiscount,
  createHoliday,
  createIngredient,
  createKaraokePricing,
  createPaymentMethod,
  createPrintTemplate,
  createPrinter,
  createProduct,
  createRole,
  createServiceCharge,
  createShift,
  createTable,
  createTopping,
  createToppingGroup,
  createUnit,
  createUser,
  deleteArea,
  deleteCategory,
  deleteCurrency,
  deleteDiscount,
  deleteHoliday,
  deleteIngredient,
  deleteKaraokePricing,
  deletePaymentMethod,
  deletePrinter,
  deleteProduct,
  deleteRole,
  deleteServiceCharge,
  deleteShift,
  deleteTable,
  deleteTopping,
  deleteToppingGroup,
  deleteUnit,
  deleteUser,
  updateUser,
  getAreas,
  getCategories,
  getCurrencies,
  getDefaultCurrency,
  getDiscounts,
  getExciseTaxes,
  getGeneralConfig,
  getHolidays,
  getIngredients,
  getKaraokePricings,
  getPaymentMethods,
  getPrinters,
  getPrinters_list,
  getPrintTemplates,
  getProducts,
  getProductToppingGroups,
  getRoles,
  getServiceCharges,
  getShifts,
  getSystemModules,
  getToppingGroups,
  getUnits,
  getUsers,
  getVats,
  isSystemModuleEnabled,
  linkProductToppingGroup,
  toggleModule,
  unlinkProductToppingGroup,
  updateArea,
  updateCategory,
  updateCurrency,
  updateDiscount,
  updateGeneralConfig,
  updateHoliday,
  updateIngredient,
  updateKaraokePricing,
  updatePaymentMethod,
  updatePrintTemplate,
  updatePrinter,
  updateProduct,
  updateRole,
  updateServiceCharge,
  updateShift,
  updateTable,
  updateTopping,
  updateToppingGroup,
  updateUnit,
  upsertExciseTax,
  upsertVat,
} from "./actions";

vi.mock("bcryptjs", () => ({
  hash: vi.fn(async (pwd: string) => `hashed:${pwd}`),
}));

const revalidatePathMock = vi.mocked(revalidatePath);
const revalidateTagMock = vi.mocked(revalidateTag);

describe("settings server actions", () => {
  it("upserts general config and revalidates settings", async () => {
    await updateGeneralConfig({
      restaurantName: "POS FNB",
      currencyCode: "BRL",
    });

    expect(prismaMock.generalConfig.upsert).toHaveBeenCalledWith({
      where: { id: "default" },
      create: { restaurantName: "POS FNB", currencyCode: "BRL" },
      update: { restaurantName: "POS FNB", currencyCode: "BRL" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings");
  });

  it("queries categories with product counts in display order", async () => {
    prismaMock.category.findMany.mockResolvedValue([{ id: "category-1" }]);

    await expect(getCategories()).resolves.toEqual([{ id: "category-1" }]);
    expect(prismaMock.category.findMany).toHaveBeenCalledWith({
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    });
  });

  it("queries settings collections with expected delegates", async () => {
    prismaMock.generalConfig.findFirst.mockResolvedValue({ id: "default" });
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.role.findMany.mockResolvedValue([]);
    prismaMock.vat.findMany.mockResolvedValue([]);
    prismaMock.exciseTax.findMany.mockResolvedValue([]);
    prismaMock.unit.findMany.mockResolvedValue([]);
    prismaMock.area.findMany.mockResolvedValue([]);
    prismaMock.shift.findMany.mockResolvedValue([]);
    prismaMock.printer.findMany.mockResolvedValue([]);
    prismaMock.paymentMethod.findMany.mockResolvedValue([]);
    prismaMock.systemModule.findMany.mockResolvedValue([]);
    prismaMock.karaokePricing.findMany.mockResolvedValue([]);
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.productToppingGroup.findMany.mockResolvedValue([]);
    prismaMock.ingredient.findMany.mockResolvedValue([]);
    prismaMock.toppingGroup.findMany.mockResolvedValue([]);
    prismaMock.discount.findMany.mockResolvedValue([]);
    prismaMock.serviceCharge.findMany.mockResolvedValue([]);
    prismaMock.printTemplate.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);
    prismaMock.currency.findMany.mockResolvedValue([]);
    prismaMock.currency.findFirst.mockResolvedValue({ id: "currency-1" });

    await expect(getGeneralConfig()).resolves.toEqual({ id: "default" });
    await expect(getUsers()).resolves.toEqual([]);
    await expect(getRoles()).resolves.toEqual([]);
    await expect(getVats()).resolves.toEqual([]);
    await expect(getExciseTaxes()).resolves.toEqual([]);
    await expect(getUnits()).resolves.toEqual([]);
    await expect(getAreas()).resolves.toEqual([]);
    await expect(getShifts()).resolves.toEqual([]);
    await expect(getPrinters()).resolves.toEqual([]);
    await expect(getPrinters_list()).resolves.toEqual([]);
    await expect(getPaymentMethods()).resolves.toEqual([]);
    await expect(getSystemModules()).resolves.toEqual([]);
    await expect(getKaraokePricings()).resolves.toEqual([]);
    await expect(getProducts()).resolves.toEqual([]);
    await expect(getProductToppingGroups("product-1")).resolves.toEqual([]);
    await expect(getIngredients()).resolves.toEqual([]);
    await expect(getToppingGroups()).resolves.toEqual([]);
    await expect(getDiscounts()).resolves.toEqual([]);
    await expect(getServiceCharges()).resolves.toEqual([]);
    await expect(getPrintTemplates()).resolves.toEqual([]);
    await expect(getHolidays()).resolves.toEqual([]);
    await expect(getCurrencies()).resolves.toEqual([]);
    await expect(getDefaultCurrency()).resolves.toEqual({ id: "currency-1" });
  });

  it("runs basic create, update and delete settings CRUD actions", async () => {
    await createRole({ name: "Manager", permissions: "[]" });
    await updateRole("role-1", { name: "Lead" });
    await deleteRole("role-1");
    await createCategory({ name: "Drinks", slug: "drinks" });
    await updateCategory("category-1", { sortOrder: 2 });
    await deleteCategory("category-1");
    await upsertVat("vat-1", { code: "VAT", name: "VAT", rate: 0.1 });
    await upsertExciseTax("excise-1", { code: "EX", name: "Excise", rate: 0.2 });
    await createUnit({ name: "unit" });
    await updateUnit("unit-1", { name: "piece" });
    await deleteUnit("unit-1");
    await createArea({ name: "Main", type: "RESTAURANT" });
    await updateArea("area-1", { name: "Updated" });
    await deleteArea("area-1");
    await createShift({ name: "Morning", startTime: "08:00", endTime: "16:00" });
    await updateShift("shift-1", { endTime: "17:00" });
    await deleteShift("shift-1");
    await createPaymentMethod({ name: "Cash", code: "CASH" });
    await updatePaymentMethod("payment-method-1", { isActive: false });
    await deletePaymentMethod("payment-method-1");
    await createProduct({
      name: "Coffee",
      slug: "coffee",
      price: 10,
      categoryId: "category-1",
      vatId: "vat-1",
      unitId: "unit-1",
    });
    await updateProduct("product-1", { price: 12 });
    await deleteProduct("product-1");
    await linkProductToppingGroup("product-1", "group-1");
    await unlinkProductToppingGroup("product-1", "group-1");
    await createToppingGroup({ name: "Milk", type: "MULTIPLE" });
    await updateToppingGroup("group-1", { name: "Extras" });
    await deleteToppingGroup("group-1");
    await createTopping({ name: "Milk", price: 2, toppingGroupId: "group-1" });
    await updateTopping("topping-1", { price: 3 });
    await deleteTopping("topping-1");
    await updateDiscount("discount-1", { value: 15 });
    await deleteDiscount("discount-1");
    await updateServiceCharge("service-1", { value: 12 });
    await deleteServiceCharge("service-1");
    await deleteIngredient("ingredient-1");

    expect(prismaMock.role.create).toHaveBeenCalledWith({
      data: { name: "Manager", permissions: "[]" },
    });
    expect(prismaMock.category.create).toHaveBeenCalledWith({
      data: { name: "Drinks", slug: "drinks", sortOrder: 0 },
    });
    expect(prismaMock.productToppingGroup.delete).toHaveBeenCalledWith({
      where: { productId_toppingGroupId: { productId: "product-1", toppingGroupId: "group-1" } },
    });
  });

  it("normalizes table numeric fields and nullable karaoke pricing", async () => {
    await createTable({
      name: "T1",
      areaId: "area-1",
      capacity: "6",
      positionX: "10",
      positionY: "20",
      isKaraoke: true,
      karaokePricingId: "",
    });

    expect(prismaMock.table.create).toHaveBeenCalledWith({
      data: {
        name: "T1",
        areaId: "area-1",
        capacity: 6,
        positionX: 10,
        positionY: 20,
        isKaraoke: true,
        karaokePricingId: null,
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings/areas");
  });

  it("updates tables with only provided clean fields", async () => {
    await updateTable("table-1", {
      name: "T2",
      capacity: "8",
      isKaraoke: false,
      karaokePricingId: "",
    });

    expect(prismaMock.table.update).toHaveBeenCalledWith({
      where: { id: "table-1" },
      data: {
        name: "T2",
        capacity: 8,
        isKaraoke: false,
        karaokePricingId: null,
      },
    });

    await deleteTable("table-1");
    expect(prismaMock.table.delete).toHaveBeenCalledWith({ where: { id: "table-1" } });
  });

  it("toggles system modules and revalidates path and tag", async () => {
    prismaMock.systemModule.findUnique.mockResolvedValueOnce({ enabled: true });

    await expect(isSystemModuleEnabled("inventory")).resolves.toBe(true);
    await toggleModule("module-1", false);

    expect(prismaMock.systemModule.update).toHaveBeenCalledWith({
      where: { id: "module-1" },
      data: { enabled: false },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings/modules");
    expect(revalidateTagMock).toHaveBeenCalledWith("system-modules", "max");
  });

  it("calculates ingredient cost per base unit on create and update", async () => {
    await createIngredient({
      name: "Rice",
      purchaseUnit: "kg",
      baseUnit: "g",
      conversionFactor: 1000,
      purchasePrice: 5000,
    });

    expect(prismaMock.ingredient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversionFactor: 1000,
        purchasePrice: 5000,
        costPerBaseUnit: 5,
      }),
    });

    prismaMock.ingredient.findUnique.mockResolvedValue({
      conversionFactor: 1000,
      purchasePrice: 5000,
    });

    await updateIngredient("ingredient-1", { purchasePrice: 6000 });

    expect(prismaMock.ingredient.update).toHaveBeenCalledWith({
      where: { id: "ingredient-1" },
      data: { purchasePrice: 6000, costPerBaseUnit: 6 },
    });
  });

  it("normalizes discount dates and defaults", async () => {
    await createDiscount({
      name: "Lunch",
      type: "PERCENTAGE",
      value: 10,
      startDate: "2026-06-16",
      endDate: "2026-06-30",
    });

    expect(prismaMock.discount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Lunch",
        scope: "ALL",
        startDate: new Date("2026-06-16"),
        endDate: new Date("2026-06-30"),
        isActive: true,
      }),
    });
  });

  it("normalizes service charges, karaoke pricing, holidays and currencies", async () => {
    await createKaraokePricing({
      name: "Night",
      areaId: "area-1",
      startTime: "18:00",
      endTime: "23:00",
      pricePerHour: 100,
    });
    await updateKaraokePricing("karaoke-1", { pricePerHour: 120 });
    await deleteKaraokePricing("karaoke-1");

    await createServiceCharge({
      name: "Service",
      type: "PERCENTAGE",
      value: 10,
      startDate: "2026-06-16",
      endDate: "2026-06-30",
    });

    await createHoliday({ name: "Holiday", date: "2026-06-16" });
    await updateHoliday("holiday-1", { name: "Holiday 2", date: "2026-06-17", recurring: false });
    await deleteHoliday("holiday-1");

    await createCurrency({ code: "BRL", name: "Brazilian Real", symbol: "R$", rate: 1 });
    await updateCurrency("currency-1", { isDefault: true });
    await deleteCurrency("currency-1");

    expect(prismaMock.karaokePricing.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ minHours: 1, dayType: "ALL", timeUnit: "HOUR" }),
    });
    expect(prismaMock.serviceCharge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: "ALL",
        applyCondition: "ALL_DAYS",
        startDate: new Date("2026-06-16"),
        endDate: new Date("2026-06-30"),
        isActive: true,
      }),
    });
    expect(prismaMock.currency.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  });

  it("creates and updates printers with area links", async () => {
    await createPrinter({
      name: "Kitchen",
      type: "KITCHEN",
      ipAddress: "192.168.0.10",
      areaIds: ["area-1", "area-2"],
    });

    await updatePrinter("printer-1", {
      name: "Updated",
      areaIds: ["area-1"],
    });
    await deletePrinter("printer-1");

    expect(prismaMock.printer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        areas: {
          create: [{ areaId: "area-1" }, { areaId: "area-2" }],
        },
      }),
    });
    expect(prismaMock.printerArea.deleteMany).toHaveBeenCalledWith({
      where: { printerId: "printer-1" },
    });
    expect(prismaMock.printerArea.createMany).toHaveBeenCalledWith({
      data: [{ printerId: "printer-1", areaId: "area-1" }],
    });
  });

  it("unsets previous default print templates before creating or updating defaults", async () => {
    prismaMock.printTemplate.findUnique.mockResolvedValue({ type: "BILL" });

    await createPrintTemplate({
      name: "Default bill",
      type: "BILL",
      printerId: "printer-1",
      isDefault: true,
    });
    await updatePrintTemplate("template-1", { isDefault: true });

    expect(prismaMock.printTemplate.updateMany).toHaveBeenNthCalledWith(1, {
      where: { type: "BILL" },
      data: { isDefault: false },
    });
    expect(prismaMock.printTemplate.create).toHaveBeenCalledWith({
      data: {
        name: "Default bill",
        type: "BILL",
        printerId: "printer-1",
        isDefault: true,
        width: 80,
        config: "{}",
      },
    });
    expect(prismaMock.printTemplate.update).toHaveBeenCalledWith({
      where: { id: "template-1" },
      data: { isDefault: true },
    });
  });

  it("creates a user with a hashed password", async () => {
    prismaMock.user.create.mockResolvedValue({ id: "user-1" });

    await createUser({ username: "bob", password: "secret", name: "Bob", roleId: "role-1" });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: { username: "bob", password: "hashed:secret", name: "Bob", roleId: "role-1" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings/users");
  });

  it("updates a user and re-hashes the password when provided", async () => {
    prismaMock.user.update.mockResolvedValue({ id: "user-1" });

    await updateUser("user-1", { name: "Bobby", password: "newpass" });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Bobby", password: "hashed:newpass" },
    });
  });

  it("updates a user without touching the password when none is provided", async () => {
    prismaMock.user.update.mockResolvedValue({ id: "user-1" });

    await updateUser("user-1", { name: "Bobby" });

    const arg = prismaMock.user.update.mock.calls.at(-1)![0] as { data: Record<string, unknown> };
    expect(arg.data).not.toHaveProperty("password");
    expect(arg.data.name).toBe("Bobby");
  });

  it("deletes a user", async () => {
    prismaMock.user.delete.mockResolvedValue({ id: "user-1" });

    await deleteUser("user-1");

    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings/users");
  });
});
