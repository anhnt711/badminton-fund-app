const { asNumber, monthBounds, supabase } = require("./supabase");

function settingNumber(settings, key, fallback) {
  const item = settings.find((row) => row.key === key);
  return asNumber(item?.value, fallback);
}

function settingText(settings, key, fallback = "") {
  const item = settings.find((row) => row.key === key);
  return String(item?.value ?? fallback).trim();
}

function monthOf(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function addMonths(month, delta) {
  const [year, m] = String(month).split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

// Số tháng tính từ startMonth đến endMonth (bao gồm cả hai đầu). 0 nếu endMonth < startMonth.
function monthsInclusive(startMonth, endMonth) {
  if (!startMonth || !endMonth || endMonth < startMonth) return 0;
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

async function loadMonthData(monthParam) {
  const bounds = monthBounds(monthParam);
  // Tải mọi dữ liệu PHÁT SINH ĐẾN HẾT tháng đang xem để tính công nợ luỹ kế (cộng dồn).
  const [settings, members, sessions, transactions] = await Promise.all([
    supabase("settings?select=key,value"),
    supabase("members?select=*&order=name.asc"),
    supabase("sessions?select=*&order=session_date.desc&session_date=lte." + bounds.end),
    supabase("transactions?select=*&order=transaction_date.desc&transaction_date=lte." + bounds.end),
  ]);

  let sessionPlayers = [];
  if (sessions.length) {
    const ids = sessions.map((session) => session.id).join(",");
    sessionPlayers = await supabase(`session_players?select=*&session_id=in.(${ids})`);
  }

  return { bounds, settings, members, sessions, sessionPlayers, transactions };
}

function calculateSummary(data) {
  const { bounds, settings, members, sessions, sessionPlayers, transactions } = data;
  const monthlyFee = settingNumber(settings, "monthly_fee", 500000);
  const halfMonthFee = settingNumber(settings, "half_month_fee", 250000);
  const viewedMonth = bounds.month;
  const prevMonth = addMonths(viewedMonth, -1);
  // Mốc bắt đầu tính phí cố định. Mỗi người tính từ tháng muộn hơn giữa mốc chung và tháng gia nhập.
  const feeStartMonth = settingText(settings, "fee_start_month", "2026-06");

  const sessionMonthById = new Map(sessions.map((session) => [session.id, monthOf(session.session_date)]));

  const rowsByMember = new Map();
  members
    .filter((member) => member.active)
    .forEach((member) => {
      const feePerMonth =
        member.membership_type === "monthly"
          ? monthlyFee
          : member.membership_type === "half_month"
            ? halfMonthFee
            : 0;
      const joinMonth = monthOf(member.created_at) || feeStartMonth;
      const memberStart = joinMonth > feeStartMonth ? joinMonth : feeStartMonth;
      const cumulativeFixed = monthsInclusive(memberStart, viewedMonth) * feePerMonth;
      const prevFixed = monthsInclusive(memberStart, prevMonth) * feePerMonth;
      rowsByMember.set(member.id, {
        id: member.id,
        code: member.code,
        name: member.name,
        gender: member.gender,
        membershipType: member.membership_type,
        cumulativeFixed,
        prevFixed,
        monthFixed: cumulativeFixed - prevFixed,
        prevSession: 0,
        prevPot: 0,
        monthSession: 0,
        monthPot: 0,
        prevPaid: 0,
        monthPaid: 0,
        attendedSessions: 0,
      });
    });

  sessionPlayers.forEach((player) => {
    const row = rowsByMember.get(player.member_id);
    if (!row) return;
    const smonth = sessionMonthById.get(player.session_id) || "";
    const fee = asNumber(player.session_fee);
    const pot = asNumber(player.pot_due);
    if (smonth === viewedMonth) {
      row.monthSession += fee;
      row.monthPot += pot;
      row.attendedSessions += player.attended ? 1 : 0;
    } else if (smonth && smonth < viewedMonth) {
      row.prevSession += fee;
      row.prevPot += pot;
    }
  });

  transactions
    .filter((tx) => tx.type === "income" && tx.member_id)
    .forEach((tx) => {
      const row = rowsByMember.get(tx.member_id);
      if (!row) return;
      const tmonth = monthOf(tx.transaction_date);
      if (tmonth === viewedMonth) row.monthPaid += asNumber(tx.amount);
      else if (tmonth < viewedMonth) row.prevPaid += asNumber(tx.amount);
    });

  const balances = Array.from(rowsByMember.values()).map((row) => {
    const prevBalance = row.prevFixed + row.prevSession + row.prevPot - row.prevPaid;
    const monthDue = row.monthFixed + row.monthSession + row.monthPot;
    const totalDue = row.cumulativeFixed + row.prevSession + row.monthSession + row.prevPot + row.monthPot;
    const paid = row.prevPaid + row.monthPaid;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      gender: row.gender,
      membershipType: row.membershipType,
      attendedSessions: row.attendedSessions,
      // phát sinh trong tháng đang xem
      monthFixed: row.monthFixed,
      monthSession: row.monthSession,
      monthPot: row.monthPot,
      monthDue,
      monthPaid: row.monthPaid,
      // luỹ kế
      prevBalance,
      totalDue,
      paid,
      balance: totalDue - paid,
      // alias tương thích chỗ cũ
      fixedDue: row.monthFixed,
      sessionDue: row.monthSession,
      potDue: row.monthPot,
    };
  });

  const totalDue = balances.reduce((sum, row) => sum + row.totalDue, 0);
  const monthPaidTotal = balances.reduce((sum, row) => sum + row.monthPaid, 0);
  const memberDebt = balances.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
  const totalExpense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + asNumber(tx.amount), 0);
  const totalIncome = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + asNumber(tx.amount), 0);
  const potDue = sessionPlayers.reduce((sum, row) => sum + asNumber(row.pot_due), 0);
  const potWaterExpense = sessions.reduce((sum, row) => sum + asNumber(row.water_expense), 0);
  const potOtherExpense = sessions.reduce((sum, row) => sum + asNumber(row.pot_expense), 0);
  const monthSessions = sessions.filter((session) => monthOf(session.session_date) === viewedMonth);
  const monthTransactions = transactions.filter((tx) => monthOf(tx.transaction_date) === viewedMonth);

  return {
    month: viewedMonth,
    payment: {
      bankCode: settingText(settings, "bank_code"),
      bankAccount: settingText(settings, "bank_account"),
      bankOwner: settingText(settings, "bank_owner"),
      transferPrefix: settingText(settings, "transfer_prefix", "CAULONG"),
    },
    totals: {
      totalDue,
      totalPaid: monthPaidTotal,
      memberDebt,
      totalIncome,
      totalExpense,
      fundBalance: totalIncome - totalExpense,
      potDue,
      potWaterExpense,
      potOtherExpense,
      potRemaining: potDue - potWaterExpense - potOtherExpense,
      sessions: monthSessions.length,
      activeMembers: balances.length,
      debtors: balances.filter((row) => row.balance > 0).length,
    },
    balances: balances.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, "vi")),
    sessions: monthSessions,
    transactions: monthTransactions,
  };
}

module.exports = {
  calculateSummary,
  loadMonthData,
  settingNumber,
  settingText,
};
