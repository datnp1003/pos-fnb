import { browser } from "k6/browser";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// ─── Métricas customizadas ────────────────────────────────────────────────────
const loginDuration      = new Trend("browser_login_duration", true);
const orderFlowDuration  = new Trend("browser_order_flow_duration", true);
const checkoutDuration   = new Trend("browser_checkout_duration", true);
const flowErrors         = new Rate("browser_flow_errors");

// ─── Configuração ─────────────────────────────────────────────────────────────
const BASE     = __ENV.BASE_URL       || "http://localhost:3000";
const USERNAME = __ENV.LOAD_TEST_USER || "admin";
const PASSWORD = __ENV.LOAD_TEST_PASS || "admin123";
const isCiProfile = __ENV.LOAD_TEST_PROFILE === "ci";

export const options = {
  scenarios: {
    pos_order_flow: {
      executor: "constant-vus",
      vus: isCiProfile ? 1 : 2,
      duration: isCiProfile ? "90s" : "3m",
      options: {
        browser: {
          type: "chromium",
          headless: __ENV.BROWSER_HEADLESS !== "false",
        },
      },
    },
  },
  thresholds: {
    browser_login_duration:      ["p(95)<10000"],
    browser_order_flow_duration: ["p(95)<12000"],
    browser_checkout_duration:   ["p(95)<8000"],
    browser_flow_errors:         ["rate<0.05"],
    "browser_web_vital_lcp{scenario:pos_order_flow}": ["p(90)<3000"],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errStr(err) {
  if (!err) return "unknown error";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  try { return String(err); } catch { return "unserializable"; }
}

// Poll até a URL conter o padrão esperado.
async function waitForUrlContains(page, pattern, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (page.url().includes(pattern)) return;
    await sleep(0.5);
  }
  throw new Error(`Timeout (${timeoutMs}ms) esperando URL conter "${pattern}". Atual: ${page.url()}`);
}

// ─── Login ────────────────────────────────────────────────────────────────────
// PROBLEMA RESOLVIDO: o login.tsx usa signIn() do NextAuth com redirect:false
// e depois faz globalThis.location.href = "/order".
// Sem esperar a hidratação do React, o browser submete o <form> via GET nativo
// (sem method/action definido), mandando credenciais como query params e falhando.
// A solução: aguardar o __reactFiber no botão antes de clicar.
async function doLogin(page) {
  const t0 = Date.now();

  await page.goto(`${BASE}/login`);

  // ESPERA DE HIDRATAÇÃO — a chave de todo o fluxo.
  //
  // O login.tsx usa signIn() do NextAuth com redirect:false + location.href manual.
  // O <form> não tem method/action, então sem o onSubmit registrado pelo React,
  // o browser submete como GET nativo e manda as credenciais como query params.
  //
  // Solução: o login.tsx seta data-hydrated="true" no form via useEffect().
  // Esse atributo NUNCA existe no HTML gerado pelo SSR — só aparece depois
  // que o React monta no cliente. Esperar por ele é 100% confiável.
  await page
    .locator("[data-testid='login-form'][data-hydrated='true']")
    .waitFor({ timeout: 10000 });

  await page.locator("[data-testid='login-username']").fill(USERNAME);
  await page.locator("[data-testid='login-password']").fill(PASSWORD);
  await page.locator("[data-testid='login-submit']").click();

  // Após login bem-sucedido: location.href = "/order" (não /dashboard!)
  await waitForUrlContains(page, "/order", 15000);

  // Aguarda mesas aparecerem (SSR + hidratação do OrderClient concluídos)
  await page
    .locator("[data-testid='table-free'], [data-testid='table-occupied']")
    .first()
    .waitFor({ timeout: 12000 });

  return Date.now() - t0;
}


// ─── Fluxo de pedido ──────────────────────────────────────────────────────────
async function doOrderFlow(page) {
  const t0 = Date.now();

  // Preferir mesa livre; se não houver, abrir uma ocupada (continuar pedido)
  const freeTable     = page.locator("[data-testid='table-free']").first();
  const occupiedTable = page.locator("[data-testid='table-occupied']").first();

  const hasFree = await freeTable.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasFree) {
    await freeTable.click();
  } else {
    const hasOccupied = await occupiedTable.isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasOccupied) throw new Error("Sem mesas disponíveis (nem livre nem ocupada)");
    await occupiedTable.click();
  }

  // Painel de produtos visível = Server Action openTable() concluiu
  await page.locator("[data-testid='product-btn']").first().waitFor({ timeout: 10000 });

  // Adicionar primeiro produto
  await page.locator("[data-testid='product-btn']").first().click();

  // Aguardar possível dialog de toppings
  await sleep(1);

  // Se abriu dialog de toppings (botão send ainda não visível), fechar com Escape
  const sendVisible = await page
    .locator("[data-testid='btn-send-kitchen']")
    .isVisible({ timeout: 1500 })
    .catch(() => false);

  if (!sendVisible) {
    // Tentar confirmar topping com o último botão habilitado visível
    const addBtn = page.locator("button:enabled").last();
    if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await addBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
    await page
      .locator("[data-testid='btn-send-kitchen']")
      .waitFor({ timeout: 6000 });
  }

  // Enviar para cozinha — Server Action: sendOrder()
  const sendBtn  = page.locator("[data-testid='btn-send-kitchen']");
  const disabled = await sendBtn.isDisabled().catch(() => true);
  if (!disabled) {
    await sendBtn.click();
    await sleep(1.5); // aguardar useTransition
  }

  return Date.now() - t0;
}

// ─── Checkout ─────────────────────────────────────────────────────────────────
async function doCheckout(page) {
  const t0 = Date.now();

  await page.locator("[data-testid='btn-checkout']").waitFor({ timeout: 5000 });
  await page.locator("[data-testid='btn-checkout']").click();

  // Aguardar dialog abrir
  await page.locator("[data-testid='checkout-amount']").waitFor({ timeout: 6000 });

  // Preencher valor (triple-click seleciona tudo no input)
  await page.locator("[data-testid='checkout-amount']").click({ clickCount: 3 });
  await page.locator("[data-testid='checkout-amount']").pressSequentially("100000");

  // Garantir método CASH
  const sel = page.locator("[data-testid='checkout-payment-method']");
  if (await sel.isVisible({ timeout: 1000 }).catch(() => false)) {
    await sel.selectOption("CASH");
  }

  await page.locator("[data-testid='btn-confirm-checkout']").waitFor({ timeout: 3000 });
  await page.locator("[data-testid='btn-confirm-checkout']").click();

  // Aguarda retorno para a grade de mesas
  await page
    .locator("[data-testid='table-free'], [data-testid='table-occupied']")
    .first()
    .waitFor({ timeout: 12000 });

  return Date.now() - t0;
}

// ─── Cenário principal ────────────────────────────────────────────────────────
export default async function posOrderScenario() {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  let loginOk = false;
  let orderOk = false;
  let checkOk = false;

  try {
    // 1. Login
    const loginMs = await doLogin(page);
    loginDuration.add(loginMs);
    loginOk = page.url().includes("/order");
    check(page, { "login: chegou em /order": () => loginOk });
    flowErrors.add(!loginOk);
    if (!loginOk) return;

    // 2. Pedido
    const orderMs = await doOrderFlow(page);
    orderFlowDuration.add(orderMs);
    orderOk = page.url().includes("/order");
    check(page, { "order flow: tela de pedido visível": () => orderOk });
    flowErrors.add(!orderOk);
    if (!orderOk) return;

    // 3. Checkout
    const checkMs = await doCheckout(page);
    checkoutDuration.add(checkMs);
    checkOk = page.url().includes("/order");
    check(page, { "checkout: voltou para grade de mesas": () => checkOk });
    flowErrors.add(!checkOk);

    sleep(isCiProfile ? 2 : 5);

  } catch (err) {
    console.error(`[VU ${__VU} ITER ${__ITER}] falha em: ${loginOk ? (orderOk ? "checkout" : "order-flow") : "login"} | erro: ${errStr(err)} | url: ${page.url()}`);
    if (!loginOk) flowErrors.add(1);
    if (!orderOk) flowErrors.add(1);
    if (!checkOk) flowErrors.add(1);
  } finally {
    await page.close();
  }
}
