const { handleError, requireSecret, sendJson, supabase } = require("./_lib/supabase");

function bodyOf(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}

function normalizeMembershipType(value) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  if (["monthly", "co dinh thang", "cố định tháng"].includes(lower)) return "monthly";
  if (["half_month", "half-month", "co dinh nua thang", "cố định nửa tháng"].includes(lower)) return "half_month";
  if (["guest", "vang lai", "vãng lai"].includes(lower)) return "guest";
  return raw;
}

function normalizeGender(value) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();
  if (["nam", "male"].includes(lower)) return "Nam";
  if (["nữ", "nu", "female"].includes(lower)) return "Nữ";
  return raw;
}

function parseBool(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  const raw = String(value).trim().toLowerCase();
  return !["false", "0", "không", "khong", "nghỉ", "nghi", "inactive"].includes(raw);
}

function cleanMember(row, partial = false) {
  const data = {};
  if (!partial || row.code !== undefined) data.code = String(row.code || "").trim();
  if (!partial || row.name !== undefined) data.name = String(row.name || "").trim();
  if (!partial || row.gender !== undefined) data.gender = normalizeGender(row.gender);
  if (!partial || row.membership_type !== undefined || row.membershipType !== undefined) {
    data.membership_type = normalizeMembershipType(row.membership_type || row.membershipType);
  }
  if (!partial || row.active !== undefined) data.active = parseBool(row.active);

  if (!partial && (!data.code || !data.name)) {
    const err = new Error("Thành viên thiếu mã hoặc tên");
    err.statusCode = 400;
    throw err;
  }
  if (data.gender !== undefined && !["Nam", "Nữ"].includes(data.gender)) {
    const err = new Error("Giới tính phải là Nam hoặc Nữ");
    err.statusCode = 400;
    throw err;
  }
  if (data.membership_type !== undefined && !["monthly", "half_month", "guest"].includes(data.membership_type)) {
    const err = new Error("Loại đóng phải là monthly, half_month hoặc guest");
    err.statusCode = 400;
    throw err;
  }
  return data;
}

module.exports = async function handler(req, res) {
  try {
    requireSecret(req, "ADMIN_IMPORT_KEY");

    if (req.method === "GET") {
      const members = await supabase("members?select=*&order=code.asc");
      return sendJson(res, 200, { ok: true, members });
    }

    if (req.method === "POST") {
      const payload = cleanMember(bodyOf(req));
      const inserted = await supabase("members", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      return sendJson(res, 200, { ok: true, member: inserted[0] });
    }

    if (req.method === "PATCH" || req.method === "PUT") {
      const payload = bodyOf(req);
      const id = String(req.query.id || payload.id || "").trim();
      if (!id) return sendJson(res, 400, { ok: false, error: "Thiếu id thành viên" });
      const updated = await supabase(`members?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(cleanMember(payload, true)),
      });
      return sendJson(res, 200, { ok: true, member: updated[0] });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "").trim();
      if (!id) return sendJson(res, 400, { ok: false, error: "Thiếu id thành viên" });
      const updated = await supabase(`members?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ active: false }),
      });
      return sendJson(res, 200, { ok: true, member: updated[0] });
    }

    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    handleError(res, error);
  }
};
