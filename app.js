const money = new Intl.NumberFormat("vi-VN");

function formatMoney(value) {
  return `${money.format(Math.round(Number(value || 0)))}đ`;
}

function plainTransferText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selected(value, current) {
  return value === current ? "selected" : "";
}

function copyAttr(value) {
  return encodeURIComponent(String(value ?? ""));
}

function renderError(container, error) {
  container.innerHTML = `<div class="empty">Không tải được dữ liệu: ${escapeHtml(error.message)}</div>`;
}

async function loadDashboard() {
  const monthInput = document.querySelector("#month");
  const root = document.querySelector("#dashboard");
  monthInput.value ||= currentMonth();

  try {
    root.innerHTML = `<div class="empty">Đang tải...</div>`;
    const payload = await requestJson(`/api/public-data?month=${monthInput.value}`);
    const { totals, balances, sessions, transactions, payment } = payload.data;
    const selectedId = localStorage.getItem("badminton_selected_member");
    const selectedMember = balances.find((row) => row.id === selectedId) || balances.find((row) => row.balance > 0) || balances[0];
    root.innerHTML = `
      <section class="hero-dashboard">
        ${memberPaymentPanel(selectedMember, balances, payment, monthInput.value)}
        <div class="fund-overview">
          <div class="overview-card debt">
            <span>Còn phải thu</span>
            <strong>${formatMoney(totals.memberDebt)}</strong>
            <small>${totals.debtors} người còn nợ</small>
          </div>
          <div class="overview-card">
            <span>Đã thu</span>
            <strong>${formatMoney(totals.totalPaid)}</strong>
            <small>Trong tháng đang xem</small>
          </div>
          <div class="overview-card">
            <span>Quỹ tháng này</span>
            <strong>${formatMoney(totals.fundBalance)}</strong>
            <small>Thu - chi</small>
          </div>
        </div>
      </section>

      <section class="grid summary-grid dashboard-metrics">
        <div class="metric blue"><div class="label">Tổng phải thu</div><div class="value">${formatMoney(totals.totalDue)}</div><div class="muted">${totals.activeMembers} thành viên</div></div>
        <div class="metric"><div class="label">Tổng tiền kèo</div><div class="value">${formatMoney(totals.potDue)}</div><div class="muted">Từ dữ liệu buổi</div></div>
        <div class="metric"><div class="label">Kèo còn lại</div><div class="value">${formatMoney(totals.potRemaining)}</div><div class="muted">Sau nước và chi kèo</div></div>
        <div class="metric amber"><div class="label">Số buổi</div><div class="value">${totals.sessions}</div><div class="muted">Trong tháng đang xem</div></div>
      </section>

      <section class="grid two-col dashboard-content">
        <div class="panel">
          <div class="panel-header"><h2>Công nợ thành viên</h2><span class="muted">${balances.length} người</span></div>
          ${balanceCards(balances, payment, monthInput.value)}
          <div class="table-wrap desktop-only">${balanceTable(balances)}</div>
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
    bindDashboardActions(root);
  } catch (error) {
    renderError(root, error);
  }
}

function transferContent(row, payment, month) {
  const prefix = payment?.transferPrefix || "CAULONG";
  return plainTransferText(`${prefix} ${row?.code || ""} ${row?.name || ""} ${month}`);
}

function paymentQrUrl(row, payment, month) {
  if (!row?.balance || !payment?.bankCode || !payment?.bankAccount) return "";
  const amount = Math.max(0, Math.round(Number(row.balance || 0)));
  const info = encodeURIComponent(transferContent(row, payment, month));
  const owner = encodeURIComponent(payment.bankOwner || "");
  return `https://img.vietqr.io/image/${encodeURIComponent(payment.bankCode)}-${encodeURIComponent(payment.bankAccount)}-compact2.png?amount=${amount}&addInfo=${info}&accountName=${owner}`;
}

function memberPaymentPanel(row, rows, payment, month) {
  if (!rows.length) {
    return `<div class="payment-panel"><div class="empty">Chưa có thành viên</div></div>`;
  }
  const debt = Math.max(0, Number(row?.balance || 0));
  const content = transferContent(row, payment, month);
  const accountReady = payment?.bankCode && payment?.bankAccount;
  const qrUrl = paymentQrUrl(row, payment, month);
  return `
    <div class="payment-panel">
      <div class="payment-main">
        <div class="field member-picker">
          <label for="member-select">👇 Chọn tên của bạn để xem công nợ</label>
          <input id="member-search" type="search" placeholder="Gõ tên để tìm nhanh..." autocomplete="off" />
          <select id="member-select">
            ${rows.map((item) => `<option value="${item.id}" ${selected(item.id, row?.id)}>${escapeHtml(item.name)} — còn nợ ${formatMoney(item.balance)}</option>`).join("")}
          </select>
        </div>
        <div>
          <p class="eyebrow">Số tiền bạn cần chuyển</p>
          <div class="debt-amount ${debt > 0 ? "" : "paid"}">${formatMoney(debt)}</div>
          <p class="payment-note">${debt > 0 ? "Quét QR hoặc copy số tiền & nội dung bên dưới để chuyển khoản." : "🎉 Bạn đã đóng đủ trong tháng này."}</p>
        </div>
        <dl class="debt-breakdown">
          <div><dt>Cố định</dt><dd>${formatMoney(row?.fixedDue || 0)}</dd></div>
          <div><dt>Phí buổi</dt><dd>${formatMoney(row?.sessionDue || 0)}</dd></div>
          <div><dt>Quỹ kèo</dt><dd>${formatMoney(row?.potDue || 0)}</dd></div>
          <div class="paid-cell"><dt>Đã đóng</dt><dd>${formatMoney(row?.paid || 0)}</dd></div>
        </dl>
        <div class="quick-copy">
          <button class="primary" type="button" data-copy="${copyAttr(debt)}">Copy số tiền</button>
          <button type="button" data-copy="${copyAttr(content)}">Copy nội dung</button>
          <button type="button" data-copy="${copyAttr(paymentInfoText(row, payment, month))}">Copy tất cả</button>
        </div>
        <dl class="payment-details">
          <div><dt>Ngân hàng</dt><dd>${accountReady ? escapeHtml(payment.bankCode) : "Chưa cấu hình"}</dd></div>
          <div><dt>Số TK</dt><dd>${payment?.bankAccount ? escapeHtml(payment.bankAccount) : "Chưa cấu hình"}</dd></div>
          <div><dt>Chủ TK</dt><dd>${payment?.bankOwner ? escapeHtml(payment.bankOwner) : "Chưa cấu hình"}</dd></div>
          <div><dt>Nội dung</dt><dd>${escapeHtml(content)}</dd></div>
        </dl>
      </div>
      <div class="qr-box">
        ${
          qrUrl
            ? `<img src="${qrUrl}" alt="QR chuyển khoản cho ${escapeHtml(row.name)}" />`
            : `<div class="qr-placeholder"><strong>QR chuyển khoản</strong><span>Nhập mã ngân hàng và số tài khoản trong Cấu hình đội để hiện QR tự động.</span></div>`
        }
      </div>
    </div>`;
}

function paymentInfoText(row, payment, month) {
  return [
    `So tien: ${Math.max(0, Math.round(Number(row?.balance || 0)))}`,
    `Noi dung: ${transferContent(row, payment, month)}`,
    payment?.bankCode ? `Ngan hang: ${payment.bankCode}` : "",
    payment?.bankAccount ? `So TK: ${payment.bankAccount}` : "",
    payment?.bankOwner ? `Chu TK: ${payment.bankOwner}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function balanceCards(rows, payment, month) {
  if (!rows.length) return `<div class="empty">Chưa có thành viên</div>`;
  return `
    <div class="balance-cards">
      ${rows
        .map((row) => {
          const debt = Math.max(0, Number(row.balance || 0));
          return `
            <article class="balance-card ${debt > 0 ? "has-debt" : "is-paid"}">
              <div>
                <strong>${escapeHtml(row.name)}</strong>
                <span>${escapeHtml(row.code)} · ${memberType(row.membershipType)}</span>
              </div>
              <div class="balance-card-amount">
                <b>${formatMoney(debt)}</b>
                <button type="button" data-copy="${copyAttr(paymentInfoText(row, payment, month))}">${debt > 0 ? "Copy CK" : "Đã xong"}</button>
              </div>
            </article>`;
        })
        .join("")}
    </div>`;
}

function bindDashboardActions(root) {
  const memberSelect = root.querySelector("#member-select");
  memberSelect?.addEventListener("change", (event) => {
    localStorage.setItem("badminton_selected_member", event.target.value);
    loadDashboard();
  });

  root.querySelector("#member-search")?.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    let firstVisible = null;
    Array.from(memberSelect?.options || []).forEach((option) => {
      const match = option.textContent.toLowerCase().includes(query);
      option.hidden = !match;
      if (match && !firstVisible) firstVisible = option;
    });
    if (query && firstVisible) firstVisible.selected = true;
  });

  root.querySelectorAll("button[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const text = decodeURIComponent(button.dataset.copy || "");
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const input = document.createElement("textarea");
          input.value = text;
          document.body.appendChild(input);
          input.select();
          document.execCommand("copy");
          input.remove();
        }
        const original = button.textContent;
        button.textContent = "Đã copy";
        setTimeout(() => {
          button.textContent = original;
        }, 1200);
      } catch (error) {
        alert("Không copy được. Hãy sao chép thủ công.");
      }
    });
  });
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
  const keyField = document.querySelector("#accountant-key-field");
  const keyStatus = document.querySelector("#accountant-key-status");
  const changeKey = document.querySelector("#change-accountant-key");
  const typeInput = document.querySelector("#tx-type");
  const categoryInput = document.querySelector("#tx-category");
  const customCategoryInput = document.querySelector("#tx-category-custom");
  const amountInput = document.querySelector("#tx-amount");
  const categoryTable = document.querySelector("#accounting-categories");
  const guard = document.querySelector("#accounting-guard");
  const result = document.querySelector("#result");
  keyInput.value = rememberKey("badminton_admin_key");
  document.querySelector("#tx-date").value = new Date().toISOString().slice(0, 10);
  let categories = [];

  function effectiveKey() {
    return keyInput.value || localStorage.getItem("badminton_admin_key") || "";
  }

  function refreshKeyUi() {
    const hasKey = Boolean(effectiveKey());
    keyInput.required = !hasKey;
    keyField.hidden = hasKey;
    keyStatus.hidden = !hasKey;
    if (guard) guard.hidden = hasKey;
  }

  function renderCategoryOptions() {
    const currentType = typeInput.value === "Chi" ? "expense" : "income";
    const rows = categories.filter((category) => category.type === currentType);
    categoryInput.innerHTML = rows
      .map(
        (category) =>
          `<option value="${category.id}" data-amount="${Number(category.default_amount || 0)}">${escapeHtml(category.name)}</option>`,
      )
      .concat(`<option value="__custom">Khác...</option>`)
      .join("");
    updateAmountFromCategory();
  }

  function updateAmountFromCategory() {
    const option = categoryInput.selectedOptions[0];
    const amount = Number(option?.dataset.amount || 0);
    const isCustom = categoryInput.value === "__custom";
    customCategoryInput.disabled = !isCustom;
    customCategoryInput.required = isCustom;
    if (!isCustom) customCategoryInput.value = "";
    if (amount > 0) amountInput.value = amount;
  }

  async function loadAccountingCategories() {
    const response = await requestJson("/api/transaction-categories");
    categories = response.categories || [];
    renderCategoryOptions();
    categoryTable.innerHTML = transactionCategoryTable(categories.filter((category) => category.active));
  }

  refreshKeyUi();
  loadAccountingCategories().catch((error) => {
    categoryTable.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  });

  changeKey?.addEventListener("click", () => {
    localStorage.removeItem("badminton_admin_key");
    keyInput.value = "";
    refreshKeyUi();
    keyInput.focus();
  });

  typeInput.addEventListener("change", renderCategoryOptions);
  categoryInput.addEventListener("change", updateAmountFromCategory);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.textContent = "Đang lưu...";
    const key = effectiveKey();
    if (!key) {
      result.textContent = "Chưa đăng nhập quản trị. Hãy đăng nhập tại /admin rồi quay lại.";
      refreshKeyUi();
      return;
    }
    localStorage.setItem("badminton_admin_key", key);
    const data = Object.fromEntries(new FormData(form).entries());
    const selectedCategory = categories.find((category) => category.id === data.categoryId);
    try {
      const response = await requestJson(`/api/transactions?key=${encodeURIComponent(key)}`, {
        method: "POST",
        body: JSON.stringify({
          date: data.date,
          type: data.type,
          member: data.member,
          categoryId: data.categoryId && data.categoryId !== "__custom" ? data.categoryId : undefined,
          category: data.category || selectedCategory?.name,
          amount: Number(data.amount),
          note: data.note,
        }),
      });
      result.textContent = JSON.stringify(response, null, 2);
      form.reset();
      keyInput.value = key;
      document.querySelector("#tx-date").value = new Date().toISOString().slice(0, 10);
      refreshKeyUi();
      renderCategoryOptions();
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
    document.querySelector("#bank-code").value = "";
    document.querySelector("#bank-account").value = "";
    document.querySelector("#bank-owner").value = "";
    document.querySelector("#transfer-prefix").value = "CAULONG";
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
    document.querySelector("#bank-code").value = settingValue(response.settings, "bank_code", "");
    document.querySelector("#bank-account").value = settingValue(response.settings, "bank_account", "");
    document.querySelector("#bank-owner").value = settingValue(response.settings, "bank_owner", "");
    document.querySelector("#transfer-prefix").value = settingValue(response.settings, "transfer_prefix", "CAULONG");
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
        { key: "bank_code", value: document.querySelector("#bank-code").value, description: "Mã ngân hàng VietQR" },
        { key: "bank_account", value: document.querySelector("#bank-account").value, description: "Số tài khoản nhận tiền" },
        { key: "bank_owner", value: document.querySelector("#bank-owner").value, description: "Tên chủ tài khoản nhận tiền" },
        { key: "transfer_prefix", value: document.querySelector("#transfer-prefix").value || "CAULONG", description: "Tiền tố nội dung chuyển khoản" },
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

function typeLabel(type) {
  return type === "income" ? "Thu" : "Chi";
}

function transactionCategoryTable(rows) {
  if (!rows.length) return `<div class="empty">Chưa có hạng mục tiền</div>`;
  return `
    <table style="min-width:620px">
      <thead><tr><th>Loại</th><th>Hạng mục</th><th class="num">Mặc định</th><th>Trạng thái</th></tr></thead>
      <tbody>${rows
        .map(
          (row) => `
          <tr>
            <td>${typeLabel(row.type)}</td>
            <td>${escapeHtml(row.name)}</td>
            <td class="num">${formatMoney(row.default_amount)}</td>
            <td><span class="status ${row.active ? "ok" : "debt"}">${row.active ? "Đang dùng" : "Đã ẩn"}</span></td>
          </tr>
        `,
        )
        .join("")}</tbody>
    </table>`;
}

function initMembersAdmin() {
  const form = document.querySelector("#member-form");
  if (!form) return;
  const keyInput = document.querySelector("#member-key");
  const result = document.querySelector("#member-result");
  const table = document.querySelector("#members-table");
  const count = document.querySelector("#member-count");
  const deleteButton = document.querySelector("#delete-member");
  let members = [];

  keyInput.value = rememberKey("badminton_admin_key");

  function key() {
    return keyInput.value;
  }

  function clearForm() {
    document.querySelector("#member-id").value = "";
    document.querySelector("#member-code").value = "";
    document.querySelector("#member-name").value = "";
    document.querySelector("#member-gender").value = "Nam";
    document.querySelector("#member-type").value = "monthly";
    document.querySelector("#member-active").checked = true;
    deleteButton.disabled = true;
  }

  function fillForm(member) {
    document.querySelector("#member-id").value = member.id;
    document.querySelector("#member-code").value = member.code || "";
    document.querySelector("#member-name").value = member.name || "";
    document.querySelector("#member-gender").value = member.gender || "Nam";
    document.querySelector("#member-type").value = member.membership_type || "monthly";
    document.querySelector("#member-active").checked = member.active !== false;
    deleteButton.disabled = false;
  }

  function renderMembers() {
    count.textContent = `${members.length} người`;
    if (!members.length) {
      table.innerHTML = `<div class="empty">Chưa có thành viên</div>`;
      return;
    }
    table.innerHTML = `
      <table>
        <thead><tr><th>Mã</th><th>Tên</th><th>Giới tính</th><th>Loại</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>${members
          .map(
            (member) => `
            <tr>
              <td>${escapeHtml(member.code)}</td>
              <td>${escapeHtml(member.name)}</td>
              <td>${escapeHtml(member.gender)}</td>
              <td>${memberType(member.membership_type)}</td>
              <td><span class="status ${member.active ? "ok" : "debt"}">${member.active ? "Đang chơi" : "Đã nghỉ"}</span></td>
              <td><div class="row-actions">
                <button type="button" data-action="edit" data-id="${member.id}">Sửa</button>
                <button class="danger" type="button" data-action="delete" data-id="${member.id}">Xóa</button>
              </div></td>
            </tr>
          `,
          )
          .join("")}</tbody>
      </table>`;
  }

  async function loadMembers() {
    result.textContent = "Đang tải...";
    localStorage.setItem("badminton_admin_key", key());
    const response = await requestJson(`/api/members?key=${encodeURIComponent(key())}`);
    members = response.members || [];
    renderMembers();
    result.textContent = JSON.stringify({ ok: true, loadedMembers: members.length }, null, 2);
  }

  async function softDeleteMember(id) {
    result.textContent = "Đang xóa...";
    const response = await requestJson(`/api/members?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key())}`, {
      method: "DELETE",
    });
    result.textContent = JSON.stringify(response, null, 2);
    clearForm();
    await loadMembers();
  }

  document.querySelector("#load-members")?.addEventListener("click", () => loadMembers().catch((error) => (result.textContent = error.message)));
  document.querySelector("#new-member")?.addEventListener("click", clearForm);
  deleteButton.addEventListener("click", () => {
    const id = document.querySelector("#member-id").value;
    if (id) softDeleteMember(id).catch((error) => (result.textContent = error.message));
  });

  table.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const member = members.find((item) => item.id === button.dataset.id);
    if (!member) return;
    if (button.dataset.action === "edit") fillForm(member);
    if (button.dataset.action === "delete") softDeleteMember(member.id).catch((error) => (result.textContent = error.message));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.textContent = "Đang lưu...";
    localStorage.setItem("badminton_admin_key", key());
    const id = document.querySelector("#member-id").value;
    const payload = {
      code: document.querySelector("#member-code").value,
      name: document.querySelector("#member-name").value,
      gender: document.querySelector("#member-gender").value,
      membership_type: document.querySelector("#member-type").value,
      active: document.querySelector("#member-active").checked,
    };
    try {
      const response = await requestJson(
        id ? `/api/members?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key())}` : `/api/members?key=${encodeURIComponent(key())}`,
        {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      result.textContent = JSON.stringify(response, null, 2);
      clearForm();
      await loadMembers();
    } catch (error) {
      result.textContent = error.message;
    }
  });

  clearForm();
  if (key()) loadMembers().catch((error) => (result.textContent = error.message));
}

function initCategoriesAdmin() {
  const form = document.querySelector("#category-form");
  if (!form) return;
  const keyInput = document.querySelector("#category-key");
  const result = document.querySelector("#category-result");
  const table = document.querySelector("#categories-table");
  const count = document.querySelector("#category-count");
  const deleteButton = document.querySelector("#delete-category");
  let categories = [];

  keyInput.value = rememberKey("badminton_admin_key");

  function key() {
    return keyInput.value;
  }

  function clearForm() {
    document.querySelector("#category-id").value = "";
    document.querySelector("#category-type").value = "expense";
    document.querySelector("#category-name").value = "";
    document.querySelector("#category-amount").value = 0;
    document.querySelector("#category-sort").value = 100;
    document.querySelector("#category-note").value = "";
    document.querySelector("#category-active").checked = true;
    deleteButton.disabled = true;
  }

  function fillForm(category) {
    document.querySelector("#category-id").value = category.id;
    document.querySelector("#category-type").value = category.type;
    document.querySelector("#category-name").value = category.name || "";
    document.querySelector("#category-amount").value = Number(category.default_amount || 0);
    document.querySelector("#category-sort").value = Number(category.sort_order || 100);
    document.querySelector("#category-note").value = category.note || "";
    document.querySelector("#category-active").checked = category.active !== false;
    deleteButton.disabled = false;
  }

  function renderCategories() {
    count.textContent = `${categories.length} hạng mục`;
    if (!categories.length) {
      table.innerHTML = `<div class="empty">Chưa có hạng mục</div>`;
      return;
    }
    table.innerHTML = `
      <table>
        <thead><tr><th>Loại</th><th>Hạng mục</th><th class="num">Mặc định</th><th class="num">Thứ tự</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>${categories
          .map(
            (category) => `
            <tr>
              <td>${typeLabel(category.type)}</td>
              <td>${escapeHtml(category.name)}</td>
              <td class="num">${formatMoney(category.default_amount)}</td>
              <td class="num">${Number(category.sort_order || 0)}</td>
              <td><span class="status ${category.active ? "ok" : "debt"}">${category.active ? "Đang dùng" : "Đã ẩn"}</span></td>
              <td><div class="row-actions">
                <button type="button" data-action="edit" data-id="${category.id}">Sửa</button>
                <button class="danger" type="button" data-action="delete" data-id="${category.id}">Xóa</button>
              </div></td>
            </tr>
          `,
          )
          .join("")}</tbody>
      </table>`;
  }

  async function loadCategories() {
    result.textContent = "Đang tải...";
    localStorage.setItem("badminton_admin_key", key());
    const response = await requestJson(`/api/transaction-categories?key=${encodeURIComponent(key())}`);
    categories = response.categories || [];
    renderCategories();
    result.textContent = JSON.stringify({ ok: true, loadedCategories: categories.length }, null, 2);
  }

  async function deleteCategory(id) {
    result.textContent = "Đang xóa...";
    const response = await requestJson(`/api/transaction-categories?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key())}`, {
      method: "DELETE",
    });
    result.textContent = JSON.stringify(response, null, 2);
    clearForm();
    await loadCategories();
  }

  document
    .querySelector("#load-categories")
    ?.addEventListener("click", () => loadCategories().catch((error) => (result.textContent = error.message)));
  document.querySelector("#new-category")?.addEventListener("click", clearForm);
  deleteButton.addEventListener("click", () => {
    const id = document.querySelector("#category-id").value;
    if (id) deleteCategory(id).catch((error) => (result.textContent = error.message));
  });

  table.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const category = categories.find((item) => item.id === button.dataset.id);
    if (!category) return;
    if (button.dataset.action === "edit") fillForm(category);
    if (button.dataset.action === "delete") deleteCategory(category.id).catch((error) => (result.textContent = error.message));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.textContent = "Đang lưu...";
    localStorage.setItem("badminton_admin_key", key());
    const id = document.querySelector("#category-id").value;
    const payload = {
      type: document.querySelector("#category-type").value,
      name: document.querySelector("#category-name").value,
      defaultAmount: Number(document.querySelector("#category-amount").value),
      sortOrder: Number(document.querySelector("#category-sort").value),
      note: document.querySelector("#category-note").value,
      active: document.querySelector("#category-active").checked,
    };
    try {
      const response = await requestJson(
        id
          ? `/api/transaction-categories?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key())}`
          : `/api/transaction-categories?key=${encodeURIComponent(key())}`,
        {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      result.textContent = JSON.stringify(response, null, 2);
      clearForm();
      await loadCategories();
    } catch (error) {
      result.textContent = error.message;
    }
  });

  clearForm();
  if (key()) loadCategories().catch((error) => (result.textContent = error.message));
}

function initAdminHub() {
  const login = document.querySelector("#admin-login");
  const hub = document.querySelector("#admin-hub");
  if (!login || !hub) return;
  const form = document.querySelector("#admin-login-form");
  const passwordInput = document.querySelector("#admin-password");
  const errorBox = document.querySelector("#admin-login-error");
  const logout = document.querySelector("#admin-logout");
  const submitBtn = form.querySelector("button[type=submit]");

  function showHub() {
    login.hidden = true;
    hub.hidden = false;
  }

  function showLogin(message) {
    hub.hidden = true;
    login.hidden = false;
    if (message) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    } else {
      errorBox.hidden = true;
    }
  }

  function validateKey(key) {
    return requestJson(`/api/members?key=${encodeURIComponent(key)}`);
  }

  const stored = rememberKey("badminton_admin_key");
  if (stored) {
    validateKey(stored)
      .then(showHub)
      .catch(() => {
        localStorage.removeItem("badminton_admin_key");
        showLogin();
      });
  } else {
    showLogin();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    const key = passwordInput.value.trim();
    if (!key) return;
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang kiểm tra...";
    try {
      await validateKey(key);
      localStorage.setItem("badminton_admin_key", key);
      passwordInput.value = "";
      showHub();
    } catch (error) {
      showLogin("Mật khẩu không đúng. Vui lòng thử lại.");
      passwordInput.focus();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Đăng nhập";
    }
  });

  logout?.addEventListener("click", () => {
    localStorage.removeItem("badminton_admin_key");
    showLogin();
  });
}

function initAttendance() {
  const form = document.querySelector("#attendance-form");
  if (!form) return;
  const guard = document.querySelector("#attendance-guard");
  const listBox = document.querySelector("#attendance-list");
  const tickAll = document.querySelector("#att-tick-all");
  const search = document.querySelector("#att-search");
  const countLabel = document.querySelector("#att-selected-count");
  const result = document.querySelector("#att-result");
  const key = rememberKey("badminton_admin_key");
  document.querySelector("#att-date").value = new Date().toISOString().slice(0, 10);
  let members = [];
  const checkedIds = new Set();

  if (!key) {
    guard.hidden = false;
    form.hidden = true;
    return;
  }
  guard.hidden = true;
  form.hidden = false;

  function matchesSearch(member) {
    const q = (search.value || "").trim().toLowerCase();
    if (!q) return true;
    return `${member.code} ${member.name}`.toLowerCase().includes(q);
  }

  function updateCount() {
    countLabel.textContent = `Đã chọn ${checkedIds.size} người`;
    const visible = members.filter(matchesSearch);
    tickAll.checked = visible.length > 0 && visible.every((member) => checkedIds.has(member.id));
  }

  function renderList() {
    if (!members.length) {
      listBox.innerHTML = `<div class="empty">Chưa có thành viên</div>`;
      return;
    }
    const rows = members.filter(matchesSearch);
    if (!rows.length) {
      listBox.innerHTML = `<div class="empty">Không tìm thấy thành viên</div>`;
      updateCount();
      return;
    }
    listBox.innerHTML = rows
      .map(
        (member) => `
          <label class="attendance-row ${checkedIds.has(member.id) ? "checked" : ""}">
            <input type="checkbox" data-id="${member.id}" ${checkedIds.has(member.id) ? "checked" : ""} />
            <span class="attendance-name">${escapeHtml(member.name)}</span>
            <span class="attendance-meta">${escapeHtml(member.code)} · ${memberType(member.membership_type)}</span>
          </label>`,
      )
      .join("");
    updateCount();
  }

  async function loadMembers() {
    listBox.innerHTML = `<div class="empty">Đang tải...</div>`;
    const response = await requestJson(`/api/members?key=${encodeURIComponent(key)}`);
    members = (response.members || []).filter((member) => member.active !== false);
    renderList();
  }

  listBox.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[type=checkbox]");
    if (!checkbox) return;
    const id = checkbox.dataset.id;
    if (checkbox.checked) checkedIds.add(id);
    else checkedIds.delete(id);
    checkbox.closest(".attendance-row")?.classList.toggle("checked", checkbox.checked);
    updateCount();
  });

  tickAll.addEventListener("change", () => {
    members.filter(matchesSearch).forEach((member) => {
      if (tickAll.checked) checkedIds.add(member.id);
      else checkedIds.delete(member.id);
    });
    renderList();
  });

  search.addEventListener("input", renderList);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!checkedIds.size) {
      result.textContent = "Hãy tick ít nhất một người tham gia.";
      return;
    }
    const players = members
      .filter((member) => checkedIds.has(member.id))
      .map((member) => ({ code: member.code, name: member.name, attended: true }));
    const payload = {
      date: document.querySelector("#att-date").value,
      title: document.querySelector("#att-title").value || "Buổi cầu lông",
      shuttleCount: Number(document.querySelector("#att-shuttle").value || 0),
      bottleCount: Number(document.querySelector("#att-bottle").value || 0),
      waterExpense: Number(document.querySelector("#att-water").value || 0),
      potExpense: Number(document.querySelector("#att-pot").value || 0),
      note: document.querySelector("#att-note").value || "",
      players,
    };
    result.textContent = "Đang lưu...";
    try {
      const response = await requestJson(`/api/admin-import?key=${encodeURIComponent(key)}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      result.textContent = `Đã lưu buổi ${payload.date} với ${response.importedPlayers} người tham gia. Tổng tiền kèo ${formatMoney(response.potTotal || 0)}.`;
      checkedIds.clear();
      renderList();
    } catch (error) {
      result.textContent = error.message;
    }
  });

  loadMembers().catch((error) => {
    listBox.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  });
}

initDashboard();
initImport();
initAccounting();
initSetup();
initMembersAdmin();
initCategoriesAdmin();
initAdminHub();
initAttendance();
