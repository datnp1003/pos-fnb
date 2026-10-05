import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const SCREENSHOT_DIR = "/home/datnguyen/.openclaw/workspace/pos-fnb/screenshots";
const BASE_URL = "http://localhost:3000";

const pages = [
  { name: "01-login", path: "/login", desc: "Đăng nhập" },
  { name: "02-dashboard", path: "/dashboard", desc: "Dashboard" },
  { name: "03-order-tables", path: "/order", desc: "Bàn Order" },
  { name: "04-inventory", path: "/inventory", desc: "Quản lý Kho" },
  { name: "05-cash", path: "/cash", desc: "Thu Chi & Quỹ" },
  { name: "06-reports", path: "/reports", desc: "Báo cáo" },
  // Settings sub-pages
  { name: "07-settings-general", path: "/settings", desc: "Cấu hình chung" },
  { name: "08-settings-users", path: "/settings/users", desc: "Người dùng & Vai trò" },
  { name: "09-settings-categories", path: "/settings/categories", desc: "Loại món" },
  { name: "10-settings-products", path: "/settings/products", desc: "Món ăn" },
  { name: "11-settings-toppings", path: "/settings/toppings", desc: "Topping / Modifier" },
  { name: "12-settings-ingredients", path: "/settings/ingredients", desc: "Nguyên liệu" },
  { name: "13-settings-vat", path: "/settings/vat", desc: "Thuế VAT" },
  { name: "14-settings-excise-tax", path: "/settings/excise-tax", desc: "Thuế TTĐB" },
  { name: "15-settings-units", path: "/settings/units", desc: "Đơn vị tính" },
  { name: "16-settings-areas", path: "/settings/areas", desc: "Khu vực & Bàn" },
  { name: "17-settings-karaoke", path: "/settings/karaoke", desc: "Karaoke Pricing" },
  { name: "18-settings-printers", path: "/settings/printers", desc: "Máy in" },
  { name: "19-settings-templates", path: "/settings/print-templates", desc: "Mẫu in" },
  { name: "20-settings-shifts", path: "/settings/shifts", desc: "Ca làm việc" },
  { name: "21-settings-payments", path: "/settings/payment-methods", desc: "Thanh toán" },
  { name: "22-settings-discounts", path: "/settings/discounts", desc: "Giảm giá" },
  { name: "23-settings-service", path: "/settings/service-charges", desc: "Phụ thu" },
  { name: "24-settings-modules", path: "/settings/modules", desc: "Module hệ thống" },
];

(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 size
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log("🚀 Starting screenshots...\n");

  // Step 1: Login
  console.log("1️⃣  Navigating to login...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Step 2: Screenshot each page
  for (const p of pages) {
    console.log(`📸 ${p.name} — ${p.desc}`);
    try {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${p.name}.png`),
        fullPage: true,
      });
      console.log(`   ✅ ${p.name}.png`);
    } catch (e) {
      console.log(`   ❌ ${p.name}: ${e.message?.slice(0, 80)}`);
    }
  }

  await browser.close();
  console.log("\n✅ All screenshots saved to:", SCREENSHOT_DIR);
})();
