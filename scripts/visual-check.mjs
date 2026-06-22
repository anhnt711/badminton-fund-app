import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const mockPayload = {
  ok: true,
  data: {
    month: "2026-06",
    totals: {
      totalDue: 7500000,
      totalPaid: 4200000,
      memberDebt: 3300000,
      totalIncome: 5000000,
      totalExpense: 1800000,
      fundBalance: 3200000,
      potDue: 900000,
      potWaterExpense: 260000,
      potOtherExpense: 0,
      potRemaining: 640000,
      sessions: 8,
      activeMembers: 30,
      debtors: 9,
    },
    balances: Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      code: `TV${String(i + 1).padStart(2, "0")}`,
      name: `Thành viên ${String(i + 1).padStart(2, "0")}`,
      gender: i % 5 === 0 ? "Nữ" : "Nam",
      membershipType: i < 6 ? "monthly" : i < 9 ? "half_month" : "guest",
      totalDue: i < 6 ? 500000 : i < 9 ? 250000 : 170000,
      paid: i % 3 === 0 ? 0 : 250000,
      balance: (i < 6 ? 500000 : i < 9 ? 250000 : 170000) - (i % 3 === 0 ? 0 : 250000),
    })),
    sessions: [{ session_date: "2026-06-22", title: "Tối thứ 2", shuttle_count: 4, bottle_count: 18, water_expense: 120000 }],
    transactions: [
      { transaction_date: "2026-06-22", type: "income", category: "Đóng tiền tháng", amount: 500000 },
      { transaction_date: "2026-06-22", type: "expense", category: "Tiền sân", amount: 600000 },
    ],
  },
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/api/public-data") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(mockPayload));
      return;
    }
    let pathname = url.pathname;
    if (pathname === "/") pathname = "/index.html";
    if (pathname === "/admin/import") pathname = "/admin-import.html";
    if (pathname === "/ke-toan") pathname = "/accounting.html";
    const filePath = path.join(root, pathname.replace(/^\//, ""));
    const content = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": mime[path.extname(filePath)] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((resolve) => server.listen(4177, "127.0.0.1", resolve));

try {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (error) {
    console.log(`SKIP: Playwright is unavailable in this runtime (${error.code || error.message}).`);
    server.close();
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://127.0.0.1:4177/", { waitUntil: "networkidle" });
  const dashText = await page.locator("body").innerText();
  const dashOk = dashText.includes("Tổng phải thu") && dashText.includes("Công nợ thành viên") && dashText.includes("Kèo còn lại");

  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto("http://127.0.0.1:4177/admin/import?key=test", { waitUntil: "networkidle" });
  const importOk = (await page.locator("#import-json").inputValue()).includes("players");

  await page.goto("http://127.0.0.1:4177/ke-toan?key=test", { waitUntil: "networkidle" });
  const accountingOk = (await page.locator("form#accounting-form").count()) === 1;

  await browser.close();
  console.log(JSON.stringify({ dashOk, importOk, accountingOk, errors }, null, 2));
} finally {
  server.close();
}
