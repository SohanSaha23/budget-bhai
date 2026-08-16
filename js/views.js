/* ============ Paisa — views ============ */
"use strict";

const now0 = new Date();
const UI = {
  view: "home",
  stack: [],
  month: { y: now0.getFullYear(), m: now0.getMonth() },
  stats: { period: "monthly", anchor: D.todayISO() },
  statsType: "expense",
  splitsTab: "friends",
  splitPeriod: "monthly",
  transFilter: { q: "", type: "all", cat: "all", acc: "all" },
  groupId: null, friendId: null, accountId: null,
};

function monthSelector() {
  return `<div class="month-sel">
    <button data-action="month-prev">‹</button>
    <div class="m">${D.monthName(UI.month.y, UI.month.m)}</div>
    <button data-action="month-next">›</button>
  </div>`;
}

function txRow(t, showRunning) {
  let emoji, name, color, amtHtml, meta;
  const accName = Store.acc(t.accountId)?.name || "—";
  if (t.type === "transfer") {
    emoji = "🔁"; color = "#60a5fa";
    name = "Transfer";
    meta = accName + " → " + (Store.acc(t.toAccountId)?.name || "—");
    amtHtml = `<div class="amt" style="color:var(--blue)">${fmt(t.amount)}</div>`;
  } else {
    const c = Store.cat(t.categoryId);
    emoji = c.emoji; color = c.color;
    name = t.payee || c.name;
    meta = c.name + " · " + accName + (t.note ? " · " + t.note : "");
    amtHtml = t.type === "income"
      ? `<div class="amt pos">+${fmt(t.amount)}</div>`
      : `<div class="amt neg">−${fmt(t.amount)}</div>`;
  }
  return `<div class="tx" data-action="tx-detail" data-id="${t.id}">
    <div class="emo" style="background:${tint(color, .16)}">${emoji}</div>
    <div class="mid"><div class="nm">${esc(name)}</div><div class="meta">${esc(meta)}</div></div>
    ${amtHtml}
  </div>`;
}

/* buckets dated items into Daily / Weekly / Monthly sections, newest first */
function periodSections(items, period) {
  const groups = new Map();
  for (const it of items) {
    let key, label;
    if (period === "daily") {
      key = it.date; label = D.human(it.date);
    } else if (period === "weekly") {
      key = D.weekStart(it.date);
      label = D.short(key) + " – " + D.short(D.addDays(key, 6));
    } else {
      key = it.date.slice(0, 7);
      const [y, m] = key.split("-").map(Number);
      label = D.monthName(y, m - 1);
    }
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key).items.push(it);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] < b[0] ? 1 : -1)
    .map(([, v]) => v);
}

/* one row on a friend's page — shows only the amount owed between you two */
function friendActivityRow(it) {
  const f = Store.friend(UI.friendId);
  if (it.kind === "settle") {
    const theyPaid = it.from === UI.friendId;
    return `<div class="tx" data-action="settle-edit" data-id="${it.id}">
      <div class="emo" style="background:${tint("#34d399", .16)}">🤝</div>
      <div class="mid">
        <div class="nm">${theyPaid ? esc(f.name) + " paid you" : "You paid " + esc(f.name)}</div>
        <div class="meta">Settlement · ${D.human(it.date)} · tap to edit</div>
      </div>
      <div class="amt money">${fmt(it.amount)}</div>
    </div>`;
  }
  const iPaid = it.paidBy === "me";
  const whose = iPaid ? esc(f.name) + "'s share" : "your share";
  return `<div class="tx" data-action="split-detail" data-id="${it.id}">
    <div class="emo" style="background:${tint("#7c6bff", .16)}">🧾</div>
    <div class="mid">
      <div class="nm">${esc(it.desc)}</div>
      <div class="meta">${iPaid ? "You" : esc(f.name)} paid ${fmt(it.total)} · ${it.ways} ways · ${whose}</div>
    </div>
    <div class="amt money ${iPaid ? "pos" : "neg"}">${iPaid ? "+" : "−"}${fmt(it.share)}
      <div class="sub" style="font-weight:600;text-align:right">${iPaid ? "owes you" : "you owe"}</div>
    </div>
  </div>`;
}

/* one row on a group page — full bill, with your own share spelled out */
function groupActivityRow(it) {
  if (it.kind === "settle") {
    return `<div class="tx" data-action="settle-edit" data-id="${it.id}">
      <div class="emo" style="background:${tint("#34d399", .16)}">🤝</div>
      <div class="mid">
        <div class="nm">${esc(Store.friend(it.from)?.name || "?")} paid ${esc(Store.friend(it.to)?.name || "?")}</div>
        <div class="meta">Settlement · ${D.human(it.date)} · tap to edit</div>
      </div>
      <div class="amt money pos">${fmt(it.amount)}</div>
    </div>`;
  }
  const mine = it.shares.find(s => s.id === "me");
  const iPaid = it.paidBy === "me";
  return `<div class="tx" data-action="split-detail" data-id="${it.id}">
    <div class="emo" style="background:${tint("#7c6bff", .16)}">🧾</div>
    <div class="mid">
      <div class="nm">${esc(it.desc)}</div>
      <div class="meta">${iPaid ? "You" : esc(Store.friend(it.paidBy)?.name || "?")} paid · ${it.shares.length} ways${mine ? " · your share " + fmt(mine.amount) : " · not your split"}</div>
    </div>
    <div class="amt money">${fmt(it.amount)}</div>
  </div>`;
}

function periodTabs(active) {
  return `<div class="seg" style="margin-bottom:10px">
    ${["daily", "weekly", "monthly"].map(p =>
      `<button class="${active === p ? "on" : ""}" data-action="split-period" data-p="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`).join("")}
  </div>`;
}

/* renders one section: header + rows, with a per-section net total */
function sectionBlock(sec, rowFn, totalFn) {
  const total = totalFn ? totalFn(sec.items) : null;
  return `<div class="tx-group">
    <div class="tx-date"><span>${esc(sec.label)}</span>${total !== null ? `<span class="money">${total}</span>` : ""}</div>
    ${sec.items.map(rowFn).join("")}
  </div>`;
}

function groupTxByDate(list) {
  const groups = {};
  for (const t of list) (groups[t.date] = groups[t.date] || []).push(t);
  return Object.entries(groups).sort((a, b) => a[0] < b[0] ? 1 : -1).map(([date, txs]) => {
    const net = txs.reduce((s, t) => s + (t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0), 0);
    return `<div class="tx-group">
      <div class="tx-date"><span>${D.human(date)}</span><span class="money">${fmt(net, true)}</span></div>
      ${txs.map(t => txRow(t)).join("")}
    </div>`;
  }).join("");
}

const Views = {
  /* ================= HOME ================= */
  home() {
    const s = Store.state;
    const y = now0.getFullYear(), m = now0.getMonth();
    const inc = Store.monthTotal(y, m, "income"), exp = Store.monthTotal(y, m, "expense");
    const insights = Store.insights();
    const due = Store.dueRecurring();
    const upcoming = Store.upcomingRecurring(7);
    const overall = s.budgets.find(b => b.categoryId === "ALL");
    const st = overall ? Store.budgetStatus(overall, y, m) : null;
    const totals = Store.splitTotals();
    const recent = [...s.transactions].sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : -1).slice(0, 5);
    const spark = Store.dailySpend(14);

    return `
    <div class="page-head">
      <div class="title">
        <span class="sub">${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span>
        <span class="h1">Hi, ${esc(s.settings.name)} 👋</span>
      </div>
      <div class="head-actions">
        <button class="icon-btn" data-action="toggle-theme" title="Theme">
          <svg viewBox="0 0 24 24"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8Z"/></svg>
        </button>
        <button class="avatar" data-action="nav" data-view="more">${esc(initials(s.settings.name))}</button>
      </div>
    </div>

    <div class="card hero pop-in">
      <div class="sub">Total balance</div>
      <div class="balance money" id="hero-balance">${fmt(Store.netWorth())}</div>
      <div class="hero-stats">
        <div class="hero-pill">
          <div class="lab"><svg viewBox="0 0 24 24"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg> Income · ${D.monthName(y, m, true).split(" ")[0]}</div>
          <div class="val money">${fmt(inc)}</div>
        </div>
        <div class="hero-pill">
          <div class="lab"><svg viewBox="0 0 24 24"><path d="M12 5v14m0 0 6-6m-6 6-6-6"/></svg> Expense · ${D.monthName(y, m, true).split(" ")[0]}</div>
          <div class="val money">${fmt(exp)}</div>
        </div>
      </div>
    </div>

    ${due.length ? `<div class="card flat" style="border-color:rgba(251,191,36,.45)">
      <div class="card-row">
        <div><b>⏰ ${due.length} recurring payment${due.length > 1 ? "s" : ""} due</b>
        <div class="sub mt8">${due.map(r => esc(r.name) + " · " + fmt(r.amount)).join(" — ")}</div></div>
        <button class="btn primary sm" data-action="post-due">Add all</button>
      </div>
    </div>` : ""}

    ${insights.length ? `
    <div class="sec"><span class="h2">✨ Insights</span></div>
    <div class="hscroll">
      ${insights.map(i => `<div class="insight tone-${i.tone}"><div class="ic">${i.ic}</div><div class="t">${esc(i.t)}</div><div class="d">${esc(i.d)}</div></div>`).join("")}
    </div>` : ""}

    <div class="sec"><span class="h2">Accounts</span><button class="card-link" data-action="open-accounts">Manage</button></div>
    <div class="hscroll">
      ${s.accounts.map(a => {
        const t = ACCOUNT_TYPES.find(x => x.id === a.type);
        const bal = Store.accountBalance(a.id);
        return `<button class="acc-chip" data-action="account-detail" data-id="${a.id}">
          <div class="nm">${t ? t.emoji : "💰"} ${esc(a.name)}</div>
          <div class="bal money ${bal < 0 ? "neg" : ""}">${fmt(bal)}</div>
        </button>`;
      }).join("")}
      <button class="acc-add" data-action="add-account">+</button>
    </div>

    ${st ? `<div class="sec"><span class="h2">Budget</span><button class="card-link" data-action="nav" data-view="budgets">View all</button></div>
    <div class="card" data-action="nav" data-view="budgets">
      <div class="card-row mb8">
        <span class="sub">Monthly budget</span>
        <span class="sub"><b class="${st.over ? "neg" : ""}">${fmt(st.spent)}</b> / ${fmt(overall.amount)}</span>
      </div>
      <div class="bar big"><i style="width:${st.pct}%;background:${st.over ? "var(--red)" : st.pct >= 80 ? "var(--amber)" : "var(--green)"}"></i></div>
      <div class="sub mt8">${st.over ? "Over budget by " + fmt(-st.left) : fmt(st.left) + " left · " + fmt(Math.max(0, Math.floor(st.left / Math.max(1, D.daysInMonth(y, m) - now0.getDate() + 1)))) + "/day for " + (D.daysInMonth(y, m) - now0.getDate() + 1) + " days"}</div>
    </div>` : ""}

    <div class="sec"><span class="h2">Splits</span><button class="card-link" data-action="open-splits">Open</button></div>
    <div class="card" data-action="open-splits">
      <div class="card-row">
        <div>
          <div class="sub">You are owed</div>
          <div class="h2 pos money">${fmt(totals.owedToMe)}</div>
        </div>
        <div>
          <div class="sub">You owe</div>
          <div class="h2 neg money">${fmt(totals.iOwe)}</div>
        </div>
        <div class="avatars">
          ${s.friends.slice(0, 3).map(f => `<div class="pavatar" style="background:${f.color}">${esc(initials(f.name))}</div>`).join("")}
        </div>
      </div>
    </div>

    <div class="sec"><span class="h2">Last 14 days</span><button class="card-link" data-action="nav" data-view="stats">Stats</button></div>
    <div class="card" data-action="nav" data-view="stats">
      ${Charts.spark(spark)}
      <div class="sub center mt8">Spent ${fmt(spark.reduce((a, p) => a + p.amt, 0))} in the last 2 weeks</div>
    </div>

    ${upcoming.length ? `<div class="sec"><span class="h2">Upcoming bills</span><button class="card-link" data-action="open-recurring">All</button></div>
    <div class="card flat" style="padding:8px 10px">
      ${upcoming.slice(0, 3).map(r => {
        const c = Store.cat(r.categoryId);
        return `<div class="tx" data-action="open-recurring">
          <div class="emo" style="background:${tint(c.color, .16)}">${c.emoji}</div>
          <div class="mid"><div class="nm">${esc(r.name)}</div><div class="meta">${r.nextDue <= D.todayISO() ? "Due now" : D.human(r.nextDue)} · ${FREQ_LABEL[r.freq]}</div></div>
          <div class="amt ${r.type === "income" ? "pos" : ""}">${r.type === "income" ? "+" : ""}${fmt(r.amount)}</div>
        </div>`;
      }).join("")}
    </div>` : ""}

    ${s.goals.length ? `<div class="sec"><span class="h2">Goals</span><button class="card-link" data-action="open-goals">All</button></div>
    <div class="hscroll">
      ${s.goals.map(g => {
        const pct = Math.min(100, g.saved / g.target * 100);
        return `<button class="acc-chip" data-action="open-goals" style="display:flex;gap:10px;align-items:center">
          ${Charts.ring(pct, 46, g.color, "")}
          <span style="text-align:left"><span class="nm">${g.emoji} ${esc(g.name)}</span>
          <span class="bal" style="font-size:13px;display:block">${fmt(g.saved)} <span class="sub">/ ${fmt(g.target)}</span></span></span>
        </button>`;
      }).join("")}
    </div>` : ""}

    <div class="sec"><span class="h2">Recent transactions</span><button class="card-link" data-action="nav" data-view="trans">See all</button></div>
    <div class="card flat stagger" style="padding:8px 10px">
      ${recent.length ? recent.map(t => txRow(t)).join("") : '<div class="empty"><div class="big">🪄</div>No transactions yet.<br>Tap + to add your first one!</div>'}
    </div>`;
  },

  homeAfter() {
    const el = document.getElementById("hero-balance");
    if (el) countUp(el, Store.netWorth(), 800);
  },

  /* ================= TRANSACTIONS ================= */
  trans() {
    const { y, m } = UI.month;
    const inc = Store.monthTotal(y, m, "income"), exp = Store.monthTotal(y, m, "expense");
    return `
    <div class="page-head"><div class="title"><span class="h1">Records</span><span class="sub">All your transactions</span></div>
      <button class="icon-btn" data-action="export-csv" title="Export CSV">
        <svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/></svg>
      </button>
    </div>
    ${monthSelector()}
    <div class="sum3">
      <div class="cell"><div class="lab">Income</div><div class="val pos money">${fmt(inc)}</div></div>
      <div class="cell"><div class="lab">Expense</div><div class="val neg money">${fmt(exp)}</div></div>
      <div class="cell"><div class="lab">Net</div><div class="val money ${inc - exp >= 0 ? "pos" : "neg"}">${fmt(inc - exp, true)}</div></div>
    </div>
    <div class="search-row">
      <input class="input" id="tx-search" placeholder="🔍  Search payee, note, category…" value="${esc(UI.transFilter.q)}">
    </div>
    <div class="filter-chips">
      ${["all", "expense", "income", "transfer"].map(t =>
        `<button class="chip ${UI.transFilter.type === t ? "on" : ""}" data-action="tx-filter-type" data-type="${t}">${t === "all" ? "All" : t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
      <select class="input" id="tx-filter-cat" style="width:auto;padding:8px 30px 8px 12px;border-radius:12px;font-size:13px">
        <option value="all">All categories</option>
        ${Store.state.categories.map(c => `<option value="${c.id}" ${UI.transFilter.cat === c.id ? "selected" : ""}>${c.emoji} ${esc(c.name)}</option>`).join("")}
      </select>
      <select class="input" id="tx-filter-acc" style="width:auto;padding:8px 30px 8px 12px;border-radius:12px;font-size:13px">
        <option value="all">All accounts</option>
        ${Store.state.accounts.map(a => `<option value="${a.id}" ${UI.transFilter.acc === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}
      </select>
    </div>
    <div id="txlist">${Views.txList()}</div>`;
  },

  txList() {
    const { y, m } = UI.month;
    const f = UI.transFilter;
    let list = Store.monthTx(y, m);
    if (f.type !== "all") list = list.filter(t => t.type === f.type);
    if (f.cat !== "all") list = list.filter(t => t.categoryId === f.cat);
    if (f.acc !== "all") list = list.filter(t => t.accountId === f.acc || t.toAccountId === f.acc);
    if (f.q.trim()) {
      const q = f.q.trim().toLowerCase();
      list = list.filter(t =>
        (t.payee || "").toLowerCase().includes(q) ||
        (t.note || "").toLowerCase().includes(q) ||
        (t.categoryId && Store.cat(t.categoryId).name.toLowerCase().includes(q)));
    }
    return list.length ? groupTxByDate(list)
      : '<div class="empty"><div class="big">🔎</div>Nothing found for this month.</div>';
  },

  transAfter() {
    const s = document.getElementById("tx-search");
    if (s) s.addEventListener("input", () => {
      UI.transFilter.q = s.value;
      document.getElementById("txlist").innerHTML = Views.txList();
    });
    const fc = document.getElementById("tx-filter-cat");
    if (fc) fc.addEventListener("change", () => { UI.transFilter.cat = fc.value; document.getElementById("txlist").innerHTML = Views.txList(); });
    const fa = document.getElementById("tx-filter-acc");
    if (fa) fa.addEventListener("change", () => { UI.transFilter.acc = fa.value; document.getElementById("txlist").innerHTML = Views.txList(); });
  },

  /* ================= STATS ================= */
  /* the active date range for the selected period, anchored at UI.stats.anchor */
  statsRange() {
    const a = UI.stats.anchor, p = UI.stats.period;
    if (p === "daily") return { from: a, to: a, label: D.human(a) };
    if (p === "weekly") {
      const d = D.parse(a), off = (d.getDay() + 6) % 7; // Monday start
      const from = D.addDays(a, -off), to = D.addDays(a, 6 - off);
      return { from, to, label: D.short(from) + " – " + D.short(to) };
    }
    if (p === "yearly") {
      const y = a.slice(0, 4);
      return { from: y + "-01-01", to: y + "-12-31", label: y };
    }
    const [y, m] = a.split("-").map(Number);
    return {
      from: a.slice(0, 7) + "-01",
      to: a.slice(0, 7) + "-" + String(D.daysInMonth(y, m - 1)).padStart(2, "0"),
      label: D.monthName(y, m - 1),
    };
  },

  /* trend bars matched to the period */
  statsTrend() {
    const p = UI.stats.period, a = UI.stats.anchor;
    const bars = [], cell = (from, to, label) => ({
      label, inc: Store.rangeTotal(from, to, "income"), exp: Store.rangeTotal(from, to, "expense"),
    });
    if (p === "daily") {
      for (let i = 6; i >= 0; i--) {
        const day = D.addDays(a, -i);
        bars.push(cell(day, day, D.parse(day).toLocaleDateString("en-IN", { weekday: "short" })));
      }
      return { bars, title: "Last 7 days" };
    }
    if (p === "weekly") {
      const d = D.parse(a), off = (d.getDay() + 6) % 7;
      const thisMon = D.addDays(a, -off);
      for (let i = 5; i >= 0; i--) {
        const from = D.addDays(thisMon, -7 * i);
        bars.push(cell(from, D.addDays(from, 6), D.short(from)));
      }
      return { bars, title: "Last 6 weeks" };
    }
    if (p === "yearly") {
      const y = Number(a.slice(0, 4));
      for (let m = 0; m < 12; m++) {
        const from = y + "-" + String(m + 1).padStart(2, "0") + "-01";
        const to = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(D.daysInMonth(y, m)).padStart(2, "0");
        bars.push(cell(from, to, new Date(y, m, 1).toLocaleDateString("en-IN", { month: "narrow" })));
      }
      return { bars, title: "Months of " + y };
    }
    const [y, m] = a.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const from = D.toISO(new Date(d.getFullYear(), d.getMonth(), 1));
      const to = D.toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      bars.push(cell(from, to, d.toLocaleDateString("en-IN", { month: "short" })));
    }
    return { bars, title: "Last 6 months" };
  },

  stats() {
    const type = UI.statsType;
    const { from, to, label } = Views.statsRange();
    const inc = Store.rangeTotal(from, to, "income"), exp = Store.rangeTotal(from, to, "expense");
    const items = Store.categorySpendRange(from, to, type);
    const total = items.reduce((s, i) => s + i.amt, 0);
    const trend = Views.statsTrend();

    const donutItems = items.slice(0, 6).map(i => ({ label: i.cat.name, value: i.amt, color: i.cat.color }));
    const rest = items.slice(6).reduce((s, i) => s + i.amt, 0);
    if (rest > 0) donutItems.push({ label: "Others", value: rest, color: "#64748b" });

    return `
    <div class="page-head"><div class="title"><span class="h1">Statistics</span><span class="sub">Where your money goes</span></div></div>
    <div class="seg">
      ${["daily", "weekly", "monthly", "yearly"].map(pp =>
        `<button class="${UI.stats.period === pp ? "on" : ""}" data-action="stats-period" data-p="${pp}">${pp[0].toUpperCase() + pp.slice(1)}</button>`).join("")}
    </div>
    <div class="month-sel">
      <button data-action="stats-prev">‹</button>
      <div class="m">${esc(label)}</div>
      <button data-action="stats-next">›</button>
    </div>
    <div class="seg">
      <button class="${type === "expense" ? "on exp" : ""}" data-action="stats-type" data-type="expense">Expenses</button>
      <button class="${type === "income" ? "on inc" : ""}" data-action="stats-type" data-type="income">Income</button>
    </div>

    <div class="card">
      ${items.length ? `
      <div class="donut-wrap">
        ${Charts.donut(donutItems, 150, type === "expense" ? "Spent" : "Earned", fmt(total))}
        <div class="legend">
          ${donutItems.map(i => `<div class="li"><span class="dot" style="background:${i.color}"></span>
            <span class="nm">${esc(i.label)}</span><span class="pc">${total ? Math.round(i.value / total * 100) : 0}%</span></div>`).join("")}
        </div>
      </div>` : '<div class="empty"><div class="big">📊</div>No ' + type + 's in this period.</div>'}
    </div>

    <div class="sec"><span class="h2">${trend.title}</span></div>
    <div class="card">
      ${Charts.incExpBars(trend.bars)}
      <div class="card-row mt8">
        <span class="sub"><span style="color:var(--green)">●</span> Income ${fmt(inc)}</span>
        <span class="sub"><span style="color:var(--red)">●</span> Expense ${fmt(exp)}</span>
        <span class="sub"><b class="${inc - exp >= 0 ? "pos" : "neg"} money">${fmt(inc - exp, true)}</b> saved</span>
      </div>
    </div>

    ${items.length ? `<div class="sec"><span class="h2">Category breakdown</span></div>
    <div class="card flat stagger" style="padding:10px 12px">
      ${items.map(i => {
        const pc = total ? Math.round(i.amt / total * 100) : 0;
        return `<div class="rank" data-action="stats-cat" data-cat="${i.cat.id}">
          <div class="emo" style="background:${tint(i.cat.color, .16)}">${i.cat.emoji}</div>
          <div class="mid">
            <div class="nm"><span>${esc(i.cat.name)} <span class="sub">${pc}%</span></span><b class="money">${fmt(i.amt)}</b></div>
            <div class="bar"><i style="width:${pc}%;background:${i.cat.color}"></i></div>
          </div>
        </div>`;
      }).join("")}
    </div>` : ""}`;
  },

  /* drill-down: one category's transactions in the active period */
  statsCat(catId) {
    const { from, to, label } = Views.statsRange();
    const c = Store.cat(catId);
    const list = Store.rangeTx(from, to).filter(t => t.categoryId === catId);
    const total = list.reduce((s, t) => s + t.amount, 0);
    Sheet.open(`
      <div class="sheet-title">${c.emoji} ${esc(c.name)} — ${esc(label)}</div>
      <div class="center h2 money mb8">${fmt(total)}</div>
      <div style="max-height:50vh;overflow-y:auto">${groupTxByDate(list)}</div>
      <button class="btn ghost mt8" data-action="close-sheet">Close</button>`);
  },

  /* ================= BUDGETS ================= */
  budgets() {
    const { y, m } = UI.month;
    const s = Store.state;
    const overall = s.budgets.find(b => b.categoryId === "ALL");
    const others = s.budgets.filter(b => b.categoryId !== "ALL");
    const budCard = (b) => {
      const st = Store.budgetStatus(b, y, m);
      const isAll = b.categoryId === "ALL";
      const c = isAll ? { name: "Overall", emoji: "🎯", color: "#7c6bff" } : Store.cat(b.categoryId);
      const barColor = st.over ? "var(--red)" : st.pct >= 80 ? "var(--amber)" : c.color;
      return `<div class="card bud" data-action="edit-budget" data-id="${b.id}">
        <div class="top">
          <div class="emo" style="background:${tint(c.color, .16)}">${c.emoji}</div>
          <div style="flex:1">
            <div class="nm">${esc(c.name)}</div>
            <div class="st">${fmt(st.spent)} of ${fmt(b.amount)}</div>
          </div>
          <div class="rem ${st.over ? "neg" : "pos"}">${st.over ? fmt(-st.left) + " over" : fmt(st.left) + " left"}</div>
        </div>
        <div class="bar"><i style="width:${st.pct}%;background:${barColor}"></i></div>
      </div>`;
    };
    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">Budgets</span>
      <button class="icon-btn" data-action="add-budget"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
    ${monthSelector()}
    ${overall ? budCard(overall) : `<button class="btn ghost mb8" data-action="add-budget">＋ Set an overall monthly budget</button>`}
    <div class="sec"><span class="h2">Category budgets</span></div>
    <div class="stagger">
    ${others.length ? others.map(budCard).join("") : '<div class="empty"><div class="big">🎯</div>No category budgets yet.<br>Tap + to create one.</div>'}
    </div>`;
  },

  /* ================= SPLITS ================= */
  splits() {
    const s = Store.state;
    const totals = Store.splitTotals();
    const tab = UI.splitsTab;
    let body = "";

    if (tab === "friends") {
      body = s.friends.length ? `<div class="stagger">` + s.friends.map(f => {
        const bal = Store.friendBalance(f.id);
        return `<div class="person" data-action="friend-detail" data-id="${f.id}">
          <div class="pavatar" style="background:${f.color}">${esc(initials(f.name))}</div>
          <div class="mid"><div class="nm">${esc(f.name)}</div>
          <div class="st">${Math.abs(bal) < 1 ? "settled up" : bal > 0 ? "owes you" : "you owe"}</div></div>
          <div class="owes ${bal > 0 ? "pos" : bal < 0 ? "neg" : "muted"} money">${Math.abs(bal) < 1 ? "✓" : fmt(Math.abs(bal))}</div>
        </div>`;
      }).join("") + `</div>
      <button class="btn ghost mt8" data-action="add-friend">＋ Add friend</button>`
        : `<div class="empty"><div class="big">🧑‍🤝‍🧑</div>Add friends to start splitting expenses.</div>
           <button class="btn primary" data-action="add-friend">＋ Add friend</button>`;
    } else if (tab === "groups") {
      body = s.groups.length ? `<div class="stagger">` + s.groups.map(g => {
        const bal = Store.myGroupBalance(g.id);
        const members = g.memberIds.map(id => Store.friend(id)).filter(Boolean);
        return `<div class="person" data-action="group-detail" data-id="${g.id}">
          <div class="pavatar" style="background:var(--chip);font-size:20px">${g.emoji || "👥"}</div>
          <div class="mid"><div class="nm">${esc(g.name)}</div>
          <div class="st">${members.length + 1} members · ${Math.abs(bal) < 1 ? "settled up" : bal > 0 ? "you get back" : "you owe"}</div></div>
          <div class="owes ${bal > 0 ? "pos" : bal < 0 ? "neg" : "muted"} money">${Math.abs(bal) < 1 ? "✓" : fmt(Math.abs(bal))}</div>
        </div>`;
      }).join("") + `</div>
      <button class="btn ghost mt8" data-action="add-group">＋ New group</button>`
        : `<div class="empty"><div class="big">🏝️</div>Create a group for trips, flatmates, events…</div>
           <button class="btn primary" data-action="add-group">＋ New group</button>`;
    } else {
      const acts = [...s.splitExpenses.map(e => ({ ...e, kind: "expense" })),
        ...s.settlements.map(e => ({ ...e, kind: "settle" }))].sort((a, b) => a.date < b.date ? 1 : -1);
      body = acts.length ? acts.map(a => {
        if (a.kind === "settle") {
          return `<div class="tx" data-action="settle-edit" data-id="${a.id}">
            <div class="emo" style="background:${tint("#34d399", .16)}">🤝</div>
            <div class="mid"><div class="nm">${esc(Store.friend(a.from)?.name || "?")} paid ${esc(Store.friend(a.to)?.name || "?")}</div>
            <div class="meta">${a.groupId ? esc(Store.group(a.groupId)?.name || "") + " · " : ""}${D.human(a.date)} · tap to edit</div></div>
            <div class="amt pos money">${fmt(a.amount)}</div></div>`;
        }
        const payer = Store.friend(a.paidBy);
        return `<div class="tx" data-action="split-detail" data-id="${a.id}">
          <div class="emo" style="background:${tint("#7c6bff", .16)}">🧾</div>
          <div class="mid"><div class="nm">${esc(a.desc)}</div>
          <div class="meta">${esc(payer?.name || "?")} paid · ${a.groupId ? esc(Store.group(a.groupId)?.name || "") + " · " : ""}${D.human(a.date)}</div></div>
          <div class="amt money">${fmt(a.amount)}</div></div>`;
      }).join("") : '<div class="empty"><div class="big">🧾</div>No split activity yet.</div>';
    }

    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">Splits</span>
      <button class="icon-btn" data-action="add-split"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
    <div class="split-hero">
      <div class="cell"><div class="lab">You are owed</div><div class="val pos money">${fmt(totals.owedToMe)}</div></div>
      <div class="cell"><div class="lab">You owe</div><div class="val neg money">${fmt(totals.iOwe)}</div></div>
    </div>
    <div class="tabbar">
      ${["friends", "groups", "activity"].map(t => `<button class="${tab === t ? "on" : ""}" data-action="splits-tab" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}
    </div>
    ${body}`;
  },

  groupDetail() {
    const g = Store.group(UI.groupId);
    if (!g) { UI.view = "splits"; return Views.splits(); }
    const exp = Store.state.splitExpenses.filter(e => e.groupId === g.id);
    const settles = Store.state.settlements.filter(s => s.groupId === g.id);
    const activity = [
      ...exp.map(e => ({ ...e, kind: "expense" })),
      ...settles.map(s => ({ ...s, kind: "settle" })),
    ].sort((a, b) => a.date < b.date ? 1 : -1);
    const edges = Store.groupEdges(g.id);
    const totalSpent = exp.reduce((s, e) => s + e.amount, 0);
    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">${g.emoji || "👥"} ${esc(g.name)}</span>
      <button class="icon-btn" data-action="delete-group" data-id="${g.id}"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg></button>
    </div>
    <div class="card">
      <div class="card-row mb8"><span class="sub">Total group spending</span><b class="money">${fmt(totalSpent)}</b></div>
      <div class="divider"></div>
      <div class="sub mb8"><b>Who pays whom</b> (simplified)</div>
      ${edges.length ? edges.map(e => `
        <div class="debt-line"><b>${esc(Store.friend(e.from)?.name || "?")}</b><span class="arrow">→ pays →</span>
        <b>${esc(Store.friend(e.to)?.name || "?")}</b><span style="margin-left:auto" class="money"><b>${fmt(e.amount)}</b></span></div>`).join("")
      : '<div class="sub">🎉 Everyone is settled up!</div>'}
      <div class="row2 mt14">
        <button class="btn ghost" data-action="settle-up" data-group="${g.id}">🤝 Settle up</button>
        <button class="btn primary" data-action="add-split" data-group="${g.id}">＋ Add expense</button>
      </div>
    </div>
    <div class="sec"><span class="h2">Activity</span></div>
    ${periodTabs(UI.splitPeriod)}
    <div class="card flat" style="padding:6px 10px">
      ${activity.length
        ? periodSections(activity, UI.splitPeriod).map(sec =>
            sectionBlock(sec, groupActivityRow, items =>
              fmt(items.filter(i => i.kind === "expense").reduce((s, i) => s + i.amount, 0)))).join("")
        : '<div class="empty">No expenses yet.</div>'}
    </div>`;
  },

  friendDetail() {
    const f = Store.friend(UI.friendId);
    if (!f) { UI.view = "splits"; return Views.splits(); }
    const bal = Store.friendBalance(f.id);
    const activity = Store.friendActivity(f.id);
    const shared = Store.state.groups.filter(g => g.memberIds.includes(f.id));
    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">${esc(f.name)}</span>
      <button class="icon-btn" data-action="delete-friend" data-id="${f.id}"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg></button>
    </div>
    <div class="card center">
      <div class="pavatar" style="background:${f.color};width:60px;height:60px;font-size:22px;margin:0 auto 10px">${esc(initials(f.name))}</div>
      <div class="sub">${Math.abs(bal) < 1 ? "You are settled up 🎉" : bal > 0 ? esc(f.name) + " owes you" : "You owe " + esc(f.name)}</div>
      <div class="h1 money ${bal > 0 ? "pos" : bal < 0 ? "neg" : ""}" style="margin:6px 0 14px">${fmt(Math.abs(bal))}</div>
      <div class="row2">
        <button class="btn ghost" data-action="settle-up" data-friend="${f.id}">🤝 Settle up</button>
        <button class="btn primary" data-action="add-split" data-friend="${f.id}">＋ Split expense</button>
      </div>
    </div>
    ${shared.length ? `<div class="sec"><span class="h2">Shared groups</span></div>
    <div class="card flat" style="padding:8px 10px">
      ${shared.map(g => `<div class="person" data-action="group-detail" data-id="${g.id}">
        <div class="pavatar" style="background:var(--chip);font-size:18px">${g.emoji || "👥"}</div>
        <div class="mid"><div class="nm">${esc(g.name)}</div></div><span class="sub">›</span></div>`).join("")}
    </div>` : ""}

    <div class="sec"><span class="h2">Activity</span></div>
    ${periodTabs(UI.splitPeriod)}
    <div class="card flat" style="padding:6px 10px">
      ${activity.length
        ? periodSections(activity, UI.splitPeriod).map(sec =>
            sectionBlock(sec, friendActivityRow, items =>
              fmt(items.reduce((s, it) => s + it.delta, 0), true))).join("")
        : '<div class="empty">No 1-to-1 activity yet.</div>'}
    </div>`;
  },

  /* ================= ACCOUNTS ================= */
  accounts() {
    const s = Store.state;
    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">Accounts</span>
      <button class="icon-btn" data-action="add-account"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
    <div class="card hero">
      <div class="sub">Net worth</div>
      <div class="balance money" style="font-size:28px;margin-bottom:0">${fmt(Store.netWorth())}</div>
    </div>
    <button class="btn ghost mb8" data-action="add-transfer">🔁 Transfer between accounts</button>
    <div class="stagger">
    ${s.accounts.map(a => {
      const t = ACCOUNT_TYPES.find(x => x.id === a.type);
      const bal = Store.accountBalance(a.id);
      return `<div class="card bud" data-action="account-detail" data-id="${a.id}" style="margin-bottom:10px">
        <div class="top" style="margin-bottom:0">
          <div class="emo" style="background:var(--chip)">${t ? t.emoji : "💰"}</div>
          <div style="flex:1"><div class="nm">${esc(a.name)}</div><div class="st">${t ? t.name : ""}${a.excludeTotal ? " · excluded from total" : ""}</div></div>
          <div class="rem money ${bal < 0 ? "neg" : ""}" style="font-size:15px">${fmt(bal)}</div>
        </div>
      </div>`;
    }).join("")}
    </div>`;
  },

  accountDetail() {
    const a = Store.acc(UI.accountId);
    if (!a) { UI.view = "accounts"; return Views.accounts(); }
    const t = ACCOUNT_TYPES.find(x => x.id === a.type);
    const list = Store.state.transactions.filter(x => x.accountId === a.id || x.toAccountId === a.id)
      .sort((x, b) => x.date < b.date ? 1 : -1).slice(0, 60);
    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">${t ? t.emoji : "💰"} ${esc(a.name)}</span>
      <button class="icon-btn" data-action="edit-account" data-id="${a.id}"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4ZM13 7l4 4"/></svg></button>
    </div>
    <div class="card center">
      <div class="sub">Current balance</div>
      <div class="h1 money" style="font-size:30px;margin-top:4px">${fmt(Store.accountBalance(a.id))}</div>
    </div>
    <div class="sec"><span class="h2">Transactions</span></div>
    ${list.length ? groupTxByDate(list) : '<div class="empty"><div class="big">🗒️</div>No transactions in this account.</div>'}`;
  },

  /* ================= GOALS ================= */
  goals() {
    const s = Store.state;
    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">Savings Goals</span>
      <button class="icon-btn" data-action="add-goal"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
    <div class="stagger">
    ${s.goals.length ? s.goals.map(g => {
      const pct = Math.min(100, g.saved / g.target * 100);
      return `<div class="card goal" data-action="goal-detail" data-id="${g.id}">
        ${Charts.ring(pct, 64, g.color)}
        <div class="mid">
          <div class="nm">${g.emoji} ${esc(g.name)}</div>
          <div class="st money">${fmt(g.saved)} saved of ${fmt(g.target)} · ${fmt(Math.max(0, g.target - g.saved))} to go</div>
          <div class="bar"><i style="width:${pct}%;background:${g.color}"></i></div>
        </div>
      </div>`;
    }).join("") : '<div class="empty"><div class="big">🎯</div>No goals yet. Save towards something exciting!</div>'}
    </div>`;
  },

  /* ================= RECURRING ================= */
  recurring() {
    const s = Store.state;
    const today = D.todayISO();
    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">Recurring</span>
      <button class="icon-btn" data-action="add-recurring"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
    <p class="sub" style="margin:-6px 2px 14px">Bills, subscriptions & income that repeat. Auto-post adds them to your records automatically on the due date.</p>
    <div class="stagger">
    ${s.recurring.length ? s.recurring.sort((a, b) => a.nextDue < b.nextDue ? -1 : 1).map(r => {
      const c = Store.cat(r.categoryId);
      const due = r.nextDue <= today;
      return `<div class="card bud" style="margin-bottom:10px" data-action="edit-recurring" data-id="${r.id}">
        <div class="top" style="margin-bottom:0">
          <div class="emo" style="background:${tint(c.color, .16)}">${c.emoji}</div>
          <div style="flex:1">
            <div class="nm">${esc(r.name)} ${r.autoPost ? '<span class="sub">· auto</span>' : ""}</div>
            <div class="st ${due ? "warn" : ""}">${due ? "⏰ Due — tap to post" : "Next: " + D.human(r.nextDue)} · ${FREQ_LABEL[r.freq]}</div>
          </div>
          <div class="rem money ${r.type === "income" ? "pos" : ""}">${r.type === "income" ? "+" : ""}${fmt(r.amount)}</div>
        </div>
      </div>`;
    }).join("") : '<div class="empty"><div class="big">🔄</div>No recurring items yet.</div>'}
    </div>`;
  },

  /* ================= CATEGORIES ================= */
  categories() {
    const s = Store.state;
    const grid = (type) => s.categories.filter(c => c.type === type).map(c => `
      <button class="cat-cell" data-action="edit-category" data-id="${c.id}">
        <span class="em" style="text-shadow:0 0 18px ${tint(c.color, .8)}">${c.emoji}</span>
        <span class="nm">${esc(c.name)}</span>
      </button>`).join("");
    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">Categories</span>
      <button class="icon-btn" data-action="add-category"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
    <div class="sec"><span class="h2">Expense</span></div>
    <div class="cat-grid">${grid("expense")}</div>
    <div class="sec"><span class="h2">Income</span></div>
    <div class="cat-grid">${grid("income")}</div>`;
  },

  /* ================= MORE ================= */
  more() {
    const s = Store.state.settings;
    const cur = currencyInfo();
    const item = (em, label, hint, action) => `
      <button class="menu-item" data-action="${action}">
        <span class="em">${em}</span><span class="grow">${label}</span>
        <span class="hint">${hint || ""}</span><span class="chev">›</span>
      </button>`;
    return `
    <div class="page-head"><div class="title"><span class="h1">More</span><span class="sub">Features & settings</span></div></div>

    <div class="card" data-action="edit-profile">
      <div class="card-row">
        <div style="display:flex;gap:12px;align-items:center">
          <div class="avatar">${esc(initials(s.name))}</div>
          <div><b>${esc(s.name)}</b><div class="sub">Tap to edit profile</div></div>
        </div>
        <span class="chev sub">›</span>
      </div>
    </div>

    <div class="menu">
      ${item("🧑‍🤝‍🧑", "Splits", "friends & groups", "open-splits")}
      ${item("🏦", "Accounts", fmt(Store.netWorth()), "open-accounts")}
      ${item("🎯", "Budgets", "", "open-budgets")}
      ${item("🐷", "Savings Goals", Store.state.goals.length + " active", "open-goals")}
      ${item("🔄", "Recurring", Store.state.recurring.length + " items", "open-recurring")}
      ${item("🏷️", "Categories", Store.state.categories.length + "", "open-categories")}
    </div>

    <div class="menu">
      ${item("🎨", "Theme", s.theme === "dark" ? "Dark" : "Light", "toggle-theme")}
      ${item("💱", "Currency", cur.code + " " + cur.sym, "pick-currency")}
    </div>

    <div class="menu">
      ${item("📤", "Export CSV", "transactions", "export-csv")}
      ${item("💾", "Backup data", "JSON file", "backup-json")}
      ${item("📥", "Restore backup", "", "restore-json")}
      ${item("🧪", "Reset demo data", "", "reset-demo")}
      ${item("🗑️", "Erase everything", "", "erase-all")}
    </div>
    <p class="sub center" style="margin-top:18px">Budget Bhai · v1.6 · data stays on your device 🔒</p>`;
  },
};
