const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

function getConfig() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    const err = new Error(`Missing environment variables: ${missing.join(", ")}`);
    err.statusCode = 500;
    throw err;
  }
  return {
    url: process.env.SUPABASE_URL.replace(/\/$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function supabase(path, options = {}) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const err = new Error(data?.message || response.statusText);
    err.statusCode = response.status;
    err.details = data;
    throw err;
  }
  return data;
}

function sendJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(payload));
}

function handleError(res, error) {
  const status = error.statusCode || 500;
  sendJson(res, status, {
    ok: false,
    error: error.message || "Unexpected error",
    details: error.details || undefined,
  });
}

function requireSecret(req, envName) {
  const expected = process.env[envName];
  if (!expected) {
    const err = new Error(`Missing environment variable: ${envName}`);
    err.statusCode = 500;
    throw err;
  }
  const provided = req.query.key || req.headers["x-app-key"];
  if (provided !== expected) {
    const err = new Error("Invalid or missing secret key");
    err.statusCode = 401;
    throw err;
  }
}

function monthBounds(month) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month || "") ? month : new Date().toISOString().slice(0, 7);
  const start = `${safeMonth}-01`;
  const endDate = new Date(`${start}T00:00:00.000Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  endDate.setUTCDate(0);
  return {
    month: safeMonth,
    start,
    end: endDate.toISOString().slice(0, 10),
  };
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  asNumber,
  handleError,
  monthBounds,
  normalizeName,
  requireSecret,
  sendJson,
  supabase,
};
