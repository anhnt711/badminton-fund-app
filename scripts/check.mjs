import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "index.html",
  "admin.html",
  "attendance.html",
  "admin-import.html",
  "admin-setup.html",
  "members.html",
  "categories.html",
  "accounting.html",
  "styles.css",
  "app.js",
  "api/public-data.js",
  "api/admin-import.js",
  "api/admin-setup.js",
  "api/members.js",
  "api/transaction-categories.js",
  "api/transactions.js",
  "api/_lib/supabase.js",
  "api/_lib/calculation.js",
  "supabase/schema.sql",
  "vercel.json",
];

for (const file of requiredFiles) {
  await fs.access(file);
}

const jsFiles = [
  "app.js",
  "api/public-data.js",
  "api/admin-import.js",
  "api/admin-setup.js",
  "api/members.js",
  "api/transaction-categories.js",
  "api/transactions.js",
  "api/_lib/supabase.js",
  "api/_lib/calculation.js",
];

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

JSON.parse(await fs.readFile("vercel.json", "utf8"));
JSON.parse(await fs.readFile("package.json", "utf8"));

console.log("OK: project files and JavaScript syntax are valid.");
