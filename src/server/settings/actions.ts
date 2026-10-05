"use server";

import { db } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/server-auth";
import { revalidatePath, revalidateTag } from "next/cache";

// ============ General Config ============
export async function getGeneralConfig() {
  return db.generalConfig.findFirst({ where: { id: "default" } });
}

export async function updateGeneralConfig(data: {
  restaurantName: string;
  address?: string;
  phone?: string;
  email?: string;
  taxCode?: string;
  taxMode?: string;
  logoUrl?: string;
  qrBankCode?: string;
  qrAccountNumber?: string;
  qrAccountName?: string;
  currencyCode?: string;
}) {
  await db.generalConfig.upsert({
    where: { id: "default" },
    create: { ...data },
    update: data,
  });
  revalidatePath("/settings");
}

// ============ Users ============
export async function getUsers() {
  return db.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRoles() {
  return db.role.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createUser(data: {
  username: string;
  password: string;
  name: string;
  roleId: string;
}) {
  const { hash } = await import("bcryptjs");
  const hashed = await hash(data.password, 12);
  await db.user.create({ data: { ...data, password: hashed } });
  revalidatePath("/settings/users");
}

export async function updateUser(id: string, data: {
  name?: string;
  roleId?: string;
  password?: string;
}) {
  const update: any = { ...data };
  if (data.password) {
    const { hash } = await import("bcryptjs");
    update.password = await hash(data.password, 12);
  } else delete update.password;
  await db.user.update({ where: { id }, data: update });
  revalidatePath("/settings/users");
}

export async function deleteUser(id: string) {
  await db.user.delete({ where: { id } });
  revalidatePath("/settings/users");
}

// ============ Roles ============
export async function createRole(data: { name: string; permissions: string }) {
  await db.role.create({ data });
  revalidatePath("/settings/users");
}

export async function updateRole(id: string, data: { name?: string; permissions?: string; scopes?: string }) {
  await db.role.update({ where: { id }, data });
  revalidatePath("/settings/users");
}

export async function deleteRole(id: string) {
  await db.role.delete({ where: { id } });
  revalidatePath("/settings/users");
}

// ============ Categories ============
export async function getCategories() {
  return db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCategory(data: { name: string; slug: string; sortOrder?: number; imageUrl?: string }) {
  await db.category.create({ data: { ...data, sortOrder: data.sortOrder ?? 0 } });
  revalidatePath("/settings/categories");
}

export async function updateCategory(id: string, data: { name?: string; slug?: string; sortOrder?: number }) {
  await db.category.update({ where: { id }, data });
  revalidatePath("/settings/categories");
}

export async function deleteCategory(id: string) {
  await db.category.delete({ where: { id } });
  revalidatePath("/settings/categories");
}

// ============ VAT ============
export async function getVats() {
  return db.vat.findMany({ orderBy: { createdAt: "asc" } });
}

export async function upsertVat(id: string, data: { code: string; name: string; rate: number }) {
  await db.vat.update({ where: { id }, data });
  revalidatePath("/settings/vat");
}

// ============ Excise Tax ============
export async function getExciseTaxes() {
  return db.exciseTax.findMany({ orderBy: { createdAt: "asc" } });
}

export async function upsertExciseTax(id: string, data: { code: string; name: string; rate: number }) {
  await db.exciseTax.update({ where: { id }, data });
  revalidatePath("/settings/excise-tax");
}

// ============ Units ============
export async function getUnits() {
  return db.unit.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createUnit(data: { name: string }) {
  await db.unit.create({ data });
  revalidatePath("/settings/units");
}

export async function updateUnit(id: string, data: { name: string }) {
  await db.unit.update({ where: { id }, data });
  revalidatePath("/settings/units");
}

export async function deleteUnit(id: string) {
  await db.unit.delete({ where: { id } });
  revalidatePath("/settings/units");
}

// ============ Areas ============
export async function getAreas() {
  return db.area.findMany({
    include: {
      tables: { orderBy: { name: "asc" } },
      _count: { select: { tables: true } },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createArea(data: { name: string; type: string; sortOrder?: number }) {
  await db.area.create({ data: { ...data, sortOrder: data.sortOrder ?? 0 } });
  revalidatePath("/settings/areas");
}

export async function updateArea(id: string, data: { name?: string; type?: string; sortOrder?: number }) {
  await db.area.update({ where: { id }, data });
  revalidatePath("/settings/areas");
}

export async function deleteArea(id: string) {
  await db.area.delete({ where: { id } });
  revalidatePath("/settings/areas");
}

// ============ Tables ============
export async function createTable(data: {
  name: string;
  areaId: string;
  capacity?: number | string;
  positionX?: number | string;
  positionY?: number | string;
  isKaraoke?: boolean;
  karaokePricingId?: string | null;
}) {
  await db.table.create({
    data: {
      name: data.name,
      areaId: data.areaId,
      capacity: Number(data.capacity ?? 4),
      positionX: Number(data.positionX ?? 0),
      positionY: Number(data.positionY ?? 0),
      isKaraoke: data.isKaraoke ?? false,
      karaokePricingId: data.karaokePricingId || null,
    },
  });
  revalidatePath("/settings/areas");
}

export async function updateTable(id: string, data: {
  name?: string;
  capacity?: number | string;
  positionX?: number | string;
  positionY?: number | string;
  isKaraoke?: boolean;
  karaokePricingId?: string | null;
}) {
  const clean: Record<string, any> = {};
  if (data.name !== undefined) clean.name = data.name;
  if (data.capacity !== undefined) clean.capacity = Number(data.capacity);
  if (data.positionX !== undefined) clean.positionX = Number(data.positionX);
  if (data.positionY !== undefined) clean.positionY = Number(data.positionY);
  if (data.isKaraoke !== undefined) clean.isKaraoke = data.isKaraoke;
  if (data.karaokePricingId !== undefined) clean.karaokePricingId = data.karaokePricingId || null;
  await db.table.update({ where: { id }, data: clean });
  revalidatePath("/settings/areas");
}

export async function deleteTable(id: string) {
  await db.table.delete({ where: { id } });
  revalidatePath("/settings/areas");
}

// ============ Shifts ============
export async function getShifts() {
  return db.shift.findMany({
    include: { _count: { select: { assignments: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createShift(data: { name: string; startTime: string; endTime: string }) {
  await db.shift.create({ data });
  revalidatePath("/settings/shifts");
}

export async function updateShift(id: string, data: { name?: string; startTime?: string; endTime?: string }) {
  await db.shift.update({ where: { id }, data });
  revalidatePath("/settings/shifts");
}

export async function deleteShift(id: string) {
  await db.shift.delete({ where: { id } });
  revalidatePath("/settings/shifts");
}

// ============ Printers ============
export async function getPrinters() {
  return db.printer.findMany({
    include: { areas: { include: { area: true } }, printTemplates: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getPrinters_list() {
  return db.printer.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createPrinter(data: {
  name: string;
  type: string;
  ipAddress: string;
  port?: number;
  paperWidth?: number;
  areaIds?: string[];
}) {
  const { areaIds, ...printerData } = data;
  await db.printer.create({
    data: {
      ...printerData,
      areas: areaIds ? {
        create: areaIds.map(areaId => ({ areaId })),
      } : undefined,
    },
  });
  revalidatePath("/settings/printers");
}

export async function updatePrinter(id: string, data: {
  name?: string;
  type?: string;
  ipAddress?: string;
  port?: number;
  paperWidth?: number;
  isActive?: boolean;
  areaIds?: string[];
}) {
  const { areaIds, ...printerData } = data;
  if (areaIds) {
    await db.printerArea.deleteMany({ where: { printerId: id } });
    await db.printerArea.createMany({ data: areaIds.map(areaId => ({ printerId: id, areaId })) });
  }
  await db.printer.update({ where: { id }, data: printerData });
  revalidatePath("/settings/printers");
}

export async function deletePrinter(id: string) {
  await db.printer.delete({ where: { id } });
  revalidatePath("/settings/printers");
}

// ============ Payment Methods ============
export async function getPaymentMethods() {
  return db.paymentMethod.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createPaymentMethod(data: { name: string; code: string; sortOrder?: number }) {
  await db.paymentMethod.create({ data: { ...data, sortOrder: data.sortOrder ?? 0 } });
  revalidatePath("/settings/payment-methods");
}

export async function updatePaymentMethod(id: string, data: { name?: string; isActive?: boolean }) {
  await db.paymentMethod.update({ where: { id }, data });
  revalidatePath("/settings/payment-methods");
}

export async function deletePaymentMethod(id: string) {
  await db.paymentMethod.delete({ where: { id } });
  revalidatePath("/settings/payment-methods");
}

// ============ System Modules ============
export async function getSystemModules() {
  return db.systemModule.findMany();
}

export async function isSystemModuleEnabled(name: string) {
  const module = await db.systemModule.findUnique({ where: { name } });
  return module?.enabled ?? false;
}

export async function toggleModule(id: string, enabled: boolean) {
  await db.systemModule.update({ where: { id }, data: { enabled } });
  revalidatePath("/settings/modules");
  revalidateTag("system-modules", "max");
}

// ============ Karaoke Pricing ============
export async function getKaraokePricings() {
  return db.karaokePricing.findMany({
    include: { area: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAreas_list() {
  return db.area.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function createKaraokePricing(data: {
  name: string;
  areaId: string;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  minHours?: number;
  dayType?: string;
  timeUnit?: string;
}) {
  await db.karaokePricing.create({ data: { ...data, minHours: data.minHours ?? 1, dayType: data.dayType ?? "ALL", timeUnit: data.timeUnit ?? "HOUR" } });
  revalidatePath("/settings/karaoke");
}

export async function updateKaraokePricing(id: string, data: any) {
  await db.karaokePricing.update({ where: { id }, data });
  revalidatePath("/settings/karaoke");
}

export async function deleteKaraokePricing(id: string) {
  await db.karaokePricing.delete({ where: { id } });
  revalidatePath("/settings/karaoke");
}

// ============ Products (basic list) ============
export async function getProducts() {
  return db.product.findMany({
    include: {
      category: true, vat: true, exciseTax: true, unit: true,
      toppingGroups: { include: { toppingGroup: { include: { toppings: true } } } },
    },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });
}

export async function createProduct(data: {
  name: string;
  slug: string;
  price: number;
  costPrice?: number;
  categoryId: string;
  vatId: string;
  exciseTaxId?: string;
  unitId: string;
  isAvailable?: boolean;
  sortOrder?: number;
}) {
  await db.product.create({ data: { ...data, costPrice: data.costPrice ?? 0, sortOrder: data.sortOrder ?? 0 } });
  revalidatePath("/settings/products");
}

export async function updateProduct(id: string, data: any) {
  await db.product.update({ where: { id }, data });
  revalidatePath("/settings/products");
}

export async function deleteProduct(id: string) {
  await db.product.delete({ where: { id } });
  revalidatePath("/settings/products");
}

// ============ Product-Topping Linking ============

export async function getProductToppingGroups(productId: string) {
  return db.productToppingGroup.findMany({
    where: { productId },
    include: { toppingGroup: true },
  });
}

export async function linkProductToppingGroup(productId: string, toppingGroupId: string) {
  await db.productToppingGroup.create({ data: { productId, toppingGroupId } });
  revalidatePath("/settings/products");
}

export async function unlinkProductToppingGroup(productId: string, toppingGroupId: string) {
  await db.productToppingGroup.delete({
    where: { productId_toppingGroupId: { productId, toppingGroupId } },
  });
  revalidatePath("/settings/products");
}

// ============ Ingredients ============
export async function getIngredients() {
  return db.ingredient.findMany({ orderBy: { name: "asc" } });
}

export async function createIngredient(data: {
  name: string;
  purchaseUnit: string;
  baseUnit: string;
  conversionFactor?: number;
  purchasePrice?: number;
  costPerBaseUnit?: number;
  minStock?: number;
  supplier?: string;
}) {
  const factor = data.conversionFactor ?? 1;
  const price = data.purchasePrice ?? 0;
  await db.ingredient.create({
    data: {
      ...data,
      conversionFactor: factor,
      purchasePrice: price,
      costPerBaseUnit: factor > 0 ? price / factor : 0,
    },
  });
  revalidatePath("/settings/ingredients");
}

export async function updateIngredient(id: string, data: any) {
  if (data.purchasePrice !== undefined || data.conversionFactor !== undefined) {
    const item = await db.ingredient.findUnique({ where: { id } });
    if (item) {
      const factor = data.conversionFactor ?? item.conversionFactor;
      const price = data.purchasePrice ?? item.purchasePrice;
      data.costPerBaseUnit = factor > 0 ? price / factor : 0;
    }
  }
  await db.ingredient.update({ where: { id }, data });
  revalidatePath("/settings/ingredients");
}

export async function deleteIngredient(id: string) {
  await db.ingredient.delete({ where: { id } });
  revalidatePath("/settings/ingredients");
}

// ============ Toppings ============
export async function getToppingGroups() {
  return db.toppingGroup.findMany({
    include: { toppings: { orderBy: { sortOrder: "asc" } }, _count: { select: { toppings: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createToppingGroup(data: { name: string; type: string }) {
  await db.toppingGroup.create({ data });
  revalidatePath("/settings/toppings");
}

export async function updateToppingGroup(id: string, data: { name?: string; type?: string }) {
  await db.toppingGroup.update({ where: { id }, data });
  revalidatePath("/settings/toppings");
}

export async function deleteToppingGroup(id: string) {
  await db.toppingGroup.delete({ where: { id } });
  revalidatePath("/settings/toppings");
}

export async function createTopping(data: { name: string; price: number; toppingGroupId: string; sortOrder?: number }) {
  await db.topping.create({ data: { ...data, sortOrder: data.sortOrder ?? 0 } });
  revalidatePath("/settings/toppings");
}

export async function updateTopping(id: string, data: { name?: string; price?: number }) {
  await db.topping.update({ where: { id }, data });
  revalidatePath("/settings/toppings");
}

export async function deleteTopping(id: string) {
  await db.topping.delete({ where: { id } });
  revalidatePath("/settings/toppings");
}

// ============ Discounts ============
export async function getDiscounts() {
  return db.discount.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createDiscount(data: {
  name: string;
  type: string;
  value: number;
  scope?: string;
  startDate?: string;
  endDate?: string;
  happyHourStart?: string;
  happyHourEnd?: string;
  minOrderValue?: number;
  dayOfWeek?: string;
  categoryIds?: string;
  isActive?: boolean;
}) {
  await db.discount.create({
    data: {
      name: data.name,
      type: data.type,
      value: data.value,
      scope: data.scope ?? "ALL",
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      happyHourStart: data.happyHourStart || null,
      happyHourEnd: data.happyHourEnd || null,
      minOrderValue: data.minOrderValue || null,
      dayOfWeek: data.dayOfWeek || null,
      categoryIds: data.categoryIds || null,
      isActive: data.isActive ?? true,
    },
  });
  revalidatePath("/settings/discounts");
}

export async function updateDiscount(id: string, data: any) {
  await db.discount.update({ where: { id }, data });
  revalidatePath("/settings/discounts");
}

export async function deleteDiscount(id: string) {
  await db.discount.delete({ where: { id } });
  revalidatePath("/settings/discounts");
}

// ============ Service Charges ============
export async function getServiceCharges() {
  return db.serviceCharge.findMany({
    include: { area: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function createServiceCharge(data: {
  name: string;
  type: string;
  value: number;
  scope?: string;
  applyCondition?: string;
  areaId?: string;
  categoryIds?: string;
  startDate?: string;
  endDate?: string;
  minOrderValue?: number;
  minGuestCount?: number;
  isActive?: boolean;
}) {
  await db.serviceCharge.create({
    data: {
      name: data.name,
      type: data.type,
      value: data.value,
      scope: data.scope ?? "ALL",
      applyCondition: data.applyCondition || "ALL_DAYS",
      areaId: data.areaId || null,
      categoryIds: data.categoryIds || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      minOrderValue: data.minOrderValue || null,
      minGuestCount: data.minGuestCount || null,
      isActive: data.isActive ?? true,
    },
  });
  revalidatePath("/settings/service-charges");
}

export async function updateServiceCharge(id: string, data: any) {
  await db.serviceCharge.update({ where: { id }, data });
  revalidatePath("/settings/service-charges");
}

export async function deleteServiceCharge(id: string) {
  await db.serviceCharge.delete({ where: { id } });
  revalidatePath("/settings/service-charges");
}

// ============ Print Templates ============
export async function getPrintTemplates() {
  return db.printTemplate.findMany({
    include: { printer: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createPrintTemplate(data: {
  name: string;
  type: string;
  printerId: string;
  width?: number;
  config?: string;
  isDefault?: boolean;
}) {
  if (data.isDefault) {
    await db.printTemplate.updateMany({ where: { type: data.type }, data: { isDefault: false } });
  }
  await db.printTemplate.create({
    data: { ...data, width: data.width ?? 80, config: data.config ?? "{}", isDefault: data.isDefault ?? false },
  });
  revalidatePath("/settings/print-templates");
}

export async function updatePrintTemplate(id: string, data: any) {
  if (data.isDefault) {
    const tpl = await db.printTemplate.findUnique({ where: { id } });
    if (tpl) await db.printTemplate.updateMany({ where: { type: tpl.type }, data: { isDefault: false } });
  }
  await db.printTemplate.update({ where: { id }, data });
  revalidatePath("/settings/print-templates");
}

export async function deletePrintTemplate(id: string) {
  await db.printTemplate.delete({ where: { id } });
  revalidatePath("/settings/print-templates");
}

// ============ Holidays ============
export async function getHolidays() {
  return db.holiday.findMany({ orderBy: { date: "asc" } });
}

export async function createHoliday(data: { name: string; date: string; recurring?: boolean }) {
  await db.holiday.create({
    data: { name: data.name, date: new Date(data.date), recurring: data.recurring ?? true },
  });
  revalidatePath("/settings/holidays");
}

export async function updateHoliday(id: string, data: { name: string; date: string; recurring?: boolean }) {
  await db.holiday.update({
    where: { id },
    data: { name: data.name, date: new Date(data.date), recurring: data.recurring ?? true },
  });
  revalidatePath("/settings/holidays");
}

export async function deleteHoliday(id: string) {
  await db.holiday.delete({ where: { id } });
  revalidatePath("/settings/holidays");
}

// ============ Currencies ============
export async function getCurrencies() {
  return db.currency.findMany({ orderBy: { sortOrder: "asc" } });
}
export async function getDefaultCurrency() {
  return db.currency.findFirst({ where: { isDefault: true } });
}
export async function createCurrency(data: { code: string; name: string; symbol: string; rate: number }) {
  await db.currency.create({ data });
  revalidatePath("/settings/currencies");
}
export async function updateCurrency(id: string, data: { code?: string; name?: string; symbol?: string; rate?: number; isDefault?: boolean }) {
  if (data.isDefault) {
    // Unset previous default
    await db.currency.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
  await db.currency.update({ where: { id }, data });
  revalidatePath("/settings/currencies");
}
export async function deleteCurrency(id: string) {
  await db.currency.delete({ where: { id } });
  revalidatePath("/settings/currencies");
}
