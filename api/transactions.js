const {
  asNumber,
  handleError,
  normalizeName,
  requireSecret,
  sendJson,
  supabase,
} = require("./_lib/supabase");

function bodyOf(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeType(type) {
  const value = normalizeName(type);
  if (value === "thu" || value === "income") return "income";
  if (value === "chi" || value === "expense") return "expense";
  return null;
}

function findMember(input, members) {
  if (!input) return null;
  const key = normalizeName(input);
  return members.find((member) => normalizeName(member.code) === key || normalizeName(member.name) === key) || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

  try {
    requireSecret(req, "ACCOUNTANT_KEY");
    const payload = bodyOf(req);
    const items = Array.isArray(payload.items) ? payload.items : [payload];
    const members = await supabase("members?select=id,code,name");

    const rows = items.map((item) => {
      const type = normalizeType(item.type);
      if (!type) {
        const err = new Error("Loại thu chi phải là Thu hoặc Chi");
        err.statusCode = 400;
        throw err;
      }
      const amount = asNumber(item.amount);
      if (amount <= 0) {
        const err = new Error("Số tiền phải lớn hơn 0");
        err.statusCode = 400;
        throw err;
      }
      const member = findMember(item.member || item.memberName || item.code, members);
      return {
        transaction_date: item.date || item.transactionDate || today(),
        type,
        member_id: member?.id || null,
        category: item.category || (type === "income" ? "Đóng tiền" : "Chi phí"),
        amount,
        note: item.note || "",
      };
    });

    const inserted = await supabase("transactions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(rows),
    });

    sendJson(res, 200, { ok: true, inserted });
  } catch (error) {
    handleError(res, error);
  }
};
