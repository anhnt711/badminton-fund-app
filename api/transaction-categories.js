const { asNumber, handleError, normalizeName, requireSecret, sendJson, supabase } = require("./_lib/supabase");

function bodyOf(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}

function normalizeType(type) {
  const value = normalizeName(type);
  if (value === "thu" || value === "income") return "income";
  if (value === "chi" || value === "expense") return "expense";
  return null;
}

function cleanCategory(row, partial = false) {
  const data = {};
  if (!partial || row.type !== undefined) {
    data.type = normalizeType(row.type);
    if (!data.type) {
      const err = new Error("Loại hạng mục phải là Thu hoặc Chi");
      err.statusCode = 400;
      throw err;
    }
  }
  if (!partial || row.name !== undefined) {
    data.name = String(row.name || "").trim();
    if (!data.name) {
      const err = new Error("Tên hạng mục không được trống");
      err.statusCode = 400;
      throw err;
    }
  }
  if (!partial || row.default_amount !== undefined || row.defaultAmount !== undefined) {
    const amount = asNumber(row.default_amount ?? row.defaultAmount);
    if (amount < 0) {
      const err = new Error("Số tiền mặc định không được âm");
      err.statusCode = 400;
      throw err;
    }
    data.default_amount = amount;
  }
  if (!partial || row.sort_order !== undefined || row.sortOrder !== undefined) {
    data.sort_order = Math.trunc(asNumber(row.sort_order ?? row.sortOrder, 100));
  }
  if (!partial || row.active !== undefined) data.active = row.active !== false && row.active !== "false";
  if (!partial || row.note !== undefined) data.note = String(row.note || "");
  return data;
}

module.exports = async function handler(req, res) {
  try {
    const hasKey = Boolean(req.query.key || req.headers["x-app-key"]);

    if (req.method === "GET") {
      if (hasKey) requireSecret(req, "ADMIN_IMPORT_KEY");
      const filter = hasKey ? "" : "&active=eq.true";
      const categories = await supabase(`transaction_categories?select=*&order=sort_order.asc,name.asc${filter}`);
      return sendJson(res, 200, { ok: true, categories });
    }

    requireSecret(req, "ADMIN_IMPORT_KEY");

    if (req.method === "POST") {
      const inserted = await supabase("transaction_categories", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(cleanCategory(bodyOf(req))),
      });
      return sendJson(res, 200, { ok: true, category: inserted[0] });
    }

    if (req.method === "PATCH" || req.method === "PUT") {
      const payload = bodyOf(req);
      const id = String(req.query.id || payload.id || "").trim();
      if (!id) return sendJson(res, 400, { ok: false, error: "Thiếu id hạng mục" });
      const updated = await supabase(`transaction_categories?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(cleanCategory(payload, true)),
      });
      return sendJson(res, 200, { ok: true, category: updated[0] });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "").trim();
      if (!id) return sendJson(res, 400, { ok: false, error: "Thiếu id hạng mục" });
      const updated = await supabase(`transaction_categories?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ active: false }),
      });
      return sendJson(res, 200, { ok: true, category: updated[0] });
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    handleError(res, error);
  }
};
