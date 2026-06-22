const { calculateSummary, loadMonthData } = require("./_lib/calculation");
const { handleError, sendJson } = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  try {
    const data = await loadMonthData(req.query.month);
    sendJson(res, 200, { ok: true, data: calculateSummary(data) });
  } catch (error) {
    handleError(res, error);
  }
};
