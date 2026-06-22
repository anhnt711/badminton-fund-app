const money = new Intl.NumberFormat("vi-VN");

function formatMoney(value) {
  return `${money.format(Math.round(Number(value || 0)))}đ`;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function queryKey(name) {
  return new URLSearchParams(location.search).get(name);
}

function rememberKey(storageKey) {
  const fromUrl = queryKey("key");
  if (fromUrl) localStorage.setItem(storageKey, fromUrl);
  return fromUrl || localStorage.getItem(storageKey) || "";
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

function renderError(container, error) {
  container.innerHTML = `<div class="empty">Không tải được dữ liệu: ${error.message}</div>`;
}

async function loadDashboard() {
  const monthInput = document.querySelector("#month");
  const root = document.querySelector("#dashboard");
  monthInput.value ||= currentMonth();

  try {
    root.innerHTML = `<div class="empty">Đang tải...</div>`;
    const payload = await requestJson(`/api/public-data?month=${monthInput.value}`);
    const { totals, balances, sessions, transactions } = payload.data;
    root.innerHTML = `
      <section class="grid summary-grid">
        <div class="metric blue"><div class="label">Tổng phải thu</div><div class="value">${formatMoney(totals.totalDue)}</div><div class="muted">${totals.activeMembers} thành viên</div></div>
        <div class="metric green"><div class="label">Đã thu</div><div class="value">${formatMoney(totals.totalPaid)}</div><div class="muted">Theo kế toán nhập</div></div>
        <div class="metric red"><div class="label">Còn nợ</div><div class="value">${formatMoney(totals.memberDebt)}</div><div class="muted">${totals.debtors} người còn nợ</div></div>
        <div class="metric amber"><div class="label">Quỹ hiện tại</div><div class="value">${formatMoney(totals.fundBalance)}</div><div class="muted">Thu - chi trong tháng</div></div>
      </section>

      <section class="grid summary-grid" style="margin-top:12px">
        <div class="metric"><div class="label">Tổng tiền kèo</div><div class="value">${formatMoney(totals.potDue)}</div><div class="muted">Từ dữ liệu buổi</div></div>
        <div class="metric"><div class="label">Tiền nước đã mua</div><div class="value">${formatMoney(totals.potWaterExpense)}</div><div class="muted">Trừ vào tiền kèo</div></div>
        <div class="metric"><div class="label">Kèo còn lại</div><div class="value">${formatMoney(totals.potRemaining)}</div><div class="muted">Kèo - nước - chi kèo khác</div></div>
        <div class="metric"><div class="label">Số buổi</div><div class="value">${totals.sessions}</div><div class="muted">Trong tháng đang xem</div></div>
      </section>

      <section class="grid two-col" style="margin-top:12px">
        <div class="panel">
          <div class="panel-header"><h2>Công nợ thành viên</h2><span class="muted">${balances.length} người</span></div>
          <div class="table-wrap">${balanceTable(balances)}</div>
        </div>
        <div class="grid">
          <div class="panel">
            <div class="panel-header"><h2>Buổi đã nhập</h2><span class="muted">${sessions.length} buổi</span></div>
            <div class="table-wrap">${sessionsTable(sessions)}</div>
          </div>
          <div class="panel">
            <div class="panel-header"><h2>Thu chi gần đây</h2><span class="muted">${transactions.length} dòng</span></div>
            <div class="table-wrap">${transactionsTable(transactions)}</div>
          </div>
        </div>
      </section>
    `;
  } catch (error) {
    renderError(root, error);
  }
}

function balanceTable(rows) {
  if (!rows.length) return `<div class="empty">Chưa có thành viên</div>`;
  return `
    <table>
      <thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th class="num">Phải đóng</th><th class="num">Đã đóng</th><th class="num">Còn nợ</th><th>Trạng thái</th></tr></thead>
      <tbody>${rows
        .map(
          (row) => `
          <tr>
            <td>${row.code}</td>
            <td>${row.name}</td>
            <td>${memberType(row.membershipType)}</td>
            <td class="num">${formatMoney(row.totalDue)}</td>
            <td class="num">${formatMoney(row.paid)}</td>
            <td class="num">${formatMoney(row.balance)}</td>
            <td><span class="status ${row.balance > 0 ? "debt" : "ok"}">${row.balance > 0 ? "Còn nợ" : "Đã xong"}</span></td>
          </tr>
        `,
        )
        .join("")}</tbody>
    </table>`;
}

function sessionsTable(rows) {
  if (!rows.length) return `<div class="empty">Chưa có buổi nào</div>`;
  return `
    <table style="min-width:520px">
      <thead><tr><th>Ngày</th><th>Buổi</th><th class="num">Cầu</th><th class="num">Nước</th><th class="num">Tiền nước</th></tr></thead>
      <tbody>${rows
        .map(
          (row) => `
          <tr><td>${row.session_date}</td><td>${row.title}</td><td class="num">${row.shuttle_count || 0}</td><td class="num">${row.bottle_count || 0}</td><td class="num">${formatMoney(row.water_expense)}</td></tr>
        `,
        )
        .join("")}</tbody>
    </table>`;
}

function transactionsTable(rows) {
  if (!rows.length) return `<div class="empty">Chưa có thu chi</div>`;
  return `
    <table style="min-width:540px">
      <thead><tr><th>Ngày</th><th>Loại</th><th>Nội dung</th><th class="num">Số tiền</th></tr></thead>
      <tbody>${rows
        .slice(0, 12)
        .map(
          (row) => `
          <tr><td>${row.transaction_date}</td><td>${row.type === "income" ? "Thu" : "Chi"}</td><td>${row.category}</td><td class="num">${formatMoney(row.amount)}</td></tr>
        `,
        )
        .join("")}</tbody>
    </table>`;
}

function memberType(type) {
  return {
    monthly: "Cố định tháng",
    half_month: "Cố định nửa tháng",
    guest: "Vãng lai",
  }[type] || type;
}

function initDashboard() {
  const monthInput = document.querySelector("#month");
  if (!monthInput) return;
  monthInput.value = currentMonth();
  monthInput.addEventListener("change", loadDashboard);
  document.querySelector("#reload")?.addEventListener("click", loadDashboard);
  loadDashboard();
}

function initImport() {
  const form = document.querySelector("#import-form");
  if (!form) return;
  const keyInput = document.querySelector("#admin-key");
  const jsonInput = document.querySelector("#import-json");
  const result = document.querySelector("#result");
  keyInput.value = rememberKey("badminton_admin_key");
  jsonInput.value = JSON.stringify(
    {
      date: currentMonth() + "-22",
      title: "Tối thứ 2",
      shuttleCount: 4,
      bottleCount: 18,
      waterExpense: 120000,
      players: [
        { name: "Thành viên 01", potDue: 30000 },
        { name: "Thành viên 02", potDue: 20000 },
        { name: "Thành viên 20", potDue: 25000 },
      ],
      note: "Dữ liệu nhập từ ảnh sau buổi",
    },
    null,
    2,
  );

  async function submit(dryRun) {
    result.textContent = "Đang xử lý...";
    const payload = JSON.parse(jsonInput.value);
    payload.dryRun = dryRun;
    localStorage.setItem("badminton_admin_key", keyInput.value);
    const response = await requestJson(`/api/admin-import?key=${encodeURIComponent(keyInput.value)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    result.textContent = JSON.stringify(response, null, 2);
  }

  document.querySelector("#dry-run")?.addEventListener("click", async () => {
    try {
      await submit(true);
    } catch (error) {
      result.textContent = error.message;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await submit(false);
      form.reset();
      keyInput.value = rememberKey("badminton_admin_key");
    } catch (error) {
      result.textContent = error.message;
    }
  });
}

function initAccounting() {
  const form = document.querySelector("#accounting-form");
  if (!form) return;
  const keyInput = document.querySelector("#accountant-key");
  const result = document.querySelector("#result");
  keyInput.value = rememberKey("badminton_accountant_key");
  document.querySelector("#tx-date").value = new Date().toISOString().slice(0, 10);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.textContent = "Đang lưu...";
    localStorage.setItem("badminton_accountant_key", keyInput.value);
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await requestJson(`/api/transactions?key=${encodeURIComponent(keyInput.value)}`, {
        method: "POST",
        body: JSON.stringify({
          date: data.date,
          type: data.type,
          member: data.member,
          category: data.category,
          amount: Number(data.amount),
          note: data.note,
        }),
      });
      result.textContent = JSON.stringify(response, null, 2);
      form.reset();
      keyInput.value = rememberKey("badminton_accountant_key");
      document.querySelector("#tx-date").value = new Date().toISOString().slice(0, 10);
    } catch (error) {
      result.textContent = error.message;
    }
  });
}

function settingValue(settings, key, fallback) {
  const row = settings.find((item) => item.key === key);
  return row?.value ?? fallback;
}

function membersToCsv(members) {
  return ["code,name,gender,membership_type,active"]
    .concat(
      members.map((member) =>
        [member.code, member.name, member.gender, member.membership_type, member.active]
          .map((value) => String(value ?? "").replaceAll('"', '""'))
          .map((value) => (value.includes(",") ? `"${value}"` : value))
          .join(","),
      ),
    )
    .join("\n");
}

function parseCsvLine(line) {
  const result = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  result.push(value.trim());
  return result;
}

function parseMembersCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dataLines = lines[0]?.toLowerCase().startsWith("code,") ? lines.slice(1) : lines;
  return dataLines.map((line) => {
    const [code, name, gender, membershipType, active = "true"] = parseCsvLine(line);
    return {
      code,
      name,
      gender,
      membership_type: membershipType,
      active,
    };
  });
}

function initSetup() {
  const form = document.querySelector("#setup-form");
  if (!form) return;
  const keyInput = document.querySelector("#setup-key");
  const result = document.querySelector("#result");
  keyInput.value = rememberKey("badminton_admin_key");

  const setDefaults = () => {
    document.querySelector("#monthly-fee").value = 500000;
    document.querySelector("#half-month-fee").value = 250000;
    document.querySelector("#guest-male-fee").value = 70000;
    document.querySelector("#guest-female-fee").value = 50000;
    document.querySelector("#members-csv").value = membersToCsv(
      Array.from({ length: 30 }, (_, index) => {
        const i = index + 1;
        return {
          code: `TV${String(i).padStart(2, "0")}`,
          name: `Thành viên ${String(i).padStart(2, "0")}`,
          gender: i % 5 === 0 ? "Nữ" : "Nam",
          membership_type: i <= 12 ? "monthly" : i <= 18 ? "half_month" : "guest",
          active: true,
        };
      }),
    );
  };
  setDefaults();

  async function loadSetup() {
    result.textContent = "Đang tải cấu hình...";
    localStorage.setItem("badminton_admin_key", keyInput.value);
    const response = await requestJson(`/api/admin-setup?key=${encodeURIComponent(keyInput.value)}`);
    document.querySelector("#monthly-fee").value = settingValue(response.settings, "monthly_fee", 500000);
    document.querySelector("#half-month-fee").value = settingValue(response.settings, "half_month_fee", 250000);
    document.querySelector("#guest-male-fee").value = settingValue(response.settings, "guest_male_fee", 70000);
    document.querySelector("#guest-female-fee").value = settingValue(response.settings, "guest_female_fee", 50000);
    document.querySelector("#members-csv").value = membersToCsv(response.members);
    result.textContent = JSON.stringify({ ok: true, loadedMembers: response.members.length }, null, 2);
  }

  document.querySelector("#load-setup")?.addEventListener("click", async () => {
    try {
      await loadSetup();
    } catch (error) {
      result.textContent = error.message;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.textContent = "Đang lưu...";
    localStorage.setItem("badminton_admin_key", keyInput.value);
    const payload = {
      settings: [
        { key: "monthly_fee", value: document.querySelector("#monthly-fee").value, description: "Cố định 1 tháng" },
        { key: "half_month_fee", value: document.querySelector("#half-month-fee").value, description: "Cố định nửa tháng" },
        { key: "guest_male_fee", value: document.querySelector("#guest-male-fee").value, description: "Vãng lai nam mỗi buổi" },
        { key: "guest_female_fee", value: document.querySelector("#guest-female-fee").value, description: "Vãng lai nữ mỗi buổi" },
      ],
      members: parseMembersCsv(document.querySelector("#members-csv").value),
    };
    try {
      const response = await requestJson(`/api/admin-setup?key=${encodeURIComponent(keyInput.value)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      result.textContent = JSON.stringify(response, null, 2);
    } catch (error) {
      result.textContent = error.message;
    }
  });
}

initDashboard();
initImport();
initAccounting();
initSetup();
