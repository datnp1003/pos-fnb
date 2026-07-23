type FactoryOverrides<T> = Partial<T>;

export type TestRole = {
  id: string;
  name: string;
  permissions: string;
  scopes: string;
  createdAt: Date;
};

export type TestUser = {
  id: string;
  username: string;
  password: string;
  name: string;
  avatar: string | null;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TestArea = {
  id: string;
  name: string;
  type: string;
  sortOrder: number;
  createdAt: Date;
};

export type TestTable = {
  id: string;
  name: string;
  capacity: number;
  areaId: string;
  isKaraoke: boolean;
  x: number;
  y: number;
  createdAt: Date;
};

export type TestProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  costPrice: number;
  categoryId: string;
  vatId: string;
  exciseTaxId: string | null;
  unitId: string;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TestOrder = {
  id: string;
  orderNumber: number;
  orderNumberSuffix: string | null;
  tableId: string;
  guestCount: number;
  status: string;
  type: string;
  subtotal: number;
  discountAmount: number;
  serviceCharge: number;
  vatAmount: number;
  exciseTaxAmount: number;
  totalAmount: number;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const now = new Date("2026-01-01T00:00:00.000Z");

export function makeRole(overrides: FactoryOverrides<TestRole> = {}): TestRole {
  return {
    id: "role-admin",
    name: "Admin",
    permissions: JSON.stringify(["*"]),
    scopes: JSON.stringify(["*"]),
    createdAt: now,
    ...overrides,
  };
}

export function makeUser(overrides: FactoryOverrides<TestUser> = {}): TestUser {
  return {
    id: "user-1",
    username: "admin",
    password: "hashed-password",
    name: "Admin",
    avatar: null,
    roleId: "role-admin",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeArea(overrides: FactoryOverrides<TestArea> = {}): TestArea {
  return {
    id: "area-1",
    name: "Main Floor",
    type: "RESTAURANT",
    sortOrder: 1,
    createdAt: now,
    ...overrides,
  };
}

export function makeTable(overrides: FactoryOverrides<TestTable> = {}): TestTable {
  return {
    id: "table-1",
    name: "T1",
    capacity: 4,
    areaId: "area-1",
    isKaraoke: false,
    x: 0,
    y: 0,
    createdAt: now,
    ...overrides,
  };
}

export function makeProduct(overrides: FactoryOverrides<TestProduct> = {}): TestProduct {
  return {
    id: "product-1",
    name: "Coffee",
    slug: "coffee",
    description: null,
    price: 25000,
    costPrice: 10000,
    categoryId: "category-1",
    vatId: "vat-1",
    exciseTaxId: null,
    unitId: "unit-1",
    isAvailable: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeOrder(overrides: FactoryOverrides<TestOrder> = {}): TestOrder {
  return {
    id: "order-1",
    orderNumber: 1,
    orderNumberSuffix: null,
    tableId: "table-1",
    guestCount: 2,
    status: "OPEN",
    type: "NORMAL",
    subtotal: 0,
    discountAmount: 0,
    serviceCharge: 0,
    vatAmount: 0,
    exciseTaxAmount: 0,
    totalAmount: 0,
    openedAt: now,
    closedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
