/* ============ Paisa — views ============ */
"use strict";

const now0 = new Date();
const UI = {
  view: "home",
  stack: [],
  month: { y: now0.getFullYear(), m: now0.getMonth() },
  stats: { period: "monthly", anchor: D.todayISO(),
    custom: { from: D.addDays(D.todayISO(), -29), to: D.todayISO() } },
  statsType: "expense",
  splitsTab: "friends",
  splitPeriod: "monthly",
  loansTab: "lent",
  noteId: null, notesQuery: "", notesTag: "all",
  friendTab: "activity",
  splitCat: { period: "all", anchor: D.todayISO(),
    custom: { from: D.addDays(D.todayISO(), -29), to: D.todayISO() } },
  transFilter: { q: "", type: "all", cat: "all", acc: "all", scope: "all" },
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

/* split expenses created before categories existed fall back to "Other" */
function splitCat(e) { return Store.cat(e.categoryId || "c_other"); }

/* "where does my money with this person go" — donut + ranked categories.
   Pass no friendId for every split you're part of. */
/* the window the split-category panel is currently showing */
function splitCatRange() {
  const s = UI.splitCat;
  if (s.period === "all") return { from: "", to: "", label: "All time" };
  if (s.period === "custom") return { from: s.custom.from, to: s.custom.to,
    label: D.short(s.custom.from) + " – " + D.short(s.custom.to) };
  if (s.period === "daily") return { from: s.anchor, to: s.anchor, label: D.human(s.anchor) };
  if (s.period === "weekly") {
    const from = D.weekStart(s.anchor);
    return { from, to: D.addDays(from, 6), label: D.short(from) + " – " + D.short(D.addDays(from, 6)) };
  }
  const [y, m] = s.anchor.split("-").map(Number);
  return {
    from: s.anchor.slice(0, 7) + "-01",
    to: s.anchor.slice(0, 7) + "-" + String(D.daysInMonth(y, m - 1)).padStart(2, "0"),
    label: D.monthName(y, m - 1),
  };
}

function splitCatControls() {
  const s = UI.splitCat;
  const { label } = splitCatRange();
  return `
    <div class="seg" style="margin-bottom:10px">
      ${[["all", "All"], ["daily", "Day"], ["weekly", "Week"], ["monthly", "Month"], ["custom", "Range"]]
        .map(([k, lb]) => `<button class="${s.period === k ? "on" : ""}" data-action="splitcat-period" data-p="${k}" style="font-size:12px">${lb}</button>`).join("")}
    </div>
    ${s.period === "custom" ? `
      <div class="card flat" style="padding:12px 14px">
        <div class="row2">
          <div class="field" style="margin:0"><label>From</label>
            <input class="input" type="date" id="sc-from" value="${s.custom.from}"></div>
          <div class="field" style="margin:0"><label>To</label>
            <input class="input" type="date" id="sc-to" value="${s.custom.to}"></div>
        </div>
        <div class="chips" style="margin-top:10px">
          ${[["7 days", 7], ["30 days", 30], ["90 days", 90]].map(([lb, n]) =>
            `<button class="chip" data-action="splitcat-preset" data-n="${n}">${lb}</button>`).join("")}
        </div>
      </div>`
    : s.period === "all" ? ""
    : `<div class="month-sel">
        <button data-action="splitcat-prev">‹</button>
        <div class="m">${esc(label)}</div>
        <button data-action="splitcat-next">›</button>
      </div>`}`;
}

/* "where does my money with this person go" — donut + ranked, tappable categories.
   Pass no friendId for every split you're part of. */
function splitCategoryPanel(friendId, who) {
  const { from, to, label } = splitCatRange();
  const rows = Store.splitCategoryBreakdown(friendId, from, to);
  const controls = splitCatControls();
  if (!rows.length) {
    return controls + `<div class="empty"><div class="big">🍰</div>
      No shared expenses ${UI.splitCat.period === "all" ? "yet" : "in " + esc(label)}.</div>`;
  }
  const mineTotal = rows.reduce((s, r) => s + r.mine, 0);
  const sharedTotal = rows.reduce((s, r) => s + r.total, 0);
  const theirTotal = rows.reduce((s, r) => s + (r.theirs || 0), 0);
  const count = rows.reduce((s, r) => s + r.count, 0);
  const donut = rows.slice(0, 6).map(r => ({ label: r.cat.name, value: r.mine, color: r.cat.color }));
  const rest = rows.slice(6).reduce((s, r) => s + r.mine, 0);
  if (rest > 0) donut.push({ label: "Others", value: rest, color: "#64748b" });
  const top = rows[0];

  return controls + `
    <div class="card">
      <div class="donut-wrap">
        ${Charts.donut(donut, 150, "Your share", fmt(mineTotal))}
        <div class="legend">
          ${donut.map(d => `<div class="li"><span class="dot" style="background:${d.color}"></span>
            <span class="nm">${esc(d.label)}</span><span class="pc">${mineTotal ? Math.round(d.value / mineTotal * 100) : 0}%</span></div>`).join("")}
        </div>
      </div>
      <div class="divider"></div>
      <div class="sum3">
        <div class="cell"><div class="lab">Your share</div><div class="val money">${fmt(mineTotal)}</div></div>
        ${friendId ? `<div class="cell"><div class="lab">${esc(who)}'s share</div><div class="val money">${fmt(theirTotal)}</div></div>` : ""}
        <div class="cell"><div class="lab">Total billed</div><div class="val money">${fmt(sharedTotal)}</div></div>
      </div>
      <div class="sub center">Biggest ${friendId ? "with " + esc(who) : ""}: <b>${top.cat.emoji} ${esc(top.cat.name)}</b>
        — ${fmt(top.mine)} across ${count} shared expense${count === 1 ? "" : "s"} · ${esc(label)}</div>
    </div>
    <div class="sec"><span class="h2">Tap a category for details</span></div>
    <div class="card flat stagger" style="padding:10px 12px">
      ${rows.map(r => {
        const pc = mineTotal ? Math.round(r.mine / mineTotal * 100) : 0;
        return `<div class="rank" data-action="splitcat-open" data-cat="${r.cat.id}" data-friend="${friendId || ""}">
          <div class="emo" style="background:${tint(r.cat.color, .16)}">${r.cat.emoji}</div>
          <div class="mid">
            <div class="nm"><span>${esc(r.cat.name)} <span class="sub">${pc}%</span></span><b class="money">${fmt(r.mine)}</b></div>
            <div class="bar"><i style="width:${pc}%;background:${r.cat.color}"></i></div>
            <div class="sub" style="margin-top:4px;font-size:11px">${r.count} expense${r.count === 1 ? "" : "s"} · ${fmt(r.total)} total bill${friendId && r.theirs ? " · " + esc(who) + " " + fmt(r.theirs) : ""}</div>
          </div>
          <span class="chev sub">›</span>
        </div>`;
      }).join("")}
    </div>`;
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
  const c = splitCat(it);
  return `<div class="tx" data-action="split-detail" data-id="${it.id}">
    <div class="emo" style="background:${tint(c.color, .16)}">${c.emoji}</div>
    <div class="mid">
      <div class="nm">${esc(it.desc)}</div>
      <div class="meta">${esc(c.name)} · ${iPaid ? "You" : esc(f.name)} paid ${fmt(it.total)} · ${whose}</div>
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
  const c = splitCat(it);
  return `<div class="tx" data-action="split-detail" data-id="${it.id}">
    <div class="emo" style="background:${tint(c.color, .16)}">${c.emoji}</div>
    <div class="mid">
      <div class="nm">${esc(it.desc)}</div>
      <div class="meta">${esc(c.name)} · ${iPaid ? "You" : esc(Store.friend(it.paidBy)?.name || "?")} paid${mine ? " · your share " + fmt(mine.amount) : " · not your split"}</div>
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

    ${(() => { const t = Store.loanTotals(); return (t.lentOut || t.borrowed) ? `
    <div class="sec"><span class="h2">Lend & Borrow</span><button class="card-link" data-action="open-loans">Open</button></div>
    <div class="card" data-action="open-loans">
      <div class="card-row">
        <div><div class="sub">Owed to you</div><div class="h2 pos money">${fmt(t.lentOut)}</div></div>
        <div><div class="sub">You owe</div><div class="h2 neg money">${fmt(t.borrowed)}</div></div>
        ${t.overdue ? `<span class="delta up">${t.overdue} overdue</span>` : `<span class="sub">on track</span>`}
      </div>
    </div>` : ""; })()}

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

  /* searching looks across every month unless you narrow it back down */
  txList() {
    const { y, m } = UI.month;
    const f = UI.transFilter;
    const searching = !!f.q.trim();
    const allTime = searching && f.scope === "all";

    let list;
    if (allTime) {
      list = Store.searchTransactions(f.q, f);
    } else {
      list = Store.monthTx(y, m);
      if (f.type !== "all") list = list.filter(t => t.type === f.type);
      if (f.cat !== "all") list = list.filter(t => t.categoryId === f.cat);
      if (f.acc !== "all") list = list.filter(t => t.accountId === f.acc || t.toAccountId === f.acc);
      if (searching) {
        const q = f.q.trim().toLowerCase();
        list = list.filter(t =>
          (t.payee || "").toLowerCase().includes(q) ||
          (t.note || "").toLowerCase().includes(q) ||
          (t.categoryId && Store.cat(t.categoryId).name.toLowerCase().includes(q)) ||
          String(t.amount).includes(q));
      }
    }

    let banner = "";
    if (searching) {
      const spent = list.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const span = allTime && list.length
        ? D.short(list[list.length - 1].date) + " – " + D.short(list[0].date)
        : D.monthName(y, m, true);
      banner = `<div class="search-banner">
        <div>
          <b>${list.length}</b> result${list.length === 1 ? "" : "s"}${spent ? ` · ${fmt(spent)} spent` : ""}
          <div class="sub">${list.length ? esc(span) : "no matches"}</div>
        </div>
        <div class="seg" style="margin:0;width:auto">
          <button class="${allTime ? "on" : ""}" data-action="tx-scope" data-s="all">All time</button>
          <button class="${!allTime ? "on" : ""}" data-action="tx-scope" data-s="month">This month</button>
        </div>
      </div>`;
    }

    return banner + (list.length ? groupTxByDate(list)
      : `<div class="empty"><div class="big">🔎</div>${searching
          ? (allTime ? "Nothing matches anywhere." : "Nothing this month — try <b>All time</b>.")
          : "No transactions this month."}</div>`);
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
  statsRange() { return Views.rangeFor(UI.stats.period, UI.stats.anchor); },

  /* the equivalent range one step earlier — used for period-over-period deltas */
  prevStatsRange() {
    const p = UI.stats.period, a = UI.stats.anchor;
    if (p === "custom") {
      const { from, to } = UI.stats.custom;
      const days = Math.round((D.parse(to) - D.parse(from)) / 86400000) + 1;
      return { from: D.addDays(from, -days), to: D.addDays(from, -1), label: "previous " + days + " days" };
    }
    const back = p === "daily" ? D.addDays(a, -1)
      : p === "weekly" ? D.addDays(a, -7)
      : p === "yearly" ? D.addMonths(a, -12)
      : D.addMonths(a, -1);
    return Views.rangeFor(p, back);
  },

  rangeFor(p, a) {
    if (p === "custom") {
      const { from, to } = UI.stats.custom;
      return { from, to, label: D.short(from) + " – " + D.short(to) };
    }
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
    if (p === "custom") {
      // bucket the chosen span into readable chunks: days, weeks, then months
      const { from, to } = UI.stats.custom;
      const days = Math.round((D.parse(to) - D.parse(from)) / 86400000) + 1;
      if (days <= 14) {
        for (let i = 0; i < days; i++) {
          const d = D.addDays(from, i);
          bars.push(cell(d, d, D.parse(d).getDate() + ""));
        }
        return { bars, title: "Day by day" };
      }
      if (days <= 120) {
        let s = D.weekStart(from);
        while (s <= to) {
          const e = D.addDays(s, 6);
          bars.push(cell(s < from ? from : s, e > to ? to : e, D.short(s).split(" ")[0]));
          s = D.addDays(s, 7);
        }
        return { bars, title: "Week by week" };
      }
      let cur = from.slice(0, 7);
      while (cur <= to.slice(0, 7)) {
        const [yy, mm] = cur.split("-").map(Number);
        const mFrom = cur + "-01", mTo = cur + "-" + String(D.daysInMonth(yy, mm - 1)).padStart(2, "0");
        bars.push(cell(mFrom < from ? from : mFrom, mTo > to ? to : mTo,
          new Date(yy, mm - 1, 1).toLocaleDateString("en-IN", { month: "short" })));
        cur = D.addMonths(cur + "-01", 1).slice(0, 7);
      }
      return { bars, title: "Month by month" };
    }
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
    const prev = Views.prevStatsRange();
    const inc = Store.rangeTotal(from, to, "income"), exp = Store.rangeTotal(from, to, "expense");
    const items = Store.categorySpendRange(from, to, type);
    const total = items.reduce((s, i) => s + i.amt, 0);
    const trend = Views.statsTrend();
    const unit = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[UI.stats.period];

    const deltas = Store.categoryDeltas(from, to, prev.from, prev.to, type);
    const merchants = type === "expense" ? Store.merchantStats(from, to) : [];
    const topMerchant = merchants.length ? merchants[0].total : 0;

    // heatmap shows the month the anchor sits in (the end month for a custom range)
    const hAnchor = UI.stats.period === "custom" ? to : UI.stats.anchor;
    const [hy, hm] = [Number(hAnchor.slice(0, 4)), Number(hAnchor.slice(5, 7)) - 1];
    const hFrom = hAnchor.slice(0, 7) + "-01";
    const hTo = hAnchor.slice(0, 7) + "-" + String(D.daysInMonth(hy, hm)).padStart(2, "0");

    const weekday = Store.weekdayStats(from, to);
    const busiest = weekday.reduce((a, b) => b.total > a.total ? b : a, weekday[0]);
    const tod = Store.timeOfDayStats(from, to);
    const todMax = Math.max(...tod.blocks.map(b => b.total), 1);

    const nw = Store.netWorthSeries(6);
    const nwChange = nw[nw.length - 1].value - nw[0].value;
    const anomalies = Store.anomalies(from, to);
    const sr = Store.savingsRate(from, to);

    const donutItems = items.slice(0, 6).map(i => ({ label: i.cat.name, value: i.amt, color: i.cat.color }));
    const rest = items.slice(6).reduce((s, i) => s + i.amt, 0);
    if (rest > 0) donutItems.push({ label: "Others", value: rest, color: "#64748b" });

    return `
    <div class="page-head"><div class="title"><span class="h1">Statistics</span><span class="sub">Where your money goes</span></div></div>
    <div class="seg">
      ${["daily", "weekly", "monthly", "yearly", "custom"].map(pp =>
        `<button class="${UI.stats.period === pp ? "on" : ""}" data-action="stats-period" data-p="${pp}" style="font-size:12.5px">${pp === "custom" ? "Range" : pp[0].toUpperCase() + pp.slice(1)}</button>`).join("")}
    </div>
    ${UI.stats.period === "custom" ? `
    <div class="card flat" style="padding:12px 14px">
      <div class="row2">
        <div class="field" style="margin:0"><label>From</label>
          <input class="input" type="date" id="cr-from" value="${UI.stats.custom.from}" max="${UI.stats.custom.to}"></div>
        <div class="field" style="margin:0"><label>To</label>
          <input class="input" type="date" id="cr-to" value="${UI.stats.custom.to}" min="${UI.stats.custom.from}"></div>
      </div>
      <div class="chips" style="margin-top:10px">
        ${[["Last 7 days", 7], ["Last 30 days", 30], ["Last 90 days", 90], ["This year", 0]].map(([lb, n]) =>
          `<button class="chip" data-action="stats-preset" data-n="${n}">${lb}</button>`).join("")}
      </div>
      <div class="sub center mt8">${esc(label)} · ${Math.round((D.parse(to) - D.parse(from)) / 86400000) + 1} days</div>
    </div>`
    : `<div class="month-sel">
      <button data-action="stats-prev">‹</button>
      <div class="m">${esc(label)}</div>
      <button data-action="stats-next">›</button>
    </div>`}
    <div class="seg">
      <button class="${type === "expense" ? "on exp" : ""}" data-action="stats-type" data-type="expense">Expenses</button>
      <button class="${type === "income" ? "on inc" : ""}" data-action="stats-type" data-type="income">Income</button>
    </div>

    ${sr.inc > 0 || sr.exp > 0 ? `<div class="card kpi">
      <div class="card-row">
        <div>
          <div class="sub">Savings rate</div>
          <div class="kpi-val ${sr.rate === null ? "" : sr.rate >= 20 ? "pos" : sr.rate >= 0 ? "warn" : "neg"}">
            ${sr.rate === null ? "—" : sr.rate + "%"}
          </div>
          <div class="sub">${sr.rate === null ? "no income recorded this " + unit
            : sr.rate >= 20 ? "great — you're keeping a healthy share"
            : sr.rate >= 0 ? "you kept " + fmt(sr.saved) + " of " + fmt(sr.inc)
            : "you spent " + fmt(-sr.saved) + " more than you earned"}</div>
        </div>
        ${Charts.ring(Math.max(0, Math.min(100, sr.rate || 0)), 76,
          sr.rate === null ? "var(--faint)" : sr.rate >= 20 ? "var(--green)" : sr.rate >= 0 ? "var(--amber)" : "var(--red)",
          sr.rate === null ? "—" : sr.rate + "%")}
      </div>
      <div class="divider"></div>
      <div class="card-row">
        <span class="sub">In <b class="pos money">${fmt(sr.inc)}</b></span>
        <span class="sub">Out <b class="neg money">${fmt(sr.exp)}</b></span>
        <span class="sub">Net <b class="${sr.saved >= 0 ? "pos" : "neg"} money">${fmt(sr.saved, true)}</b></span>
      </div>
    </div>` : ""}

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

    ${items.length ? `<div class="sec"><span class="h2">Category breakdown</span><span class="sub">vs previous ${unit}</span></div>
    <div class="card flat stagger" style="padding:10px 12px">
      ${deltas.map(i => {
        const pc = total ? Math.round(i.amt / total * 100) : 0;
        const chip = i.pct === null
          ? `<span class="delta new">new</span>`
          : i.pct === 0 ? `<span class="delta flat">±0%</span>`
          : `<span class="delta ${i.pct > 0 ? "up" : "down"}">${i.pct > 0 ? "▲" : "▼"} ${Math.abs(i.pct)}%</span>`;
        return `<div class="rank" data-action="stats-cat" data-cat="${i.cat.id}">
          <div class="emo" style="background:${tint(i.cat.color, .16)}">${i.cat.emoji}</div>
          <div class="mid">
            <div class="nm"><span>${esc(i.cat.name)} ${chip}</span><b class="money">${fmt(i.amt)}</b></div>
            <div class="bar"><i style="width:${pc}%;background:${i.cat.color}"></i></div>
            <div class="sub" style="margin-top:4px;font-size:11px">${pc}% of total · was ${fmt(i.prev)}</div>
          </div>
        </div>`;
      }).join("")}
    </div>` : ""}

    ${merchants.length ? `<div class="sec"><span class="h2">Top places</span><span class="sub">${merchants.length} in total</span></div>
    <div class="card flat stagger" style="padding:10px 12px">
      ${merchants.slice(0, 8).map(mm => {
        const c = Store.cat(mm.catId);
        const pc = topMerchant ? Math.round(mm.total / topMerchant * 100) : 0;
        return `<div class="rank">
          <div class="emo" style="background:${tint(c.color, .16)}">${c.emoji}</div>
          <div class="mid">
            <div class="nm"><span>${esc(mm.name)}</span><b class="money">${fmt(mm.total)}</b></div>
            <div class="bar"><i style="width:${pc}%;background:${c.color}"></i></div>
            <div class="sub" style="margin-top:4px;font-size:11px">${mm.count} ${mm.count === 1 ? "time" : "times"} · ${fmt(Math.round(mm.total / mm.count))} avg</div>
          </div>
        </div>`;
      }).join("")}
    </div>` : ""}

    ${UI.stats.period !== "yearly" ? `<div class="sec"><span class="h2">Spending calendar</span><span class="sub">${D.monthName(hy, hm, true)}</span></div>
    <div class="card">
      ${Charts.calendarHeat(hy, hm, Store.dailyMap(hFrom, hTo))}
    </div>` : ""}

    ${weekday.some(d => d.total > 0) ? `<div class="sec"><span class="h2">Day of week</span></div>
    <div class="card">
      ${Charts.vbars(weekday)}
      <div class="sub center">${busiest.total > 0 ? `<b>${busiest.label}</b> is your heaviest day — ${fmt(busiest.total)} across ${busiest.count} ${busiest.count === 1 ? "expense" : "expenses"}` : ""}</div>
    </div>` : ""}

    ${tod.timed > 0 ? `<div class="sec"><span class="h2">Time of day</span></div>
    <div class="card flat" style="padding:10px 12px">
      ${tod.blocks.map(b => {
        const pc = todMax ? Math.round(b.total / todMax * 100) : 0;
        return `<div class="rank">
          <div class="emo" style="background:var(--chip)">${b.emoji}</div>
          <div class="mid">
            <div class="nm"><span>${b.label} <span class="sub">${b.hint}</span></span><b class="money">${fmt(b.total)}</b></div>
            <div class="bar"><i style="width:${pc}%;background:var(--primary)"></i></div>
          </div>
        </div>`;
      }).join("")}
    </div>` : ""}

    <div class="sec"><span class="h2">${trend.title}</span></div>
    <div class="card">
      ${Charts.incExpBars(trend.bars)}
      <div class="card-row mt8">
        <span class="sub"><span style="color:var(--green)">●</span> Income ${fmt(inc)}</span>
        <span class="sub"><span style="color:var(--red)">●</span> Expense ${fmt(exp)}</span>
        <span class="sub"><b class="${inc - exp >= 0 ? "pos" : "neg"} money">${fmt(inc - exp, true)}</b> saved</span>
      </div>
    </div>

    <div class="sec"><span class="h2">Net worth</span><span class="sub">last 6 months</span></div>
    <div class="card">
      <div class="card-row mb8">
        <span class="h2 money">${fmt(nw[nw.length - 1].value)}</span>
        <span class="sub ${nwChange >= 0 ? "pos" : "neg"}"><b>${fmt(nwChange, true)}</b> ${nwChange >= 0 ? "growth" : "drop"} over 6 months</span>
      </div>
      ${Charts.line([{ values: nw.map(p => p.value), color: "var(--primary)", fill: true }], nw.map(p => p.label), 340, 150)}
    </div>

    ${anomalies.length ? `<div class="sec"><span class="h2">Unusual spending</span></div>
    <div class="card flat stagger" style="padding:8px 10px">
      ${anomalies.map(a => {
        const c = Store.cat(a.tx.categoryId);
        return `<div class="tx" data-action="tx-detail" data-id="${a.tx.id}">
          <div class="emo" style="background:${tint("#fbbf24", .18)}">⚠️</div>
          <div class="mid">
            <div class="nm">${esc(a.tx.payee || c.name)}</div>
            <div class="meta">${a.times.toFixed(1)}× your usual ${esc(c.name)} (${fmt(Math.round(a.mean))}) · ${D.short(a.tx.date)}</div>
          </div>
          <div class="amt neg money">${fmt(a.tx.amount)}</div>
        </div>`;
      }).join("")}
    </div>` : ""}`;
  },

  statsAfter() {
    const f = document.getElementById("cr-from"), t = document.getElementById("cr-to");
    if (!f || !t) return;
    const apply = () => {
      let from = f.value, to = t.value;
      if (!from || !to) return;
      if (from > to) [from, to] = [to, from];       // tolerate a backwards range
      UI.stats.custom = { from, to };
      App.render();
    };
    f.onchange = apply;
    t.onchange = apply;
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
    ${overall ? Views.burndownCard(overall) : ""}
    <div class="sec"><span class="h2">Category budgets</span></div>
    <div class="stagger">
    ${others.length ? others.map(budCard).join("") : '<div class="empty"><div class="big">🎯</div>No category budgets yet.<br>Tap + to create one.</div>'}
    </div>`;
  },

  /* actual spend pace vs the even-burn line for the selected month */
  burndownCard(budget) {
    const { y, m } = UI.month;
    const { points, dim } = Store.burndown(y, m);
    if (!points.length) return "";
    const ideal = points.map(p => budget.amount / dim * p.day);
    const actual = points.map(p => p.cum);
    const last = points[points.length - 1];
    const drift = Math.round(last.cum - budget.amount / dim * last.day);
    const projected = Math.round(last.cum / last.day * dim);
    const labels = points.map(p => (p.day === 1 || p.day % 7 === 0) ? String(p.day) : "");
    const over = drift > 0;

    return `<div class="card">
      <div class="card-row mb8">
        <span class="sub"><b>Spending pace</b></span>
        <span class="sub ${over ? "neg" : "pos"}"><b>${over ? "▲ " + fmt(drift) + " ahead of pace" : "▼ " + fmt(-drift) + " under pace"}</b></span>
      </div>
      ${Charts.line([
        { values: ideal, color: "var(--faint)", dashed: true, dot: false },
        { values: actual, color: over ? "var(--red)" : "var(--green)", fill: true },
      ], labels, 340, 150, { yMax: Math.max(budget.amount, ...actual) })}
      <div class="card-row mt8">
        <span class="sub"><span style="color:var(--faint)">┈</span> even pace</span>
        <span class="sub"><span style="color:${over ? "var(--red)" : "var(--green)"}">●</span> actual</span>
        <span class="sub">projected <b class="money ${projected > budget.amount ? "neg" : "pos"}">${fmt(projected)}</b></span>
      </div>
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
    } else if (tab === "categories") {
      body = splitCategoryPanel(null, "everyone");
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
      ${[["friends", "Friends"], ["groups", "Groups"], ["activity", "Activity"], ["categories", "Categories"]]
        .map(([k, lb]) => `<button class="${tab === k ? "on" : ""}" data-action="splits-tab" data-tab="${k}" style="font-size:12px">${lb}</button>`).join("")}
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
      <button class="btn ghost mt8" data-action="friend-statement" data-id="${f.id}">📄 Send statement</button>
    </div>
    ${shared.length ? `<div class="sec"><span class="h2">Shared groups</span></div>
    <div class="card flat" style="padding:8px 10px">
      ${shared.map(g => `<div class="person" data-action="group-detail" data-id="${g.id}">
        <div class="pavatar" style="background:var(--chip);font-size:18px">${g.emoji || "👥"}</div>
        <div class="mid"><div class="nm">${esc(g.name)}</div></div><span class="sub">›</span></div>`).join("")}
    </div>` : ""}

    <div class="tabbar">
      ${[["activity", "Activity"], ["categories", "Categories"]].map(([k, lb]) =>
        `<button class="${UI.friendTab === k ? "on" : ""}" data-action="friend-tab" data-t="${k}">${lb}</button>`).join("")}
    </div>

    ${UI.friendTab === "categories" ? splitCategoryPanel(f.id, f.name) : `
    ${periodTabs(UI.splitPeriod)}
    <div class="card flat" style="padding:6px 10px">
      ${activity.length
        ? periodSections(activity, UI.splitPeriod).map(sec =>
            sectionBlock(sec, friendActivityRow, items =>
              fmt(items.reduce((s, it) => s + it.delta, 0), true))).join("")
        : '<div class="empty">No 1-to-1 activity yet.</div>'}
    </div>`}`;
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

  /* ================= NOTES ================= */
  notes() {
    const list = Store.sortedNotes(UI.notesQuery, UI.notesTag);
    const pinned = list.filter(n => n.pinned);
    const rest = list.filter(n => !n.pinned);
    const total = Store.state.notes.length;

    const card = (n) => {
      const tag = NOTE_TAGS.find(t => t.id === n.tag) || NOTE_TAGS[0];
      const title = n.title.trim() || n.body.trim().split("\n")[0] || "Untitled note";
      const snippet = n.body.trim().split("\n").filter(l => l.trim() && l.trim() !== n.title.trim()).slice(0, 2).join(" · ");
      return `<div class="note-card" data-action="note-open" data-id="${n.id}" style="--nc:${n.color}">
        <div class="note-top">
          <div class="note-title">${esc(title)}</div>
          <button class="note-pin ${n.pinned ? "on" : ""}" data-action="note-pin" data-id="${n.id}" aria-label="Pin">
            <svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 4 3v2H6v-2l4-3-1-6Z"/><path d="M12 15v5"/></svg>
          </button>
        </div>
        ${snippet ? `<div class="note-snip">${esc(snippet)}</div>` : ""}
        <div class="note-foot"><span>${tag.emoji} ${esc(tag.name)}</span><span>${D.ago(n.updated)}</span></div>
      </div>`;
    };

    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">Notes</span>
      <button class="icon-btn" data-action="note-new"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
    ${total ? `<div class="search-row">
      <input class="input" id="note-search" placeholder="🔍  Search notes…" value="${esc(UI.notesQuery)}">
    </div>
    <div class="filter-chips">
      <button class="chip ${UI.notesTag === "all" ? "on" : ""}" data-action="notes-tag" data-t="all">All</button>
      ${NOTE_TAGS.map(t => `<button class="chip ${UI.notesTag === t.id ? "on" : ""}" data-action="notes-tag" data-t="${t.id}">
        <span class="em">${t.emoji}</span>${esc(t.name)}</button>`).join("")}
    </div>` : ""}

    ${!total ? `<div class="empty"><div class="big">🗒️</div>
        No notes yet.<br>Jot down cash spends, loan terms, anything.</div>
      <button class="btn primary" data-action="note-new">＋ Write your first note</button>`
      : !list.length ? '<div class="empty"><div class="big">🔎</div>Nothing matches that.</div>'
      : `${pinned.length ? `<div class="sec"><span class="h2">📌 Pinned</span></div>
          <div class="note-list stagger">${pinned.map(card).join("")}</div>` : ""}
         ${rest.length ? `${pinned.length ? '<div class="sec"><span class="h2">Others</span></div>' : ""}
          <div class="note-list stagger">${rest.map(card).join("")}</div>` : ""}`}`;
  },

  /* custom-range inputs inside the split category panel */
  wireSplitCatRange() {
    const f = document.getElementById("sc-from"), t = document.getElementById("sc-to");
    if (!f || !t) return;
    const apply = () => {
      let from = f.value, to = t.value;
      if (!from || !to) return;
      if (from > to) [from, to] = [to, from];
      UI.splitCat.custom = { from, to };
      App.render();
    };
    f.onchange = apply; t.onchange = apply;
  },

  splitsAfter() { Views.wireSplitCatRange(); },
  friendDetailAfter() { Views.wireSplitCatRange(); },

  notesAfter() {
    const s = document.getElementById("note-search");
    if (s) s.addEventListener("input", () => {
      UI.notesQuery = s.value;
      const pos = s.selectionStart;
      App.render();
      const s2 = document.getElementById("note-search");
      if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); }
    });
  },

  /* full-page editor — a cramped bottom sheet is no good for real writing */
  noteEdit() {
    const n = Store.note(UI.noteId);
    if (!n) { UI.view = "notes"; return Views.notes(); }
    const tag = NOTE_TAGS.find(t => t.id === n.tag) || NOTE_TAGS[0];
    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1" style="font-size:15px;color:var(--muted);font-weight:600">${tag.emoji} ${esc(tag.name)}</span>
      <button class="icon-btn ${n.pinned ? "pin-on" : ""}" data-action="note-pin" data-id="${n.id}" title="Pin">
        <svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 4 3v2H6v-2l4-3-1-6Z"/><path d="M12 15v5"/></svg>
      </button>
      <button class="icon-btn" data-action="note-delete" data-id="${n.id}" title="Delete">
        <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13"/></svg>
      </button>
    </div>

    <div class="note-editor" style="--nc:${n.color}">
      <input class="note-input-title" id="ne-title" placeholder="Title" value="${esc(n.title)}">
      <textarea class="note-input-body" id="ne-body" placeholder="Start writing…&#10;&#10;e.g. Lent 2,000 to Vikram on the 3rd — he'll return after salary.">${esc(n.body)}</textarea>
    </div>

    <div class="note-tools">
      <div class="note-colors" id="ne-colors">
        ${NOTE_COLORS.map(c => `<button class="${c === n.color ? "on" : ""}" style="background:${c}" data-c="${c}"></button>`).join("")}
      </div>
      <select class="input" id="ne-tag" style="width:auto;padding:8px 30px 8px 12px;border-radius:12px;font-size:13px">
        ${NOTE_TAGS.map(t => `<option value="${t.id}" ${t.id === n.tag ? "selected" : ""}>${t.emoji} ${esc(t.name)}</option>`).join("")}
      </select>
    </div>
    <div class="sub center mt8" id="ne-saved">Saved ${D.ago(n.updated)}</div>`;
  },

  noteEditAfter() {
    const title = document.getElementById("ne-title");
    const body = document.getElementById("ne-body");
    const stamp = document.getElementById("ne-saved");
    if (!title || !body) return;

    const grow = () => { body.style.height = "auto"; body.style.height = Math.max(260, body.scrollHeight) + "px"; };
    grow();

    let timer = null;
    const queueSave = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        Store.updateNote(UI.noteId, { title: title.value, body: body.value });
        if (stamp) stamp.textContent = "Saved just now";
      }, 400);
    };
    title.addEventListener("input", queueSave);
    body.addEventListener("input", () => { grow(); queueSave(); });

    // flushed by App.back()/App.go() so nothing is lost on the way out
    NoteEditor.flush = () => {
      clearTimeout(timer);
      const t = document.getElementById("ne-title"), b = document.getElementById("ne-body");
      if (t && b && UI.noteId) Store.updateNote(UI.noteId, { title: t.value, body: b.value });
      NoteEditor.flush = null;
    };

    document.getElementById("ne-colors").onclick = (e) => {
      const btn = e.target.closest("[data-c]");
      if (!btn) return;
      Store.updateNote(UI.noteId, { color: btn.dataset.c });
      document.querySelectorAll("#ne-colors button").forEach(x => x.classList.toggle("on", x.dataset.c === btn.dataset.c));
      document.querySelector(".note-editor").style.setProperty("--nc", btn.dataset.c);
    };
    document.getElementById("ne-tag").onchange = (e) => {
      Store.updateNote(UI.noteId, { tag: e.target.value });
      App.render();
    };
    if (!title.value && !body.value) title.focus();
  },

  /* ================= LEND & BORROW ================= */
  loans() {
    const s = Store.state;
    const t = Store.loanTotals();
    const tab = UI.loansTab;
    const all = s.loans.map(l => ({ l, st: Store.loanStatus(l) }));
    const list = tab === "closed"
      ? all.filter(x => x.st.closed)
      : all.filter(x => !x.st.closed && x.l.type === tab);
    // overdue first, then soonest due, then biggest
    list.sort((a, b) =>
      (b.st.overdue - a.st.overdue) ||
      ((a.l.dueDate || "9999") < (b.l.dueDate || "9999") ? -1 : 1) ||
      (b.st.remaining - a.st.remaining));

    const card = ({ l, st }) => {
      const name = Store.loanPerson(l);
      const f = l.personId ? Store.friend(l.personId) : null;
      const colour = f ? f.color : (l.type === "lent" ? "#34d399" : "#fb7185");
      const badge = st.closed ? `<span class="delta flat">settled ✓</span>`
        : st.overdue ? `<span class="delta up">overdue</span>`
        : st.dueSoon ? `<span class="delta warn-chip">due soon</span>` : "";
      return `<div class="card bud" data-action="loan-detail" data-id="${l.id}" style="margin-bottom:10px">
        <div class="top">
          <div class="pavatar" style="background:${colour};width:40px;height:40px;font-size:14px">${esc(initials(name))}</div>
          <div style="flex:1;min-width:0">
            <div class="nm">${esc(name)} ${badge}</div>
            <div class="st">${l.type === "lent" ? "You lent" : "You borrowed"} ${fmt(l.amount)}${l.rate ? " · " + l.rate + "% p.a." : ""}${l.dueDate ? " · due " + D.short(l.dueDate) : ""}</div>
          </div>
          <div class="rem ${st.closed ? "muted" : l.type === "lent" ? "pos" : "neg"}">${st.closed ? "—" : fmt(st.remaining)}</div>
        </div>
        <div class="bar"><i style="width:${st.pct}%;background:${st.closed ? "var(--green)" : st.overdue ? "var(--red)" : colour}"></i></div>
        <div class="sub mt8" style="font-size:11.5px">${fmt(st.repaid)} of ${fmt(st.total)} repaid${st.interest ? " · incl. " + fmt(st.interest) + " interest" : ""}</div>
      </div>`;
    };

    return `
    <div class="back-head">
      <button class="icon-btn" data-action="back"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span class="h1">Lend & Borrow</span>
      <button class="icon-btn" data-action="add-loan"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
    <div class="split-hero">
      <div class="cell"><div class="lab">Owed to you</div><div class="val pos money">${fmt(t.lentOut)}</div></div>
      <div class="cell"><div class="lab">You owe</div><div class="val neg money">${fmt(t.borrowed)}</div></div>
    </div>
    ${t.overdue ? `<div class="card flat" style="border-color:rgba(251,113,133,.45);margin-bottom:14px">
      <b>⏰ ${t.overdue} loan${t.overdue > 1 ? "s are" : " is"} past the due date</b>
    </div>` : ""}
    <div class="tabbar">
      ${[["lent", "Lent out"], ["borrowed", "Borrowed"], ["closed", "Settled"]].map(([k, lb]) =>
        `<button class="${tab === k ? "on" : ""}" data-action="loans-tab" data-t="${k}">${lb}</button>`).join("")}
    </div>
    <div class="stagger">
      ${list.length ? list.map(card).join("")
        : `<div class="empty"><div class="big">${tab === "closed" ? "✅" : "🤝"}</div>${
            tab === "lent" ? "Nothing lent out right now."
            : tab === "borrowed" ? "You haven't borrowed anything."
            : "No settled loans yet."}</div>
           ${tab !== "closed" ? `<button class="btn primary" data-action="add-loan">＋ Record a loan</button>` : ""}`}
    </div>`;
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
      ${item("🗒️", "Notes", Store.state.notes.length ? Store.state.notes.length + " saved" : "none yet", "open-notes")}
      ${item("🤝", "Lend & Borrow", (() => { const t = Store.loanTotals();
        return t.lentOut || t.borrowed ? fmt(t.lentOut) + " out · " + fmt(t.borrowed) + " owed" : "none active"; })(), "open-loans")}
      ${item("🐷", "Savings Goals", Store.state.goals.length + " active", "open-goals")}
      ${item("🔄", "Recurring", Store.state.recurring.length + " items", "open-recurring")}
      ${item("🏷️", "Categories", Store.state.categories.length + "", "open-categories")}
    </div>

    <div class="menu">
      ${item("🔒", "App lock", s.lock ? (s.biometric ? "PIN + fingerprint" : "PIN on") : "off", "open-security")}
      ${item("🔔", "Reminders", s.reminders && s.reminders.enabled ? "on" : "off", "open-reminders")}
      ${item("🎨", "Theme", s.theme === "dark" ? "Dark" : "Light", "toggle-theme")}
      ${item("💱", "Currency", cur.code + " " + cur.sym, "pick-currency")}
    </div>

    <div class="menu">
      ${item("📄", "Monthly statement", "PDF", "open-statement")}
      ${item("📤", "Export CSV", "transactions", "export-csv")}
      ${item("💾", "Backup data", "JSON file", "backup-json")}
      ${item("📥", "Restore backup", "", "restore-json")}
      ${item("🧪", "Reset demo data", "", "reset-demo")}
      ${item("🗑️", "Erase everything", "", "erase-all")}
    </div>
    <p class="sub center" style="margin-top:18px">Budget Bhai · v2.4 · data stays on your device 🔒</p>`;
  },
};
