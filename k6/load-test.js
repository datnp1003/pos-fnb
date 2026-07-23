import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

const loginDuration = new Trend("login_duration", true);
const dashboardDuration = new Trend("dashboard_duration", true);
const errorRate = new Rate("errors");
const isCiProfile = __ENV.LOAD_TEST_PROFILE === "ci";

export const options = {
  stages: isCiProfile
    ? [
        { duration: "5s", target: 5 },
        { duration: "10s", target: 5 },
        { duration: "5s", target: 0 },
      ]
    : [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 25 },
        { duration: "1m", target: 25 },
        { duration: "30s", target: 0 },
      ],
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
  thresholds: {
    // Login é CPU-bound (bcrypt). Acontece uma vez por VU, então tem alvo próprio e mais folgado.
    login_duration: ["p(95)<2000"],
    // Navegação autenticada é o que realmente medimos sob carga.
    dashboard_duration: ["p(95)<1000"],
    // Threshold de latência só sobre as leituras autenticadas, isolado via tag.
    // Assim a cauda cara do login não contamina o número global.
    "http_req_duration{type:read}": ["p(95)<1000"],
    // Saúde geral: nada pode falhar.
    http_req_failed: ["rate<0.01"],
    errors: ["rate<0.01"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const USERNAME = __ENV.LOAD_TEST_USER || "admin";
const PASSWORD = __ENV.LOAD_TEST_PASS || "admin123";

function getCsrfToken(jar) {
  const res = http.get(`${BASE}/api/auth/csrf`, { jar });
  check(res, { "csrf 200": (r) => r.status === 200 });
  try {
    return JSON.parse(res.body).csrfToken;
  } catch {
    return "";
  }
}

// Loga uma vez e devolve um cookie jar com a sessão estabelecida.
// Tudo (CSRF + callback) compartilha o mesmo jar para os cookies de sessão persistirem.
function login() {
  const jar = http.cookieJar();
  const csrf = getCsrfToken(jar);

  const res = http.post(
    `${BASE}/api/auth/callback/credentials`,
    {
      username: USERNAME,
      password: PASSWORD,
      csrfToken: csrf,
      callbackUrl: `${BASE}/dashboard`,
      json: "true",
    },
    { redirects: 0, jar },
  );
  loginDuration.add(res.timings.duration);

  const ok = check(res, {
    "login redirects": (r) => r.status === 302 || r.status === 200,
  });
  errorRate.add(!ok);

  return jar;
}

// Cada VU loga UMA vez no início e reusa a sessão em todas as iterações.
// __VU/__ITER não persistem estado entre iterações, então guardamos o jar
// num escopo de módulo por-VU (cada VU roda num runtime isolado).
let vuJar = null;

export default function runLoadScenario() {
  if (vuJar === null) {
    vuJar = login();
  }

  const dash = http.get(`${BASE}/dashboard`, {
    jar: vuJar,
    tags: { type: "read" },
  });
  dashboardDuration.add(dash.timings.duration);

  const dashOk = check(dash, {
    // 302 aqui significa sessão expirada (redireciona para /login) — falha real.
    "dashboard 200": (r) => r.status === 200,
  });
  errorRate.add(!dashOk);

  const orderRes = http.get(`${BASE}/order`, { jar: vuJar, tags: { type: "read" } });
  const orderOk = check(orderRes, { "order 200": (r) => r.status === 200 });
  errorRate.add(!orderOk);

  const invRes = http.get(`${BASE}/inventory`, { jar: vuJar, tags: { type: "read" } });
  const invOk = check(invRes, { "inventory 200": (r) => r.status === 200 });
  errorRate.add(!invOk);

  sleep(1);
}