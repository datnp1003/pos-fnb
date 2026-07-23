import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { autoDeductStockForOrder } from "@/server/recipe/actions";
import { createPrintJob } from "@/server/reports/print-actions";
import {
  addItem,
  cancelItem,
  checkoutOrder,
  getActiveAreasWithTables,
  getCategoriesWithProducts,
  getAreasWithTables,
  getOrder,
  getTempBill,
  mergeTables,
  openTable,
  printTempBill,
  refreshKaraokeTime,
  removeItem,
  sendOrder,
  splitItems,
  splitItemsEvenly,
  updateItemQuantity,
  updateOrderGuest,
} from "./actions";

// End-to-end coverage of the `order` module against a real Postgres database.
// Mirrors the POS sales lifecycle: open table -> add items -> send to kitchen ->
// checkout (payment + cash flow). Asserts persisted DB state, not just return
// values, so the server actions are validated as an integrated unit.
//
// Requires a seeded DB (DATABASE_URL). See vitest.integration.config.ts header.

// Dedicated area/tables created here so we never collide with seeded data or
// other tests, and cleanup is a simple "delete everything under this area".
const AREA_ID = "area-integration-test";
const TABLE_A_ID = "t-integration-A";
const TABLE_B_ID = "t-integration-B";

// Dedicated KARAOKE area so we can exercise the karaoke branch of openTable /
// syncKaraokeTime without touching seeded data (the seed ships no karaoke area).
const KARAOKE_AREA_ID = "area-integration-karaoke";
const KARAOKE_TABLE_ID = "t-integration-K";
const KARAOKE_PRICING_ID = "kp-integration-test";
// syncKaraokeTime lazily creates a product with this exact slug.
const KARAOKE_PRODUCT_SLUG = `karaoke-${KARAOKE_PRICING_ID}`;

// The seed activates a 5% "Service Fee" (type SERVICE_FEE, ALL_DAYS), so every
// recalc adds subtotal * 5% as serviceCharge. Encoded here as the documented
// current behaviour rather than asserting serviceCharge === 0.
const SERVICE_FEE_RATE = 0.05;

const ALL_TABLE_IDS = [TABLE_A_ID, TABLE_B_ID, KARAOKE_TABLE_ID];

// Seeded products with known, stable tax setup (see prisma/seed.ts).
let icedTeaId: string; // price 5000, VAT 8%, no excise
let localBeerId: string; // price 20000, VAT 10%, excise 65%
let beefSoupId: string; // price 65000, VAT 8%, has topping groups
let adminUserId: string;

async function cleanupOrders() {
  const orders = await db.order.findMany({
    where: { tableId: { in: ALL_TABLE_IDS } },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length === 0) return;

  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  // OrderItemTopping cascades on item delete; delete items explicitly.
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  // cashFlow.referenceId stores the order id (no FK), clean it too.
  await db.cashFlow.deleteMany({ where: { referenceId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
}

beforeAll(async () => {
  const icedTea = await db.product.findUniqueOrThrow({ where: { slug: "iced-tea" } });
  const localBeer = await db.product.findUniqueOrThrow({ where: { slug: "local-beer" } });
  const beefSoup = await db.product.findUniqueOrThrow({ where: { slug: "beef-noodle-soup" } });
  const admin = await db.user.findUniqueOrThrow({ where: { username: "admin" } });
  icedTeaId = icedTea.id;
  localBeerId = localBeer.id;
  beefSoupId = beefSoup.id;
  adminUserId = admin.id;

  await db.area.upsert({
    where: { id: AREA_ID },
    update: { type: "RESTAURANT" },
    create: { id: AREA_ID, name: "Integration Test Area", type: "RESTAURANT", sortOrder: 999 },
  });
  await db.table.upsert({
    where: { id: TABLE_A_ID },
    update: {},
    create: { id: TABLE_A_ID, name: "INT-A", areaId: AREA_ID, capacity: 4 },
  });
  await db.table.upsert({
    where: { id: TABLE_B_ID },
    update: {},
    create: { id: TABLE_B_ID, name: "INT-B", areaId: AREA_ID, capacity: 4 },
  });

  // Karaoke fixtures: a KARAOKE-typed area + table + one pricing row. openTable
  // flags KARAOKE by area.type, and syncKaraokeTime resolves pricing by areaId.
  await db.area.upsert({
    where: { id: KARAOKE_AREA_ID },
    update: { type: "KARAOKE" },
    create: { id: KARAOKE_AREA_ID, name: "Integration Karaoke Area", type: "KARAOKE", sortOrder: 998 },
  });
  await db.table.upsert({
    where: { id: KARAOKE_TABLE_ID },
    update: {},
    create: { id: KARAOKE_TABLE_ID, name: "INT-K", areaId: KARAOKE_AREA_ID, capacity: 6 },
  });
  await db.karaokePricing.upsert({
    where: { id: KARAOKE_PRICING_ID },
    update: { pricePerHour: 50000, timeUnit: "HOUR" },
    create: {
      id: KARAOKE_PRICING_ID,
      name: "INT Karaoke Rate",
      areaId: KARAOKE_AREA_ID,
      startTime: "00:00",
      endTime: "23:59",
      pricePerHour: 50000,
      timeUnit: "HOUR",
    },
  });
});

afterEach(async () => {
  await cleanupOrders();
});

afterAll(async () => {
  await cleanupOrders();
  // The karaoke "time" product is created lazily by syncKaraokeTime; remove it
  // (and any items referencing it) so the area/table/pricing can be deleted.
  const timeProduct = await db.product.findFirst({ where: { slug: KARAOKE_PRODUCT_SLUG } });
  if (timeProduct) {
    await db.orderItem.deleteMany({ where: { productId: timeProduct.id } });
    await db.product.delete({ where: { id: timeProduct.id } });
  }
  await db.table.deleteMany({ where: { id: { in: ALL_TABLE_IDS } } });
  await db.karaokePricing.deleteMany({ where: { id: KARAOKE_PRICING_ID } });
  await db.area.deleteMany({ where: { id: { in: [AREA_ID, KARAOKE_AREA_ID] } } });
  await db.$disconnect();
});

describe("Módulo de pedidos", () => {
  describe("Cardápio e visão do salão", () => {
    it("carrega o cardápio a partir das categorias/produtos do seed", async () => {
      const categories = await getCategoriesWithProducts();
      const products = categories.flatMap((c) => c.products);
      expect(products.some((p) => p.id === icedTeaId)).toBe(true);
      // Only available products are offered for ordering.
      expect(products.every((p) => p.isAvailable)).toBe(true);
    });

    it("exibe a área/mesa de teste na visão do salão", async () => {
      const areas = await getAreasWithTables();
      const area = areas.find((a) => a.id === AREA_ID);
      expect(area).toBeDefined();
      expect(area!.tables.some((t) => t.id === TABLE_A_ID)).toBe(true);
    });

    it("getActiveAreasWithTables retorna o mesmo payload de getAreasWithTables", async () => {
      const active = await getActiveAreasWithTables();
      const all = await getAreasWithTables();
      expect(active.map((a) => a.id)).toEqual(all.map((a) => a.id));
      expect(active.some((a) => a.id === AREA_ID)).toBe(true);
    });
  });

  describe("Abertura de mesa", () => {
    it("abre uma mesa criando um pedido OPEN com número sequencial", async () => {
      const order = await openTable(TABLE_A_ID, 3);
      expect(order.status).toBe("OPEN");
      expect(order.guestCount).toBe(3);
      expect(order.orderNumber).toBeGreaterThan(0);

      const persisted = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(persisted.tableId).toBe(TABLE_A_ID);
      expect(persisted.totalAmount).toBe(0);
    });

    it("é idempotente: reabrir uma mesa ocupada retorna o mesmo pedido", async () => {
      const first = await openTable(TABLE_A_ID, 2);
      const second = await openTable(TABLE_A_ID, 2);
      expect(second.id).toBe(first.id);

      const openCount = await db.order.count({
        where: { tableId: TABLE_A_ID, status: { in: ["OPEN", "SENT"] } },
      });
      expect(openCount).toBe(1);
    });

    it("updateOrderGuest persiste a nova quantidade de pessoas", async () => {
      const order = await openTable(TABLE_A_ID, 2);
      await updateOrderGuest(order.id, 6);

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.guestCount).toBe(6);
    });
  });

  describe("Itens do pedido", () => {
    it("adiciona um item e recalcula subtotal, VAT e total a partir das alíquotas", async () => {
      const order = await openTable(TABLE_A_ID, 1);
      await addItem(order.id, icedTeaId, 2); // 5000 x 2, VAT 8%, no excise

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.subtotal).toBe(10000);
      expect(updated.vatAmount).toBeCloseTo(800, 5);
      expect(updated.exciseTaxAmount).toBe(0);
      // total is the documented invariant: subtotal + taxes - discount + service.
      expect(updated.totalAmount).toBeCloseTo(
        updated.subtotal + updated.vatAmount + updated.exciseTaxAmount - updated.discountAmount + updated.serviceCharge,
        5,
      );
    });

    it("acumula imposto seletivo para produtos tributados (cerveja)", async () => {
      const order = await openTable(TABLE_A_ID, 1);
      await addItem(order.id, localBeerId, 1); // 20000, VAT 10%, excise 65%

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.subtotal).toBe(20000);
      expect(updated.vatAmount).toBeCloseTo(2000, 5);
      expect(updated.exciseTaxAmount).toBeCloseTo(13000, 5);
    });

    it("adiciona um item com toppings e cobra o preço do topping por unidade", async () => {
      const order = await openTable(TABLE_A_ID, 1);
      // Beef Noodle Soup 65000 + Size L topping 10000, quantity 2.
      const item = await addItem(order.id, beefSoupId, 2, [{ toppingId: "top-l", price: 10000 }]);

      const persisted = await db.orderItem.findUniqueOrThrow({
        where: { id: item.id },
        include: { toppings: true },
      });
      expect(persisted.toppings).toHaveLength(1);
      expect(persisted.toppings[0].toppingId).toBe("top-l");

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      // subtotal = (unitPrice 65000 * 2) + (topping 10000 * 2) = 150000.
      expect(updated.subtotal).toBe(150000);
    });

    it("atualiza a quantidade e recalcula os totais", async () => {
      const order = await openTable(TABLE_A_ID, 1);
      const item = await addItem(order.id, icedTeaId, 1);
      await updateItemQuantity(item.id, 5);

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.subtotal).toBe(25000);
    });

    it("remove um item e o exclui do total do pedido", async () => {
      const order = await openTable(TABLE_A_ID, 1);
      const a = await addItem(order.id, icedTeaId, 2);
      await addItem(order.id, localBeerId, 1);
      await removeItem(a.id);

      const remaining = await db.orderItem.findMany({ where: { orderId: order.id } });
      expect(remaining.map((i) => i.id)).not.toContain(a.id);

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.subtotal).toBe(20000); // only the beer remains
    });

    it("cancela um item sem deletá-lo e o exclui dos totais", async () => {
      const order = await openTable(TABLE_A_ID, 1);
      const item = await addItem(order.id, icedTeaId, 2);
      await cancelItem(item.id, adminUserId, "customer changed mind");

      const cancelled = await db.orderItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.cancelledBy).toBe(adminUserId);

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.subtotal).toBe(0); // cancelled items are not billed
    });
  });

  describe("Taxas e encargos de serviço", () => {
    it("aplica a taxa de serviço de 5% do seed ao total do pedido", async () => {
      const order = await openTable(TABLE_A_ID, 1);
      await addItem(order.id, icedTeaId, 2); // subtotal 10000

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.serviceCharge).toBeCloseTo(updated.subtotal * SERVICE_FEE_RATE, 5); // 500
      expect(updated.totalAmount).toBeCloseTo(
        updated.subtotal + updated.vatAmount + updated.exciseTaxAmount - updated.discountAmount + updated.serviceCharge,
        5,
      );
    });
  });

  describe("Envio para a cozinha", () => {
    it("envia o pedido para a cozinha, mudando status do pedido e itens para SENT", async () => {
      const order = await openTable(TABLE_A_ID, 1);
      await addItem(order.id, icedTeaId, 1);
      await sendOrder(order.id, AREA_ID);

      const sent = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      expect(sent.status).toBe("SENT");
      expect(sent.items.every((i) => i.status === "SENT")).toBe(true);
      expect(createPrintJob).toHaveBeenCalled();
    });
  });

  describe("Consulta de pedido e conta parcial", () => {
    it("getOrder retorna o grafo completo do pedido hidratado", async () => {
      const order = await openTable(TABLE_A_ID, 2);
      await addItem(order.id, icedTeaId, 1);

      const full = await getOrder(order.id);
      expect(full).not.toBeNull();
      expect(full!.table.area.id).toBe(AREA_ID);
      expect(full!.items).toHaveLength(1);
      expect(full!.items[0].product.id).toBe(icedTeaId);
    });

    it("getTempBill retorna o mesmo grafo hidratado de getOrder", async () => {
      const order = await openTable(TABLE_A_ID, 2);
      await addItem(order.id, icedTeaId, 1);

      const bill = await getTempBill(order.id);
      expect(bill).not.toBeNull();
      expect(bill!.id).toBe(order.id);
      expect(bill!.table.area.id).toBe(AREA_ID);
      expect(bill!.items).toHaveLength(1);
    });

    it("printTempBill dispara um job de impressão para um pedido existente", async () => {
      const order = await openTable(TABLE_A_ID, 1);
      await addItem(order.id, icedTeaId, 1);

      await printTempBill(order.id);
      expect(createPrintJob).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: order.id, type: "TEMP_BILL" }),
      );
    });
  });

  describe("Fechamento e pagamento", () => {
    it("fecha um pedido NORMAL: registra pagamento, marca PAID e lança receita no caixa", async () => {
      const order = await openTable(TABLE_A_ID, 2);
      await addItem(order.id, icedTeaId, 2);
      await sendOrder(order.id, AREA_ID);

      const beforeCheckout = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      const total = beforeCheckout.totalAmount;

      await checkoutOrder(order.id, [{ method: "CASH", amount: total }], adminUserId);

      const paid = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payments: true },
      });
      expect(paid.status).toBe("PAID");
      expect(paid.closedAt).not.toBeNull();
      expect(paid.userId).toBe(adminUserId);
      expect(paid.payments).toHaveLength(1);
      expect(paid.payments[0].method).toBe("CASH");
      expect(paid.payments[0].amount).toBeCloseTo(total, 5);
      expect(paid.payments[0].status).toBe("COMPLETED");

      const income = await db.cashFlow.findFirst({ where: { referenceId: order.id } });
      expect(income).not.toBeNull();
      expect(income!.type).toBe("INCOME");
      expect(income!.categoryId).toBe("inc-sales");
      expect(income!.amount).toBeCloseTo(total, 5);

      // Inventory module is enabled in the seed -> stock deduction is invoked
      // (mocked here, but the order module correctly delegates to it).
      expect(autoDeductStockForOrder).toHaveBeenCalledWith(order.id);
    });

    it("NÃO lança receita no caixa para um pedido COMP (cortesia)", async () => {
      const order = await openTable(TABLE_A_ID, 1, "COMP");
      expect(order.type).toBe("COMP");
      await addItem(order.id, icedTeaId, 1);

      await checkoutOrder(order.id, [{ method: "COMP", amount: 0 }], adminUserId);

      const paid = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(paid.status).toBe("PAID");

      const income = await db.cashFlow.findFirst({ where: { referenceId: order.id } });
      expect(income).toBeNull();
    });

    it("registra múltiplos pagamentos com referência no fechamento", async () => {
      const order = await openTable(TABLE_A_ID, 2);
      await addItem(order.id, icedTeaId, 2);
      const before = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      const total = before.totalAmount;
      const half = total / 2;

      await checkoutOrder(
        order.id,
        [
          { method: "CASH", amount: half },
          { method: "CARD", amount: half, reference: "auth-12345" },
        ],
        adminUserId,
      );

      const paid = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { payments: { orderBy: { method: "asc" } } },
      });
      expect(paid.status).toBe("PAID");
      expect(paid.payments).toHaveLength(2);
      const card = paid.payments.find((p) => p.method === "CARD");
      expect(card!.reference).toBe("auth-12345");
      expect(paid.payments.every((p) => p.status === "COMPLETED")).toBe(true);

      const income = await db.cashFlow.findFirstOrThrow({ where: { referenceId: order.id } });
      expect(income.amount).toBeCloseTo(total, 5); // single income line for the order total
    });
  });

  describe("Mesclar e dividir mesas", () => {
    it("mergeTables funde pedidos de origem no destino e move seus itens", async () => {
      const target = await openTable(TABLE_A_ID, 2);
      await addItem(target.id, icedTeaId, 1); // 5000
      const source = await openTable(TABLE_B_ID, 2);
      await addItem(source.id, localBeerId, 1); // 20000

      await mergeTables([source.id], TABLE_A_ID);

      const mergedSource = await db.order.findUniqueOrThrow({ where: { id: source.id } });
      expect(mergedSource.status).toBe("MERGED");
      expect(mergedSource.parentOrderId).toBe(target.id);
      expect(mergedSource.closedAt).not.toBeNull();

      const mergedTarget = await db.order.findUniqueOrThrow({
        where: { id: target.id },
        include: { items: true },
      });
      expect(mergedTarget.mergedFrom).toBe(JSON.stringify([source.id]));
      expect(mergedTarget.items).toHaveLength(2);
      expect(mergedTarget.subtotal).toBe(25000); // 5000 + 20000 after recalc
    });

    it("splitItems move os itens selecionados para um novo pedido SPLIT, mantendo a origem aberta", async () => {
      const order = await openTable(TABLE_A_ID, 2);
      await addItem(order.id, icedTeaId, 1); // 5000, stays
      const b = await addItem(order.id, localBeerId, 1); // 20000, moves

      await splitItems(order.id, [b.id], TABLE_B_ID);

      const newOrder = await db.order.findFirstOrThrow({
        where: { parentOrderId: order.id, tableId: TABLE_B_ID },
      });
      expect(newOrder.status).toBe("SPLIT");
      expect(newOrder.orderNumberSuffix).toBe("1");
      expect(newOrder.splitFrom).toBe(order.id);

      const moved = await db.orderItem.findUniqueOrThrow({ where: { id: b.id } });
      expect(moved.orderId).toBe(newOrder.id);

      // The origin keeps item `a`, so it is NOT auto-closed.
      const origin = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(origin.status).toBe("OPEN");
      expect(origin.subtotal).toBe(5000);
      expect(newOrder.subtotal).toBe(20000);
    });

    it("splitItems fecha a origem como SPLIT quando todos os itens saem", async () => {
      const order = await openTable(TABLE_A_ID, 2);
      const a = await addItem(order.id, icedTeaId, 1);

      await splitItems(order.id, [a.id], TABLE_B_ID);

      const origin = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(origin.status).toBe("SPLIT");
      expect(origin.closedAt).not.toBeNull();
    });

    it("splitItemsEvenly divide os itens igualmente em uma mesa livre da mesma área", async () => {
      const order = await openTable(TABLE_A_ID, 4);
      await addItem(order.id, icedTeaId, 4); // qty 4 -> 2 stay, 2 move

      const newOrder = await splitItemsEvenly(order.id, await firstItemIds(order.id));

      expect(newOrder.tableId).toBe(TABLE_B_ID);
      expect(newOrder.parentOrderId).toBe(order.id);

      const original = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      const split = await db.order.findUniqueOrThrow({ where: { id: newOrder.id } });
      // 2 servings each at 5000 -> subtotal 10000 on both sides.
      expect(original.subtotal).toBe(10000);
      expect(split.subtotal).toBe(10000);
    });
  });

  describe("Karaokê", () => {
    it("abre uma mesa de karaokê como pedido KARAOKE e adiciona automaticamente um item de tempo", async () => {
      const order = await openTable(KARAOKE_TABLE_ID, 4);

      const persisted = await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { include: { product: true } } },
      });
      // Area is KARAOKE -> type is forced to KARAOKE regardless of the default.
      expect(persisted.type).toBe("KARAOKE");
      expect(persisted.karaokePricingId).toBe(KARAOKE_PRICING_ID);

      const timeItem = persisted.items.find((i) => i.product.slug === KARAOKE_PRODUCT_SLUG);
      expect(timeItem).toBeDefined();
      expect(timeItem!.quantity).toBeGreaterThanOrEqual(1);
      expect(timeItem!.unitPrice).toBe(50000);
    });

    it("refreshKaraokeTime recalcula o pedido de karaokê sem duplicar o item de tempo", async () => {
      const order = await openTable(KARAOKE_TABLE_ID, 2);

      await refreshKaraokeTime(order.id);

      const items = await db.orderItem.findMany({
        where: { orderId: order.id, product: { slug: KARAOKE_PRODUCT_SLUG }, status: { not: "CANCELLED" } },
      });
      expect(items).toHaveLength(1); // upserted, not appended

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.subtotal).toBeGreaterThanOrEqual(50000);
    });
  });
});

async function firstItemIds(orderId: string): Promise<string[]> {
  const items = await db.orderItem.findMany({ where: { orderId }, select: { id: true } });
  return items.map((i) => i.id);
}
