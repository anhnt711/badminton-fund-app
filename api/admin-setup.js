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

function parseBool(value) {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "").trim().toLowerCase();
  return !["false", "0", "không", "khong", "nghỉ", "nghi", "inactive"].includes(raw);
}

module.exports = async function handler(req, res) {
  try {
    requireSecret(req, "ADMIN_IMPORT_KEY");

    if (req.method === "GET") {
      const [settings, members] = await Promise.all([
        supabase("settings?select=*&order=key.asc"),
        supabase("members?select=*&order=code.asc"),
      ]);
      return sendJson(res, 200, { ok: true, settings, members });
    }

    if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

    const payload = bodyOf(req);
    const settings = Array.isArray(payload.settings) ? payload.settings : [];
    const members = Array.isArray(payload.members) ? payload.members : [];

    if (settings.length) {
      await supabase("settings?on_conflict=key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(
          settings.map((row) => ({
            key: row.key,
            value: String(row.value ?? ""),
            description: row.description || "",
          })),
        ),
      });
    }

    if (members.length) {
      const cleaned = members.map((row, index) => {
        const code = String(row.code || "").trim();
        const name = String(row.name || "").trim();
        const gender = normalizeGender(row.gender);
        const membershipType = normalizeMembershipType(row.membership_type || row.membershipType);
        if (!code || !name) {
          const err = new Error(`Dòng thành viên ${index + 1} thiếu mã hoặc tên`);
          err.statusCode = 400;
          throw err;
        }
        if (!["Nam", "Nữ"].includes(gender)) {
          const err = new Error(`Dòng ${code} có giới tính không hợp lệ`);
          err.statusCode = 400;
          throw err;
        }
        if (!["monthly", "half_month", "guest"].includes(membershipType)) {
          const err = new Error(`Dòng ${code} có loại đóng không hợp lệ`);
          err.statusCode = 400;
          throw err;
        }
        return {
          code,
          name,
          gender,
          membership_type: membershipType,
          active: parseBool(row.active),
        };
      });

      await supabase("members?on_conflict=code", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(cleaned),
      });
    }

    sendJson(res, 200, { ok: true, saved: { settings: settings.length, members: members.length } });
  } catch (error) {
    handleError(res, error);
  }
};
