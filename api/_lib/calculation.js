const { asNumber, monthBounds, supabase } = require("./supabase");

function settingNumber(settings, key, fallback) {
  const item = settings.find((row) => row.key === key);
  return asNumber(item?.value, fallback);
}

function settingText(settings, key, fallback = "") {
  const item = settings.find((row) => row.key === key);
  return String(item?.value ?? fallback).trim();
}

async function loadMonthData(monthParam) {
  const bounds = monthBounds(monthParam);
  const [settings, members, sessions, transactions] = await Promise.all([
    supabase("settings?select=key,value"),
    supabase("members?select=*&order=name.asc"),
    supabase("sessions?select=*&order=session_date.desc&session_date=gte." + bounds.start + "&session_date=lte." + bounds.end),
    supabase("transactions?select=*&order=transaction_date.desc&transaction_date=gte." + bounds.start + "&transaction_date=lte." + bounds.end),
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
  const guestMaleFee = settingNumber(settings, "guest_male_fee", 70000);
  const guestFemaleFee = settingNumber(settings, "guest_female_fee", 50000);

  const rowsByMember = new Map();
  members
    .filter((member) => member.active)
    .forEach((member) => {
      rowsByMember.set(member.id, {
        id: member.id,
        code: member.code,
        name: member.name,
        gender: member.gender,
        membershipType: member.membership_type,
        fixedDue:
          member.membership_type === "monthly"
            ? monthlyFee
            : member.membership_type === "half_month"
              ? halfMonthFee
              : 0,
        sessionDue: 0,
        potDue: 0,
        paid: 0,
        attendedSessions: 0,
      });
    });

  sessionPlayers.forEach((player) => {
    const row = rowsByMember.get(player.member_id);
    if (!row) return;
    row.attendedSessions += player.attended ? 1 : 0;
    row.sessionDue += asNumber(player.session_fee);
    row.potDue += asNumber(player.pot_due);
  });

  transactions
    .filter((tx) => tx.type === "income" && tx.member_id)
    .forEach((tx) => {
      const row = rowsByMember.get(tx.member_id);
      if (row) row.paid += asNumber(tx.amount);
    });

  const balances = Array.from(rowsByMember.values()).map((row) => {
    const totalDue = row.fixedDue + row.sessionDue + row.potDue;
    return {
      ...row,
      totalDue,
      balance: totalDue - row.paid,
    };
  });

  const totalDue = balances.reduce((sum, row) => sum + row.totalDue, 0);
  const totalPaid = balances.reduce((sum, row) => sum + row.paid, 0);
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

  return {
    month: bounds.month,
    payment: {
      bankCode: settingText(settings, "bank_code"),
      bankAccount: settingText(settings, "bank_account"),
      bankOwner: settingText(settings, "bank_owner"),
      transferPrefix: settingText(settings, "transfer_prefix", "CAULONG"),
    },
    totals: {
      totalDue,
      totalPaid,
      memberDebt,
      totalIncome,
      totalExpense,
      fundBalance: totalIncome - totalExpense,
      potDue,
      potWaterExpense,
      potOtherExpense,
      potRemaining: potDue - potWaterExpense - potOtherExpense,
      sessions: sessions.length,
      activeMembers: balances.length,
      debtors: balances.filter((row) => row.balance > 0).length,
    },
    balances: balances.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, "vi")),
    sessions,
    transactions,
  };
}

module.exports = {
  calculateSummary,
  loadMonthData,
  settingNumber,
  settingText,
};
