const { settingNumber } = require("./_lib/calculation");
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

function memberKeyMaps(members) {
  const byCode = new Map();
  const byName = new Map();
  members.forEach((member) => {
    byCode.set(normalizeName(member.code), member);
    byName.set(normalizeName(member.name), member);
  });
  return { byCode, byName };
}

function findMember(player, maps) {
  if (player.code) {
    const hit = maps.byCode.get(normalizeName(player.code));
    if (hit) return hit;
  }
  if (player.name) return maps.byName.get(normalizeName(player.name));
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

  try {
    requireSecret(req, "ADMIN_IMPORT_KEY");
    const payload = bodyOf(req);
    const players = Array.isArray(payload.players) ? payload.players : [];
    if (!players.length) {
      return sendJson(res, 400, { ok: false, error: "Thiếu danh sách players" });
    }

    const [members, settings] = await Promise.all([
      supabase("members?select=*&active=eq.true"),
      supabase("settings?select=key,value"),
    ]);
    const maps = memberKeyMaps(members);
    const unknownPlayers = players.filter((player) => !findMember(player, maps));
    if (unknownPlayers.length) {
      return sendJson(res, 400, {
        ok: false,
        error: "Có tên chưa khớp với danh sách thành viên",
        unknownPlayers: unknownPlayers.map((player) => player.name || player.code),
      });
    }

    const guestMaleFee = settingNumber(settings, "guest_male_fee", 70000);
    const guestFemaleFee = settingNumber(settings, "guest_female_fee", 50000);
    const sessionDate = payload.date || payload.sessionDate || today();
    const rows = players.map((player) => {
      const member = findMember(player, maps);
      const providedSessionFee = player.sessionFee ?? player.session_fee;
      const defaultSessionFee =
        member.membership_type === "guest" ? (member.gender === "Nữ" ? guestFemaleFee : guestMaleFee) : 0;
      return {
        member,
        row: {
          member_id: member.id,
          attended: player.attended !== false,
          session_fee: providedSessionFee === undefined ? defaultSessionFee : asNumber(providedSessionFee),
          pot_due: asNumber(player.potDue ?? player.pot_due ?? player.keo ?? player.kèo),
          note: player.note || "",
        },
      };
    });

    const preview = rows.map(({ member, row }) => ({
      code: member.code,
      name: member.name,
      membershipType: member.membership_type,
      sessionFee: row.session_fee,
      potDue: row.pot_due,
      totalDue: row.session_fee + row.pot_due,
      note: row.note,
    }));

    if (payload.dryRun) {
      return sendJson(res, 200, {
        ok: true,
        dryRun: true,
        session: {
          date: sessionDate,
          title: payload.title || "Buổi cầu lông",
          playerCount: preview.length,
          potTotal: preview.reduce((sum, row) => sum + row.potDue, 0),
        },
        players: preview,
      });
    }

    const sessionInsert = await supabase("sessions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        session_date: sessionDate,
        title: payload.title || "Buổi cầu lông",
        note: payload.note || "",
        shuttle_count: asNumber(payload.shuttleCount ?? payload.shuttle_count),
        bottle_count: asNumber(payload.bottleCount ?? payload.bottle_count),
        water_expense: asNumber(payload.waterExpense ?? payload.water_expense),
        pot_expense: asNumber(payload.potExpense ?? payload.pot_expense),
      }),
    });

    const session = sessionInsert[0];
    await supabase("session_players", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows.map(({ row }) => ({ ...row, session_id: session.id }))),
    });

    sendJson(res, 200, {
      ok: true,
      session,
      importedPlayers: preview.length,
      potTotal: preview.reduce((sum, row) => sum + row.potDue, 0),
      totalDue: preview.reduce((sum, row) => sum + row.totalDue, 0),
      players: preview,
    });
  } catch (error) {
    handleError(res, error);
  }
};
