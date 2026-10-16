/* ============ Paisa — bottom sheet forms ============ */
"use strict";

/* =============== ADD / EDIT TRANSACTION =============== */
const TxSheet = {
  st: null,

  open(editTx) {
    const s = Store.state;
    this.st = editTx ? {
      id: editTx.id, type: editTx.type, catId: editTx.categoryId,
      accId: editTx.accountId, toAccId: editTx.toAccountId || (s.accounts[1] && s.accounts[1].id),
      date: editTx.date, payee: editTx.payee || "", note: editTx.note || "",
      expr: String(editTx.amount),
    } : {
      id: null, type: "expense",
      catId: (s.categories.find(c => c.type === "expense") || {}).id,
      accId: (s.accounts[0] || {}).id, toAccId: (s.accounts[1] || s.accounts[0] || {}).id,
      date: D.todayISO(), payee: "", note: "", expr: "",
    };
    this.st.split = {
      on: false, method: "equal",
      sel: Object.fromEntries([["me", true], ...s.friends.map(f => [f.id, true])]),
      amounts: {},
    };
    this.render();
  },

  /* optional inline split (new expenses only) */
  splitBlock() {
    const st = this.st, friends = Store.state.friends;
    if (!friends.length) return "";
    if (!st.split.on) return `
      <div class="field">
        <button class="btn ghost" id="tx-split-toggle" style="border-style:dashed">🧑‍🤝‍🧑 Split this expense with friends</button>
      </div>`;
    const row = (id, name, color) => `
      <div class="share-row">
        <div class="pavatar" style="background:${color};width:32px;height:32px;font-size:12px">${esc(initials(name))}</div>
        <span class="nm">${esc(name)}</span>
        <input type="number" class="input txsp-amt" data-id="${id}" placeholder="0"
          value="${st.split.amounts[id] || ""}" style="display:${st.split.method === "unequal" ? "" : "none"};width:100px;padding:8px 10px;text-align:right">
        <input type="checkbox" class="txsp-mem" value="${id}" ${st.split.sel[id] ? "checked" : ""}>
      </div>`;
    return `
    <div class="field split-box">
      <div class="card-row" style="margin-bottom:8px">
        <label style="margin:0">🧑‍🤝‍🧑 Splitting with</label>
        <button class="card-link" id="tx-split-toggle">✕ Remove split</button>
      </div>
      <div class="seg" style="margin-bottom:8px">
        <button class="${st.split.method === "equal" ? "on" : ""}" data-spm="equal">Equally</button>
        <button class="${st.split.method === "unequal" ? "on" : ""}" data-spm="unequal">Unequally</button>
      </div>
      ${row("me", "You", "#7c6bff")}
      ${friends.map(f => row(f.id, f.name, f.color)).join("")}
      <div class="sub" id="tx-split-check" style="margin-top:6px"></div>
    </div>`;
  },

  paintSplit() {
    const el = document.getElementById("tx-split-check");
    if (!el) return;
    const st = this.st, total = this.eval();
    const active = Object.keys(st.split.sel).filter(id => st.split.sel[id]);
    if (active.length < 2) { el.innerHTML = '<span class="warn">Pick at least 2 people</span>'; return; }
    if (st.split.method === "equal") {
      el.textContent = total ? "≈ " + fmt(total / active.length) + " each · " + active.length + " people" : "Enter the amount above first";
    } else {
      const sum = active.reduce((s, id) => s + (st.split.amounts[id] || 0), 0);
      el.innerHTML = total ? (Math.abs(sum - total) < 0.01 ? "✅ adds up to " + fmt(total)
        : `<span class="warn">⚠️ entered ${fmt(sum)} of ${fmt(total)}</span>`) : "Enter the amount above first";
    }
  },

  render() {
    const st = this.st;
    const cur = currencyInfo();
    const isTrf = st.type === "transfer";
    Sheet.open(`
      <div class="sheet-title">${st.id ? "Edit" : "Add"} transaction</div>
      <div class="seg">
        <button class="${st.type === "expense" ? "on exp" : ""}" data-txtype="expense">Expense</button>
        <button class="${st.type === "income" ? "on inc" : ""}" data-txtype="income">Income</button>
        <button class="${st.type === "transfer" ? "on trf" : ""}" data-txtype="transfer">Transfer</button>
      </div>
      <div class="amount-display">
        <div><span class="cur">${cur.sym}</span><span class="num money" id="np-num">0</span></div>
        <div class="expr" id="np-expr"></div>
      </div>
      <div class="numpad" id="numpad">
        <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="op" data-k="back">⌫</button>
        <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button><button class="op" data-k="+">＋</button>
        <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button><button class="op" data-k="-">－</button>
        <button data-k=".">.</button><button data-k="0">0</button><button data-k="00">00</button><button class="op" data-k="=">＝</button>
      </div>

      ${!isTrf ? `
      <div class="field mt14"><label>Category</label>
        <div class="chips" id="tx-cats">${categoryChips(st.type, st.catId)}</div>
      </div>
      <div class="field"><label>Account</label>
        <select class="input" id="tx-acc">${accountOptions(st.accId)}</select>
      </div>
      ${st.type === "expense" && !st.id ? this.splitBlock() : ""}` : `
      <div class="row2 mt14">
        <div class="field"><label>From</label><select class="input" id="tx-acc">${accountOptions(st.accId)}</select></div>
        <div class="field"><label>To</label><select class="input" id="tx-toacc">${accountOptions(st.toAccId)}</select></div>
      </div>`}

      <div class="row2">
        <div class="field"><label>Date</label><input type="date" class="input" id="tx-date" value="${st.date}"></div>
        <div class="field"><label>${isTrf ? "Label" : "Payee / Merchant"}</label><input class="input" id="tx-payee" placeholder="${isTrf ? "e.g. wallet top-up" : "e.g. Zomato"}" value="${esc(st.payee)}"></div>
      </div>
      <div class="field"><label>Note</label><input class="input" id="tx-note" placeholder="optional" value="${esc(st.note)}"></div>

      <button class="btn primary" id="tx-save">${st.id ? "Save changes" : "Add transaction"}</button>
      ${st.id ? `<button class="btn danger mt8" id="tx-delete">Delete</button>` : ""}
    `);
    this.wire();
    this.paint();
  },

  wire() {
    const st = this.st;
    document.querySelectorAll("#sheet [data-txtype]").forEach(b =>
      b.onclick = () => {
        st.type = b.dataset.txtype;
        if (st.type !== "transfer") {
          const c = Store.state.categories.find(x => x.type === st.type && x.id === st.catId);
          if (!c) st.catId = (Store.state.categories.find(x => x.type === st.type) || {}).id;
        }
        this.grab(); this.render();
      });
    document.getElementById("numpad").onclick = (e) => {
      const k = e.target.closest("[data-k]")?.dataset.k;
      if (k) { this.key(k); }
    };
    const cats = document.getElementById("tx-cats");
    if (cats) cats.onclick = (e) => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      st.catId = b.dataset.cat;
      cats.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c.dataset.cat === st.catId));
    };
    const tgl = document.getElementById("tx-split-toggle");
    if (tgl) tgl.onclick = () => { this.grab(); st.split.on = !st.split.on; this.render(); };
    document.querySelectorAll("#sheet [data-spm]").forEach(b => b.onclick = () => {
      this.grab(); st.split.method = b.dataset.spm; this.render();
    });
    document.querySelectorAll(".txsp-mem").forEach(c => c.onchange = () => { st.split.sel[c.value] = c.checked; this.paintSplit(); });
    document.querySelectorAll(".txsp-amt").forEach(i => i.oninput = () => { st.split.amounts[i.dataset.id] = parseFloat(i.value) || 0; this.paintSplit(); });
    document.getElementById("tx-save").onclick = () => this.save();
    const del = document.getElementById("tx-delete");
    if (del) del.onclick = () => confirmSheet("Delete transaction?", "This cannot be undone.", "Delete", () => {
      undoToast("Transaction deleted", Store.removeFrom("transactions", st.id)); App.render();
    });
  },

  grab() {
    const st = this.st;
    const g = id => document.getElementById(id);
    if (g("tx-date")) st.date = g("tx-date").value || st.date;
    if (g("tx-payee")) st.payee = g("tx-payee").value;
    if (g("tx-note")) st.note = g("tx-note").value;
    if (g("tx-acc")) st.accId = g("tx-acc").value;
    if (g("tx-toacc")) st.toAccId = g("tx-toacc").value;
  },

  key(k) {
    const st = this.st;
    if (k === "back") st.expr = st.expr.slice(0, -1);
    else if (k === "=") st.expr = String(this.eval());
    else if (k === "+" || k === "-") {
      if (/[\d.]$/.test(st.expr)) st.expr += k;
    } else if (k === ".") {
      const last = st.expr.split(/[+\-]/).pop();
      if (!last.includes(".")) st.expr += st.expr === "" || /[+\-]$/.test(st.expr) ? "0." : ".";
    } else {
      const last = st.expr.split(/[+\-]/).pop();
      if (last.replace(".", "").length < 9) st.expr += k;
    }
    this.paint();
  },

  eval() {
    let total = 0, sign = 1;
    for (const tok of this.st.expr.match(/(\d+\.?\d*)|[+\-]/g) || []) {
      if (tok === "+") sign = 1;
      else if (tok === "-") sign = -1;
      else total += sign * parseFloat(tok);
    }
    return Math.max(0, Math.round(total * 100) / 100);
  },

  paint() {
    const numEl = document.getElementById("np-num"), exprEl = document.getElementById("np-expr");
    if (!numEl) return;
    const val = this.eval();
    numEl.textContent = new Intl.NumberFormat(currencyInfo().locale).format(val);
    exprEl.textContent = /[+\-]/.test(this.st.expr.slice(1)) ? this.st.expr : "";
    this.paintSplit();
  },

  save() {
    this.grab();
    const st = this.st, amount = this.eval();
    if (!amount) return toast("Enter an amount first", "✏️");
    if (st.type === "transfer" && st.accId === st.toAccId) return toast("Pick two different accounts", "⚠️");

    // validate the optional split before anything is written
    let splitData = null;
    if (st.type === "expense" && !st.id && st.split.on) {
      const active = Object.keys(st.split.sel).filter(id => st.split.sel[id]);
      if (active.length < 2) return toast("Pick at least 2 people to split", "⚠️");
      let shares;
      if (st.split.method === "equal") {
        const each = Math.floor(amount / active.length * 100) / 100;
        shares = active.map((id, i) => ({ id, amount: i === 0 ? Math.round((amount - each * (active.length - 1)) * 100) / 100 : each }));
      } else {
        shares = active.map(id => ({ id, amount: st.split.amounts[id] || 0 }));
        const sum = shares.reduce((s, x) => s + x.amount, 0);
        if (Math.abs(sum - amount) > 0.01) return toast("Shares must add up to the total", "⚠️");
      }
      splitData = {
        id: uid(), groupId: null, desc: st.payee.trim() || Store.cat(st.catId).name,
        categoryId: st.catId, amount, paidBy: "me", shares, date: st.date,
      };
    }

    const data = {
      type: st.type, amount, date: st.date, payee: st.payee.trim(), note: st.note.trim(),
      categoryId: st.type === "transfer" ? null : st.catId,
      accountId: st.accId, toAccountId: st.type === "transfer" ? st.toAccId : undefined,
    };
    if (st.id) { Store.updateTransaction(st.id, data); toast("Saved", "✅"); }
    else {
      // stamp the clock so the time-of-day breakdown has something to work with
      data.time = new Date().toTimeString().slice(0, 5);
      if (splitData) data.splitId = splitData.id;          // so "my share" knows your portion
      Store.addTransaction(data);
      if (splitData) {
        splitData.txId = Store.state.transactions[Store.state.transactions.length - 1].id;
        Store.state.splitExpenses.push(splitData);
        Store.save();
      }
      toast(splitData ? "Expense added · split tracked 🧾" : st.type === "expense" ? "Expense added" : st.type === "income" ? "Income added" : "Transfer added", "✅");
    }
    Sheet.close(); App.render();
  },
};

/* =============== TRANSACTION DETAIL =============== */
function txDetailSheet(id) {
  const t = Store.state.transactions.find(x => x.id === id);
  if (!t) return;
  const c = t.categoryId ? Store.cat(t.categoryId) : { emoji: "🔁", name: "Transfer", color: "#60a5fa" };
  Sheet.open(`
    <div class="center" style="padding:6px 0 2px">
      <div class="emo" style="width:56px;height:56px;border-radius:18px;background:${tint(c.color, .16)};display:inline-flex;align-items:center;justify-content:center;font-size:26px">${c.emoji}</div>
      <div class="h2 mt8">${esc(t.payee || c.name)}</div>
      <div class="h1 money ${t.type === "income" ? "pos" : t.type === "expense" ? "neg" : ""}" style="margin:6px 0">${t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}${fmt(t.amount)}</div>
      <div class="sub">${c.name} · ${esc(Store.acc(t.accountId)?.name || "")}${t.toAccountId ? " → " + esc(Store.acc(t.toAccountId)?.name || "") : ""} · ${D.human(t.date)}</div>
      ${t.note ? `<div class="sub mt8">📝 ${esc(t.note)}</div>` : ""}
    </div>
    <div class="row3 mt14">
      <button class="btn ghost" id="txd-edit">✏️ Edit</button>
      <button class="btn ghost" id="txd-dup">📄 Copy</button>
      <button class="btn danger" id="txd-del">🗑️</button>
    </div>`);
  document.getElementById("txd-edit").onclick = () => TxSheet.open(t);
  document.getElementById("txd-dup").onclick = () => {
    Store.addTransaction({ ...t, id: undefined, date: D.todayISO() });
    toast("Duplicated for today", "📄"); Sheet.close(); App.render();
  };
  document.getElementById("txd-del").onclick = () => confirmSheet("Delete transaction?", "This cannot be undone.", "Delete", () => {
    undoToast("Transaction deleted", Store.removeFrom("transactions", t.id)); App.render();
  });
}

/* =============== BUDGET =============== */
function budgetSheet(editId) {
  const b = editId ? Store.state.budgets.find(x => x.id === editId) : null;
  const usedCats = Store.state.budgets.map(x => x.categoryId);
  const opts = [
    !usedCats.includes("ALL") || (b && b.categoryId === "ALL") ? `<option value="ALL" ${b?.categoryId === "ALL" ? "selected" : ""}>🎯 Overall (all spending)</option>` : "",
    ...Store.state.categories.filter(c => c.type === "expense" && (!usedCats.includes(c.id) || (b && b.categoryId === c.id)))
      .map(c => `<option value="${c.id}" ${b?.categoryId === c.id ? "selected" : ""}>${c.emoji} ${esc(c.name)}</option>`),
  ].join("");
  Sheet.open(`
    <div class="sheet-title">${b ? "Edit" : "New"} budget</div>
    <div class="field"><label>Category</label><select class="input" id="bud-cat" ${b ? "disabled" : ""}>${opts}</select></div>
    <div class="field"><label>Monthly limit (${currencyInfo().sym})</label>
      <input class="input" type="number" min="1" id="bud-amt" placeholder="e.g. 8000" value="${b ? b.amount : ""}"></div>
    <button class="btn primary" id="bud-save">${b ? "Save" : "Create budget"}</button>
    ${b ? `<button class="btn danger mt8" id="bud-del">Delete budget</button>` : ""}`);
  document.getElementById("bud-save").onclick = () => {
    const amt = parseFloat(document.getElementById("bud-amt").value);
    if (!amt || amt <= 0) return toast("Enter a valid limit", "✏️");
    if (b) { b.amount = amt; }
    else Store.state.budgets.push({ id: uid(), categoryId: document.getElementById("bud-cat").value, amount: amt });
    Store.save(); toast("Budget saved", "🎯"); Sheet.close(); App.render();
  };
  if (b) document.getElementById("bud-del").onclick = () => confirmSheet("Delete budget?", "Your transactions are not affected.", "Delete", () => {
    Store.state.budgets = Store.state.budgets.filter(x => x.id !== b.id);
    Store.save(); toast("Budget deleted", "🗑️"); App.render();
  });
}

/* =============== ACCOUNT =============== */
function accountSheet(editId) {
  const a = editId ? Store.acc(editId) : null;
  let type = a ? a.type : "bank";
  Sheet.open(`
    <div class="sheet-title">${a ? "Edit" : "New"} account</div>
    <div class="field"><label>Name</label><input class="input" id="acc-name" placeholder="e.g. SBI Savings" value="${a ? esc(a.name) : ""}"></div>
    <div class="field"><label>Type</label>
      <div class="chips wrap" id="acc-types">
        ${ACCOUNT_TYPES.map(t => `<button class="chip ${t.id === type ? "on" : ""}" data-t="${t.id}"><span class="em">${t.emoji}</span>${t.name}</button>`).join("")}
      </div></div>
    <div class="field"><label>${a ? "Initial" : "Current"} balance (${currencyInfo().sym})</label>
      <input class="input" type="number" id="acc-bal" value="${a ? a.initialBalance : ""}" placeholder="0"></div>
    <div class="field" style="display:flex;gap:10px;align-items:center">
      <input type="checkbox" id="acc-excl" style="width:18px;height:18px;accent-color:var(--primary)" ${a?.excludeTotal ? "checked" : ""}>
      <label for="acc-excl" style="margin:0">Exclude from total balance</label></div>
    <button class="btn primary" id="acc-save">${a ? "Save" : "Add account"}</button>
    ${a ? `<button class="btn danger mt8" id="acc-del">Delete account</button>` : ""}`);
  document.getElementById("acc-types").onclick = e => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    type = b.dataset.t;
    document.querySelectorAll("#acc-types .chip").forEach(c => c.classList.toggle("on", c.dataset.t === type));
  };
  document.getElementById("acc-save").onclick = () => {
    const name = document.getElementById("acc-name").value.trim();
    if (!name) return toast("Give the account a name", "✏️");
    const bal = parseFloat(document.getElementById("acc-bal").value) || 0;
    const excl = document.getElementById("acc-excl").checked;
    if (a) Object.assign(a, { name, type, initialBalance: bal, excludeTotal: excl });
    else Store.state.accounts.push({ id: uid(), name, type, initialBalance: bal, excludeTotal: excl });
    Store.save(); toast("Account saved", "🏦"); Sheet.close(); App.render();
  };
  if (a) document.getElementById("acc-del").onclick = () => {
    const used = Store.state.transactions.some(t => t.accountId === a.id || t.toAccountId === a.id);
    if (used) return toast("Account has transactions — delete them first", "⚠️");
    confirmSheet("Delete account?", a.name + " will be removed.", "Delete", () => {
      Store.state.accounts = Store.state.accounts.filter(x => x.id !== a.id);
      Store.save(); toast("Account deleted", "🗑️");
      if (UI.view === "accountDetail") App.back(); else App.render();
    });
  };
}

/* =============== TRANSFER =============== */
function transferSheet() {
  const s = Store.state;
  if (s.accounts.length < 2) return toast("Need at least two accounts", "⚠️");
  Sheet.open(`
    <div class="sheet-title">🔁 Transfer money</div>
    <div class="row2">
      <div class="field"><label>From</label><select class="input" id="tr-from">${accountOptions(s.accounts[0].id)}</select></div>
      <div class="field"><label>To</label><select class="input" id="tr-to">${accountOptions(s.accounts[1].id)}</select></div>
    </div>
    <div class="field"><label>Amount (${currencyInfo().sym})</label><input class="input" type="number" id="tr-amt" placeholder="0"></div>
    <div class="field"><label>Date</label><input class="input" type="date" id="tr-date" value="${D.todayISO()}"></div>
    <button class="btn primary" id="tr-save">Transfer</button>`);
  document.getElementById("tr-save").onclick = () => {
    const from = document.getElementById("tr-from").value, to = document.getElementById("tr-to").value;
    const amt = parseFloat(document.getElementById("tr-amt").value);
    if (!amt || amt <= 0) return toast("Enter an amount", "✏️");
    if (from === to) return toast("Pick two different accounts", "⚠️");
    Store.addTransaction({ type: "transfer", amount: amt, accountId: from, toAccountId: to, date: document.getElementById("tr-date").value, categoryId: null, payee: "", note: "" });
    toast("Transfer recorded", "🔁"); Sheet.close(); App.render();
  };
}

/* =============== FRIENDS & GROUPS =============== */
function friendSheet() {
  Sheet.open(`
    <div class="sheet-title">Add friend</div>
    <div class="field"><label>Name</label><input class="input" id="fr-name" placeholder="e.g. Rahul"></div>
    <button class="btn primary" id="fr-save">Add friend</button>`);
  document.getElementById("fr-save").onclick = () => {
    const name = document.getElementById("fr-name").value.trim();
    if (!name) return toast("Enter a name", "✏️");
    Store.state.friends.push({ id: uid(), name, color: AVATAR_COLORS[Store.state.friends.length % AVATAR_COLORS.length] });
    Store.save(); toast(name + " added", "🧑‍🤝‍🧑"); Sheet.close(); App.render();
  };
}

function groupSheet() {
  const s = Store.state;
  if (!s.friends.length) { toast("Add a friend first", "🧑‍🤝‍🧑"); return friendSheet(); }
  let emoji = "🏖️";
  Sheet.open(`
    <div class="sheet-title">New group</div>
    <div class="field"><label>Name</label><input class="input" id="gr-name" placeholder="e.g. Goa Trip, Flat 402"></div>
    <div class="field"><label>Icon</label>
      <div class="emoji-grid" id="gr-emoji">${["🏖️", "🏠", "🎉", "🍽️", "⚽", "🎬", "🏔️", "💼"].map(e => `<button class="${e === emoji ? "on" : ""}" data-e="${e}">${e}</button>`).join("")}</div></div>
    <div class="field"><label>Members</label>
      ${s.friends.map(f => `<div class="share-row"><div class="pavatar" style="background:${f.color};width:32px;height:32px;font-size:12px">${esc(initials(f.name))}</div>
        <span class="nm">${esc(f.name)}</span><input type="checkbox" class="gr-mem" value="${f.id}" checked></div>`).join("")}
    </div>
    <button class="btn primary" id="gr-save">Create group</button>`);
  document.getElementById("gr-emoji").onclick = e => {
    const b = e.target.closest("[data-e]"); if (!b) return;
    emoji = b.dataset.e;
    document.querySelectorAll("#gr-emoji button").forEach(x => x.classList.toggle("on", x.dataset.e === emoji));
  };
  document.getElementById("gr-save").onclick = () => {
    const name = document.getElementById("gr-name").value.trim();
    if (!name) return toast("Give the group a name", "✏️");
    const members = [...document.querySelectorAll(".gr-mem:checked")].map(c => c.value);
    if (!members.length) return toast("Pick at least one member", "⚠️");
    const g = { id: uid(), name, emoji, memberIds: members };
    Store.state.groups.push(g); Store.save();
    toast("Group created", "🎉"); Sheet.close();
    App.push({ view: "groupDetail", groupId: g.id });
  };
}

/* =============== SPLIT EXPENSE =============== */
function splitSheet(ctx) {
  const s = Store.state;
  if (!s.friends.length) { toast("Add a friend first", "🧑‍🤝‍🧑"); return friendSheet(); }
  const groupId = ctx?.group || null;
  const friendId = ctx?.friend || null;
  const group = groupId ? Store.group(groupId) : null;
  const memberIds = group ? ["me", ...group.memberIds] : friendId ? ["me", friendId] : ["me", ...s.friends.map(f => f.id)];
  let method = "equal";

  const memberRow = (id) => {
    const f = Store.friend(id);
    return `<div class="share-row">
      <div class="pavatar" style="background:${f.color};width:32px;height:32px;font-size:12px">${esc(initials(f.name))}</div>
      <span class="nm">${esc(f.name)}</span>
      <input type="number" class="input sp-amt hidden-amt" data-id="${id}" placeholder="0" style="display:none">
      <input type="checkbox" class="sp-mem" value="${id}" checked>
    </div>`;
  };

  let catId = (s.categories.find(c => c.type === "expense") || {}).id;
  Sheet.open(`
    <div class="sheet-title">Split an expense${group ? " · " + esc(group.name) : ""}</div>
    <div class="field"><label>Description</label><input class="input" id="sp-desc" placeholder="e.g. Dinner at Social"></div>
    <div class="field"><label>Category</label>
      <div class="chips" id="sp-cats">${categoryChips("expense", catId)}</div>
    </div>
    <div class="row2">
      <div class="field"><label>Amount (${currencyInfo().sym})</label><input class="input" type="number" id="sp-total" placeholder="0"></div>
      <div class="field"><label>Date</label><input class="input" type="date" id="sp-date" value="${D.todayISO()}"></div>
    </div>
    <div class="field"><label>Paid by</label>
      <select class="input" id="sp-payer">${memberIds.map(id => `<option value="${id}">${esc(Store.friend(id)?.name || "?")}</option>`).join("")}</select></div>
    <div class="field"><label>Split</label>
      <div class="seg" style="margin-bottom:10px">
        <button class="on" data-m="equal">Equally</button>
        <button data-m="unequal">Unequally</button>
      </div>
      <div id="sp-members">${memberIds.map(memberRow).join("")}</div>
      <div class="sub" id="sp-check"></div>
    </div>
    <div class="field" style="display:flex;gap:10px;align-items:center" id="sp-ledger-row">
      <input type="checkbox" id="sp-ledger" style="width:18px;height:18px;accent-color:var(--primary)" checked>
      <label for="sp-ledger" style="margin:0">Also record <b>my share</b> in my expenses</label>
    </div>
    <button class="btn primary" id="sp-save">Add split expense</button>`);

  const sheetEl = document.getElementById("sheet");
  const catsEl = document.getElementById("sp-cats");
  catsEl.onclick = (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    catId = b.dataset.cat;
    catsEl.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c.dataset.cat === catId));
  };
  sheetEl.querySelectorAll("[data-m]").forEach(b => b.onclick = () => {
    method = b.dataset.m;
    sheetEl.querySelectorAll("[data-m]").forEach(x => x.classList.toggle("on", x.dataset.m === method));
    sheetEl.querySelectorAll(".sp-amt").forEach(i => i.style.display = method === "unequal" ? "" : "none");
    check();
  });
  const check = () => {
    const total = parseFloat(document.getElementById("sp-total").value) || 0;
    const active = [...sheetEl.querySelectorAll(".sp-mem:checked")].map(c => c.value);
    const el = document.getElementById("sp-check");
    if (method === "equal") { el.textContent = active.length && total ? "≈ " + fmt(total / active.length) + " each (" + active.length + " people)" : ""; return; }
    let sum = 0;
    sheetEl.querySelectorAll(".sp-amt").forEach(i => { if (active.includes(i.dataset.id)) sum += parseFloat(i.value) || 0; });
    el.innerHTML = total ? (Math.abs(sum - total) < 0.01 ? "✅ adds up to " + fmt(total) : `<span class="warn">⚠️ entered ${fmt(sum)} of ${fmt(total)}</span>`) : "";
  };
  sheetEl.oninput = check;
  sheetEl.onchange = check;

  document.getElementById("sp-save").onclick = () => {
    const desc = document.getElementById("sp-desc").value.trim();
    const total = parseFloat(document.getElementById("sp-total").value);
    const payer = document.getElementById("sp-payer").value;
    const date = document.getElementById("sp-date").value;
    const active = [...sheetEl.querySelectorAll(".sp-mem:checked")].map(c => c.value);
    if (!desc) return toast("Add a description", "✏️");
    if (!total || total <= 0) return toast("Enter the amount", "✏️");
    if (active.length < 2) return toast("Pick at least 2 people", "⚠️");

    let shares;
    if (method === "equal") {
      const each = Math.floor(total / active.length * 100) / 100;
      shares = active.map((id, i) => ({ id, amount: i === 0 ? Math.round((total - each * (active.length - 1)) * 100) / 100 : each }));
    } else {
      shares = active.map(id => {
        const inp = sheetEl.querySelector(`.sp-amt[data-id="${id}"]`);
        return { id, amount: parseFloat(inp.value) || 0 };
      });
      const sum = shares.reduce((s2, x) => s2 + x.amount, 0);
      if (Math.abs(sum - total) > 0.01) return toast("Shares must add up to the total", "⚠️");
    }
    Store.state.splitExpenses.push({ id: uid(), groupId, desc, categoryId: catId, amount: total, paidBy: payer, shares, date });

    // optionally reflect my share in the personal ledger
    if (document.getElementById("sp-ledger").checked) {
      const mine = shares.find(x => x.id === "me");
      if (mine && mine.amount > 0 && Store.state.accounts.length) {
        Store.addTransaction({
          type: "expense", amount: mine.amount, categoryId: catId,
          accountId: Store.state.accounts[0].id, date, payee: desc, note: "My share of split",
        });
      }
    }
    Store.save(); toast("Split added", "🧾"); Sheet.close(); App.render();
  };
}

/* every shared expense behind one category slice — where, with whom, how much */
function splitCategorySheet(catId, friendId, range) {
  const c = Store.cat(catId);
  const who = friendId ? (Store.friend(friendId)?.name || "") : "";
  const list = Store.splitExpensesInCategory(catId, friendId || null, range.from, range.to);
  const mineTotal = list.reduce((s, e) => s + (e.shares.find(x => x.id === "me")?.amount || 0), 0);
  const theirTotal = friendId
    ? list.reduce((s, e) => s + (e.shares.find(x => x.id === friendId)?.amount || 0), 0) : 0;
  const billTotal = list.reduce((s, e) => s + e.amount, 0);

  const card = (e) => {
    const mine = e.shares.find(x => x.id === "me");
    const payer = Store.friend(e.paidBy);
    const iPaid = e.paidBy === "me";
    const group = e.groupId ? Store.group(e.groupId) : null;
    return `<div class="card flat scx" style="margin-bottom:10px;padding:12px 13px">
      <div class="card-row">
        <div style="min-width:0">
          <div class="nm" style="font-weight:700;font-size:14.5px">${esc(e.desc)}</div>
          <div class="sub" style="margin-top:3px">${D.human(e.date)}${group ? " · " + group.emoji + " " + esc(group.name) : " · 1-to-1"}</div>
        </div>
        <div style="text-align:right;flex:none">
          <div class="money" style="font-weight:700">${fmt(e.amount)}</div>
          <div class="sub" style="font-size:11px">total bill</div>
        </div>
      </div>
      <div class="sub" style="margin:9px 0 7px">
        ${iPaid ? "<b>You</b> paid" : "<b>" + esc(payer?.name || "?") + "</b> paid"} · split ${e.shares.length} ways
      </div>
      <div class="share-chips">
        ${e.shares.map(sh => {
          const p = Store.friend(sh.id);
          const isMe = sh.id === "me", isThem = sh.id === friendId;
          return `<span class="share-chip ${isMe ? "me" : isThem ? "them" : ""}">
            <i style="background:${p?.color || "#888"}"></i>${esc(isMe ? "You" : (p?.name || "?"))} ${fmt(sh.amount)}</span>`;
        }).join("")}
      </div>
      <button class="btn ghost sm mt8" data-action="split-detail" data-id="${e.id}">Open this split</button>
      <span class="sub" style="float:right;margin-top:14px">your share <b class="money">${fmt(mine ? mine.amount : 0)}</b></span>
    </div>`;
  };

  Sheet.open(`
    <div class="sheet-title">${c.emoji} ${esc(c.name)}</div>
    <div class="sub center" style="margin-bottom:12px">
      ${friendId ? "with " + esc(who) : "across all splits"} · ${esc(range.label)}</div>
    <div class="sum3" style="margin-bottom:14px">
      <div class="cell"><div class="lab">Your share</div><div class="val money">${fmt(mineTotal)}</div></div>
      ${friendId ? `<div class="cell"><div class="lab">${esc(who)}</div><div class="val money">${fmt(theirTotal)}</div></div>` : ""}
      <div class="cell"><div class="lab">Total billed</div><div class="val money">${fmt(billTotal)}</div></div>
    </div>
    <div style="max-height:52vh;overflow-y:auto;margin:0 -2px;padding:0 2px">
      ${list.length ? list.map(card).join("") : '<div class="empty">Nothing here.</div>'}
    </div>
    <button class="btn ghost mt8" data-action="close-sheet">Close</button>`);
}

function splitDetailSheet(id) {
  const e = Store.state.splitExpenses.find(x => x.id === id);
  if (!e) return;
  const sc = Store.cat(e.categoryId || "c_other");
  Sheet.open(`
    <div class="sheet-title">${sc.emoji} ${esc(e.desc)}</div>
    <div class="center h1 money mb8">${fmt(e.amount)}</div>
    <div class="sub center mb8">${esc(sc.name)} · ${esc(Store.friend(e.paidBy)?.name || "?")} paid · ${D.human(e.date)}${e.groupId ? " · " + esc(Store.group(e.groupId)?.name || "") : ""}</div>
    <div class="divider"></div>
    ${e.shares.map(sh => `<div class="share-row">
      <div class="pavatar" style="background:${Store.friend(sh.id)?.color || "#888"};width:32px;height:32px;font-size:12px">${esc(initials(Store.friend(sh.id)?.name || "?"))}</div>
      <span class="nm">${esc(Store.friend(sh.id)?.name || "?")}</span>
      <b class="money">${fmt(sh.amount)}</b></div>`).join("")}
    <button class="btn danger mt14" id="spd-del">Delete split</button>
    <button class="btn ghost mt8" data-action="close-sheet">Close</button>`);
  document.getElementById("spd-del").onclick = () => confirmSheet("Delete this split?", "Balances will be recalculated.", "Delete", () => {
    undoToast("Split deleted", Store.removeFrom("splitExpenses", id)); App.render();
  });
}

/* =============== SETTLE UP =============== */
function settleSheet(ctx) {
  const existing = ctx?.edit ? Store.state.settlements.find(s => s.id === ctx.edit) : null;
  const groupId = existing ? existing.groupId : (ctx?.group || null);
  const friendId = ctx?.friend || null;

  // who can appear in the dropdowns
  let memberIds;
  if (groupId) memberIds = ["me", ...(Store.group(groupId)?.memberIds || [])];
  else if (existing) memberIds = ["me", existing.from === "me" ? existing.to : existing.from];
  else memberIds = ["me", friendId];

  /* default direction: whoever actually owes, pays */
  let defFrom, defTo;
  if (existing) {
    defFrom = existing.from; defTo = existing.to;
  } else if (groupId) {
    const edges = Store.groupEdges(groupId);
    const pick = edges.find(e => e.from === "me" || e.to === "me") || edges[0];
    if (pick) { defFrom = pick.from; defTo = pick.to; }
    else { defFrom = memberIds[1] || "me"; defTo = "me"; }
  } else {
    const bal = Store.friendBalance(friendId);        // > 0 => they owe you
    if (bal >= 0) { defFrom = friendId; defTo = "me"; }
    else { defFrom = "me"; defTo = friendId; }
  }

  const opts = (sel) => memberIds
    .map(id => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(Store.friend(id)?.name || "?")}</option>`).join("");
  const startAmt = existing ? Math.round(existing.amount * 100) / 100 : Store.owedBetween(defFrom, defTo, groupId);

  Sheet.open(`
    <div class="sheet-title">🤝 ${existing ? "Edit payment" : "Settle up"}</div>
    <div class="row2">
      <div class="field"><label>Who paid</label>
        <select class="input" id="st-from">${opts(defFrom)}</select></div>
      <div class="field"><label>Received by</label>
        <select class="input" id="st-to">${opts(defTo)}</select></div>
    </div>
    <div class="field">
      <label>Amount (${currencyInfo().sym})</label>
      <input class="input" type="number" id="st-amt" value="${startAmt || ""}">
      <div class="card-row mt8">
        <span class="sub" id="st-owed"></span>
        <button class="btn ghost sm" id="st-full" type="button">Full amount</button>
      </div>
    </div>
    <div class="field"><label>Date</label><input class="input" type="date" id="st-date" value="${existing ? existing.date : D.todayISO()}"></div>
    <button class="btn primary" id="st-save">${existing ? "Save changes" : "Record payment"}</button>
    ${existing ? `<button class="btn danger mt8" id="st-del">Delete payment</button>` : ""}`);

  /* keep the suggested amount in step with the chosen payer / receiver */
  const fromEl = document.getElementById("st-from");
  const toEl = document.getElementById("st-to");
  const amtEl = document.getElementById("st-amt");
  const owedEl = document.getElementById("st-owed");
  let owed = startAmt;

  const refresh = (retarget) => {
    owed = Store.owedBetween(fromEl.value, toEl.value, groupId);
    owedEl.innerHTML = fromEl.value === toEl.value
      ? `<span class="warn">Pick two different people</span>`
      : owed > 0
        ? `${esc(Store.friend(fromEl.value)?.name || "?")} owes <b>${fmt(owed)}</b>`
        : `Nothing outstanding this way`;
    if (retarget) amtEl.value = owed || "";
  };
  fromEl.onchange = () => refresh(true);
  toEl.onchange = () => refresh(true);
  document.getElementById("st-full").onclick = () => { amtEl.value = owed || ""; };
  refresh(false);

  document.getElementById("st-save").onclick = () => {
    const from = document.getElementById("st-from").value, to = document.getElementById("st-to").value;
    const amt = parseFloat(document.getElementById("st-amt").value);
    const date = document.getElementById("st-date").value;
    if (!amt || amt <= 0) return toast("Enter an amount", "✏️");
    if (from === to) return toast("Payer and receiver must differ", "⚠️");
    if (existing) {
      Object.assign(existing, { from, to, amount: amt, date });
      toast("Payment updated", "✅");
    } else {
      Store.state.settlements.push({ id: uid(), groupId, from, to, amount: amt, date });
      toast("Payment recorded", "🤝");
    }
    Store.save(); Sheet.close(); App.render();
  };

  if (existing) document.getElementById("st-del").onclick = () =>
    confirmSheet("Delete this payment?", "Balances will be recalculated.", "Delete", () => {
      undoToast("Payment deleted", Store.removeFrom("settlements", existing.id)); App.render();
    });
}

/* =============== LEND & BORROW =============== */
function loanSheet(editId) {
  const l = editId ? Store.state.loans.find(x => x.id === editId) : null;
  let type = l ? l.type : "lent";
  let personId = l ? l.personId : null;

  Sheet.open(`
    <div class="sheet-title">${l ? "Edit loan" : "Record a loan"}</div>
    <div class="seg">
      <button class="${type === "lent" ? "on" : ""}" data-lt="lent">💸 I lent out</button>
      <button class="${type === "borrowed" ? "on" : ""}" data-lt="borrowed">💰 I borrowed</button>
    </div>
    <div class="field"><label>Person</label>
      ${Store.state.friends.length ? `<div class="chips" id="ln-friends">
        ${Store.state.friends.map(f => `<button class="chip ${personId === f.id ? "on" : ""}" data-f="${f.id}">
          <span class="em">👤</span>${esc(f.name)}</button>`).join("")}
      </div>` : ""}
      <input class="input mt8" id="ln-name" placeholder="Name (or pick a friend above)" value="${l ? esc(l.personName || Store.loanPerson(l)) : ""}">
    </div>
    <div class="row2">
      <div class="field"><label>Amount (${currencyInfo().sym})</label>
        <input class="input" type="number" id="ln-amt" value="${l ? l.amount : ""}" placeholder="0"></div>
      <div class="field"><label>Date given</label>
        <input class="input" type="date" id="ln-date" value="${l ? l.date : D.todayISO()}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Due date <span class="sub">(optional)</span></label>
        <input class="input" type="date" id="ln-due" value="${l ? (l.dueDate || "") : ""}"></div>
      <div class="field"><label>Interest % p.a. <span class="sub">(optional)</span></label>
        <input class="input" type="number" id="ln-rate" value="${l && l.rate ? l.rate : ""}" placeholder="0"></div>
    </div>
    <div class="field"><label>Note</label>
      <input class="input" id="ln-note" placeholder="what it was for" value="${l ? esc(l.note || "") : ""}"></div>
    <button class="btn primary" id="ln-save">${l ? "Save changes" : "Record loan"}</button>
    ${l ? `<button class="btn danger mt8" id="ln-del">Delete loan</button>` : ""}`);

  document.querySelectorAll("#sheet [data-lt]").forEach(b => b.onclick = () => {
    type = b.dataset.lt;
    document.querySelectorAll("#sheet [data-lt]").forEach(x => x.classList.toggle("on", x.dataset.lt === type));
  });
  const fr = document.getElementById("ln-friends");
  if (fr) fr.onclick = (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    personId = personId === b.dataset.f ? null : b.dataset.f;
    fr.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c.dataset.f === personId));
    if (personId) document.getElementById("ln-name").value = Store.friend(personId).name;
  };

  document.getElementById("ln-save").onclick = () => {
    const name = document.getElementById("ln-name").value.trim();
    const amount = parseFloat(document.getElementById("ln-amt").value);
    if (!name) return toast("Who is this loan with?", "✏️");
    if (!amount || amount <= 0) return toast("Enter the amount", "✏️");
    const data = {
      type, personId, personName: name, amount,
      date: document.getElementById("ln-date").value || D.todayISO(),
      dueDate: document.getElementById("ln-due").value || "",
      rate: parseFloat(document.getElementById("ln-rate").value) || 0,
      note: document.getElementById("ln-note").value.trim(),
    };
    if (l) Object.assign(l, data);
    else Store.state.loans.push({ id: uid(), ...data, repayments: [] });
    Store.save();
    toast(l ? "Loan updated" : "Loan recorded", "🤝");
    Sheet.close(); App.render();
  };

  if (l) document.getElementById("ln-del").onclick = () =>
    confirmSheet("Delete this loan?", "Its repayment history goes too.", "Delete", () => {
      undoToast("Loan deleted", Store.removeFrom("loans", l.id)); App.render();
    });
}

function loanDetailSheet(id) {
  const l = Store.state.loans.find(x => x.id === id);
  if (!l) return;
  const st = Store.loanStatus(l);
  const name = Store.loanPerson(l);
  const lent = l.type === "lent";
  const reps = [...(l.repayments || [])].sort((a, b) => a.date < b.date ? 1 : -1);

  Sheet.open(`
    <div class="sheet-title">${lent ? "💸" : "💰"} ${esc(name)}</div>
    <div class="center">
      <div class="sub">${st.closed ? "Fully settled 🎉" : lent ? "still owes you" : "you still owe"}</div>
      <div class="h1 money ${st.closed ? "" : lent ? "pos" : "neg"}" style="margin:4px 0 12px">${fmt(st.remaining)}</div>
      ${st.overdue ? `<div class="sub neg mb8"><b>⏰ Overdue since ${D.short(l.dueDate)}</b></div>` : ""}
    </div>
    <div class="bar big"><i style="width:${st.pct}%;background:${st.closed ? "var(--green)" : st.overdue ? "var(--red)" : "var(--primary)"}"></i></div>
    <div class="sub center mt8" style="margin-bottom:14px">${st.pct}% repaid</div>

    <div class="menu" style="margin-bottom:14px">
      <div class="menu-item"><span class="grow">Principal</span><b class="money">${fmt(l.amount)}</b></div>
      ${l.rate ? `<div class="menu-item"><span class="grow">Interest @ ${l.rate}% p.a.</span><b class="money">${fmt(st.interest)}</b></div>
      <div class="menu-item"><span class="grow">Total owed</span><b class="money">${fmt(st.total)}</b></div>` : ""}
      <div class="menu-item"><span class="grow">Repaid so far</span><b class="money pos">${fmt(st.repaid)}</b></div>
      <div class="menu-item"><span class="grow">Remaining</span><b class="money ${st.closed ? "" : lent ? "pos" : "neg"}">${fmt(st.remaining)}</b></div>
      <div class="menu-item"><span class="grow">Date given</span><span class="hint">${D.short(l.date)}</span></div>
      ${l.dueDate ? `<div class="menu-item"><span class="grow">Due date</span><span class="hint ${st.overdue ? "neg" : ""}">${D.short(l.dueDate)}</span></div>` : ""}
      ${l.note ? `<div class="menu-item"><span class="grow">Note</span><span class="hint">${esc(l.note)}</span></div>` : ""}
    </div>

    <div class="sec"><span class="h2">Repayments</span><span class="sub">${reps.length}</span></div>
    <div class="card flat" style="padding:6px 10px;margin-bottom:14px">
      ${reps.length ? reps.map(r => `
        <div class="tx">
          <div class="emo" style="background:${tint("#34d399", .16)}">✅</div>
          <div class="mid"><div class="nm">${fmt(r.amount)}</div>
          <div class="meta">${D.human(r.date)}${r.note ? " · " + esc(r.note) : ""}</div></div>
          <button class="btn ghost sm" data-action="loan-unrepay" data-loan="${l.id}" data-rep="${r.id}">✕</button>
        </div>`).join("") : '<div class="empty" style="padding:18px">No repayments yet.</div>'}
    </div>

    ${!st.closed ? `<button class="btn primary" id="ln-repay">＋ Record a repayment</button>` : ""}
    <div class="row2 mt8">
      <button class="btn ghost" id="ln-edit">✏️ Edit</button>
      <button class="btn ghost" data-action="close-sheet">Close</button>
    </div>`);

  const rp = document.getElementById("ln-repay");
  if (rp) rp.onclick = () => repaymentSheet(l.id);
  document.getElementById("ln-edit").onclick = () => loanSheet(l.id);
}

function repaymentSheet(loanId) {
  const l = Store.state.loans.find(x => x.id === loanId);
  if (!l) return;
  const st = Store.loanStatus(l);
  const lent = l.type === "lent";
  Sheet.open(`
    <div class="sheet-title">Record a repayment</div>
    <p class="sub center" style="margin-bottom:14px">${lent ? esc(Store.loanPerson(l)) + " pays you back" : "You pay back " + esc(Store.loanPerson(l))} — ${fmt(st.remaining)} outstanding</p>
    <div class="field"><label>Amount (${currencyInfo().sym})</label>
      <input class="input" type="number" id="rp-amt" value="${st.remaining}">
      <div class="card-row mt8">
        <span class="sub">Outstanding <b>${fmt(st.remaining)}</b></span>
        <button class="btn ghost sm" id="rp-full" type="button">Full amount</button>
      </div>
    </div>
    <div class="field"><label>Date</label><input class="input" type="date" id="rp-date" value="${D.todayISO()}"></div>
    <div class="field"><label>Note</label><input class="input" id="rp-note" placeholder="optional"></div>
    <button class="btn primary" id="rp-save">Save repayment</button>`);

  document.getElementById("rp-full").onclick = () => { document.getElementById("rp-amt").value = st.remaining; };
  document.getElementById("rp-save").onclick = () => {
    const amt = parseFloat(document.getElementById("rp-amt").value);
    if (!amt || amt <= 0) return toast("Enter an amount", "✏️");
    Store.addRepayment(loanId, amt, document.getElementById("rp-date").value || D.todayISO(),
      document.getElementById("rp-note").value.trim());
    const after = Store.loanStatus(Store.state.loans.find(x => x.id === loanId));
    toast(after.closed ? "Loan fully settled 🎉" : "Repayment recorded", after.closed ? "🎉" : "✅");
    Sheet.close(); App.render();
  };
}

/* =============== GOALS =============== */
function goalSheet(editId) {
  const g = editId ? Store.state.goals.find(x => x.id === editId) : null;
  let emoji = g ? g.emoji : "🎯", color = g ? g.color : AVATAR_COLORS[0];
  Sheet.open(`
    <div class="sheet-title">${g ? "Edit" : "New"} goal</div>
    <div class="field"><label>Name</label><input class="input" id="gl-name" placeholder="e.g. New laptop" value="${g ? esc(g.name) : ""}"></div>
    <div class="field"><label>Icon</label><div class="emoji-grid" id="gl-emoji">
      ${["🎯", "📱", "💻", "🏍️", "🚗", "🏠", "✈️", "💍", "🛡️", "🎓", "🎸", "📷", "🏖️", "👗", "⌚", "🎮"].map(e => `<button class="${e === emoji ? "on" : ""}" data-e="${e}">${e}</button>`).join("")}</div></div>
    <div class="field"><label>Colour</label><div class="color-row" id="gl-colors">
      ${AVATAR_COLORS.map(c => `<button style="background:${c}" class="${c === color ? "on" : ""}" data-c="${c}"></button>`).join("")}</div></div>
    <div class="row2">
      <div class="field"><label>Target (${currencyInfo().sym})</label><input class="input" type="number" id="gl-target" value="${g ? g.target : ""}"></div>
      <div class="field"><label>Already saved</label><input class="input" type="number" id="gl-saved" value="${g ? g.saved : 0}"></div>
    </div>
    <button class="btn primary" id="gl-save">${g ? "Save" : "Create goal"}</button>
    ${g ? `<button class="btn danger mt8" id="gl-del">Delete goal</button>` : ""}`);
  document.getElementById("gl-emoji").onclick = e => {
    const b = e.target.closest("[data-e]"); if (!b) return; emoji = b.dataset.e;
    document.querySelectorAll("#gl-emoji button").forEach(x => x.classList.toggle("on", x.dataset.e === emoji));
  };
  document.getElementById("gl-colors").onclick = e => {
    const b = e.target.closest("[data-c]"); if (!b) return; color = b.dataset.c;
    document.querySelectorAll("#gl-colors button").forEach(x => x.classList.toggle("on", x.dataset.c === color));
  };
  document.getElementById("gl-save").onclick = () => {
    const name = document.getElementById("gl-name").value.trim();
    const target = parseFloat(document.getElementById("gl-target").value);
    const saved = parseFloat(document.getElementById("gl-saved").value) || 0;
    if (!name) return toast("Name your goal", "✏️");
    if (!target || target <= 0) return toast("Set a target amount", "✏️");
    if (g) Object.assign(g, { name, emoji, color, target, saved });
    else Store.state.goals.push({ id: uid(), name, emoji, color, target, saved });
    Store.save(); toast("Goal saved", "🎯"); Sheet.close(); App.render();
  };
  if (g) document.getElementById("gl-del").onclick = () => confirmSheet("Delete goal?", g.name + " will be removed.", "Delete", () => {
    undoToast("Goal deleted", Store.removeFrom("goals", g.id)); App.render();
  });
}

function goalDetailSheet(id) {
  const g = Store.state.goals.find(x => x.id === id);
  if (!g) return;
  const pct = Math.min(100, g.saved / g.target * 100);
  Sheet.open(`
    <div class="center">${Charts.ring(pct, 110, g.color)}</div>
    <div class="sheet-title" style="margin-top:8px">${g.emoji} ${esc(g.name)}</div>
    <div class="sub center mb8 money">${fmt(g.saved)} of ${fmt(g.target)} · ${fmt(Math.max(0, g.target - g.saved))} to go</div>
    <div class="field"><label>Add / remove money (use − to withdraw)</label>
      <input class="input" type="number" id="gd-amt" placeholder="e.g. 2000 or -500"></div>
    <button class="btn primary" id="gd-add">💰 Update savings</button>
    <div class="row2 mt8">
      <button class="btn ghost" id="gd-edit">✏️ Edit goal</button>
      <button class="btn ghost" data-action="close-sheet">Close</button>
    </div>`);
  document.getElementById("gd-add").onclick = () => {
    const amt = parseFloat(document.getElementById("gd-amt").value);
    if (!amt) return toast("Enter an amount", "✏️");
    g.saved = Math.max(0, g.saved + amt);
    Store.save();
    if (g.saved >= g.target) toast("🎉 Goal reached! Amazing!", "🏆");
    else toast(amt > 0 ? "Added to " + g.name : "Withdrawn", "💰");
    Sheet.close(); App.render();
  };
  document.getElementById("gd-edit").onclick = () => goalSheet(g.id);
}

/* =============== RECURRING =============== */
function recurringSheet(editId) {
  const r = editId ? Store.state.recurring.find(x => x.id === editId) : null;
  let type = r ? r.type : "expense";
  const catOpts = (t) => Store.state.categories.filter(c => c.type === t)
    .map(c => `<option value="${c.id}" ${r?.categoryId === c.id ? "selected" : ""}>${c.emoji} ${esc(c.name)}</option>`).join("");
  Sheet.open(`
    <div class="sheet-title">${r ? "Edit" : "New"} recurring</div>
    <div class="seg">
      <button class="${type === "expense" ? "on exp" : ""}" data-rt="expense">Expense</button>
      <button class="${type === "income" ? "on inc" : ""}" data-rt="income">Income</button>
    </div>
    <div class="field"><label>Name</label><input class="input" id="rc-name" placeholder="e.g. Netflix" value="${r ? esc(r.name) : ""}"></div>
    <div class="row2">
      <div class="field"><label>Amount (${currencyInfo().sym})</label><input class="input" type="number" id="rc-amt" value="${r ? r.amount : ""}"></div>
      <div class="field"><label>Repeats</label><select class="input" id="rc-freq">
        ${Object.entries(FREQ_LABEL).map(([k, v]) => `<option value="${k}" ${r?.freq === k ? "selected" : (!r && k === "monthly" ? "selected" : "")}>${v}</option>`).join("")}</select></div>
    </div>
    <div class="row2">
      <div class="field"><label>Category</label><select class="input" id="rc-cat">${catOpts(type)}</select></div>
      <div class="field"><label>Account</label><select class="input" id="rc-acc">${accountOptions(r?.accountId)}</select></div>
    </div>
    <div class="field"><label>Next due date</label><input class="input" type="date" id="rc-due" value="${r ? r.nextDue : D.todayISO()}"></div>
    <div class="field" style="display:flex;gap:10px;align-items:center">
      <input type="checkbox" id="rc-auto" style="width:18px;height:18px;accent-color:var(--primary)" ${!r || r.autoPost ? "checked" : ""}>
      <label for="rc-auto" style="margin:0">Auto-post to records on due date</label></div>
    ${r && r.nextDue <= D.todayISO() ? `<button class="btn ghost mb8" id="rc-post">⚡ Post now (${D.human(r.nextDue)})</button>` : ""}
    <button class="btn primary" id="rc-save">${r ? "Save" : "Create"}</button>
    ${r ? `<button class="btn danger mt8" id="rc-del">Delete</button>` : ""}`);
  document.querySelectorAll("#sheet [data-rt]").forEach(b => b.onclick = () => {
    type = b.dataset.rt;
    document.querySelectorAll("#sheet [data-rt]").forEach(x => x.classList.toggle("on", x.dataset.rt === type));
    document.querySelector("#sheet [data-rt].on").classList.add(type === "expense" ? "exp" : "inc");
    document.getElementById("rc-cat").innerHTML = catOpts(type);
  });
  document.getElementById("rc-save").onclick = () => {
    const name = document.getElementById("rc-name").value.trim();
    const amount = parseFloat(document.getElementById("rc-amt").value);
    if (!name) return toast("Give it a name", "✏️");
    if (!amount || amount <= 0) return toast("Enter the amount", "✏️");
    const data = {
      name, type, amount, freq: document.getElementById("rc-freq").value,
      categoryId: document.getElementById("rc-cat").value, accountId: document.getElementById("rc-acc").value,
      nextDue: document.getElementById("rc-due").value, autoPost: document.getElementById("rc-auto").checked,
    };
    if (r) Object.assign(r, data);
    else Store.state.recurring.push({ id: uid(), ...data });
    Store.save(); toast("Recurring saved", "🔄"); Sheet.close(); App.render();
  };
  const post = document.getElementById("rc-post");
  if (post) post.onclick = () => {
    Store.addTransaction({ type: r.type, amount: r.amount, categoryId: r.categoryId, accountId: r.accountId, date: r.nextDue, payee: r.name, note: "Recurring" });
    r.nextDue = Store.advance(r.nextDue, r.freq);
    Store.save(); toast(r.name + " posted", "⚡"); Sheet.close(); App.render();
  };
  if (r) document.getElementById("rc-del").onclick = () => confirmSheet("Delete recurring item?", "Already-posted transactions stay.", "Delete", () => {
    Store.state.recurring = Store.state.recurring.filter(x => x.id !== r.id);
    Store.save(); toast("Deleted", "🗑️"); App.render();
  });
}

/* =============== CATEGORY =============== */
function categorySheet(editId) {
  const c = editId ? Store.cat(editId) : null;
  let type = c ? c.type : "expense", emoji = c ? c.emoji : "🍿", color = c ? c.color : AVATAR_COLORS[2];
  const COLORS = ["#fb7185", "#f472b6", "#e879f9", "#a78bfa", "#818cf8", "#60a5fa", "#38bdf8", "#2dd4bf", "#34d399", "#fbbf24", "#fb923c", "#94a3b8"];
  Sheet.open(`
    <div class="sheet-title">${c ? "Edit" : "New"} category</div>
    ${!c ? `<div class="seg">
      <button class="on exp" data-ct="expense">Expense</button>
      <button data-ct="income">Income</button>
    </div>` : ""}
    <div class="field"><label>Name</label><input class="input" id="ct-name" value="${c ? esc(c.name) : ""}" placeholder="e.g. Pet care"></div>
    <div class="field"><label>Icon <span class="sub">${EMOJI_CHOICES.length} to choose from</span></label>
      <div class="emoji-box" id="ct-emoji">
        ${EMOJI_GROUPS.map(([name, list]) => `
          <div class="emoji-group-name">${esc(name)}</div>
          <div class="emoji-grid">${list.map(e =>
            `<button class="${e === emoji ? "on" : ""}" data-e="${e}">${e}</button>`).join("")}</div>`).join("")}
      </div></div>
    <div class="field"><label>Colour</label><div class="color-row" id="ct-colors">
      ${COLORS.map(cl => `<button style="background:${cl}" class="${cl === color ? "on" : ""}" data-c="${cl}"></button>`).join("")}</div></div>
    <button class="btn primary" id="ct-save">${c ? "Save" : "Create category"}</button>
    ${c ? `<button class="btn danger mt8" id="ct-del">Delete</button>` : ""}`);
  document.querySelectorAll("#sheet [data-ct]").forEach(b => b.onclick = () => {
    type = b.dataset.ct;
    document.querySelectorAll("#sheet [data-ct]").forEach(x => {
      x.classList.toggle("on", x.dataset.ct === type);
      x.classList.toggle("exp", x.dataset.ct === type && type === "expense");
      x.classList.toggle("inc", x.dataset.ct === type && type === "income");
    });
  });
  document.getElementById("ct-emoji").onclick = e => {
    const b = e.target.closest("[data-e]"); if (!b) return; emoji = b.dataset.e;
    document.querySelectorAll("#ct-emoji button").forEach(x => x.classList.toggle("on", x.dataset.e === emoji));
  };
  document.getElementById("ct-colors").onclick = e => {
    const b = e.target.closest("[data-c]"); if (!b) return; color = b.dataset.c;
    document.querySelectorAll("#ct-colors button").forEach(x => x.classList.toggle("on", x.dataset.c === color));
  };
  document.getElementById("ct-save").onclick = () => {
    const name = document.getElementById("ct-name").value.trim();
    if (!name) return toast("Name the category", "✏️");
    if (c) Object.assign(c, { name, emoji, color });
    else Store.state.categories.push({ id: uid(), name, emoji, color, type });
    Store.save(); toast("Category saved", "🏷️"); Sheet.close(); App.render();
  };
  if (c) document.getElementById("ct-del").onclick = () => {
    if (Store.catUsed(c.id)) return toast("In use by transactions/budgets — can't delete", "⚠️");
    confirmSheet("Delete category?", c.name + " will be removed.", "Delete", () => {
      Store.state.categories = Store.state.categories.filter(x => x.id !== c.id);
      Store.save(); toast("Category deleted", "🗑️"); App.render();
    });
  };
}

/* =============== PROFILE & CURRENCY =============== */
function profileSheet() {
  Sheet.open(`
    <div class="sheet-title">Your profile</div>
    <div class="field"><label>Name</label><input class="input" id="pf-name" value="${esc(Store.state.settings.name)}"></div>
    <button class="btn primary" id="pf-save">Save</button>`);
  document.getElementById("pf-save").onclick = () => {
    const n = document.getElementById("pf-name").value.trim();
    if (!n) return toast("Enter your name", "✏️");
    Store.state.settings.name = n; Store.save();
    toast("Hi, " + n + "!", "👋"); Sheet.close(); App.render();
  };
}

async function securitySheet() {
  const s = Store.state.settings;
  const bioOk = await Lock.bioAvailable();
  Sheet.open(`
    <div class="sheet-title">🔒 App lock</div>
    <p class="sub center" style="margin-bottom:14px">Asks for a PIN when you open Budget Bhai, and again after a minute in the background.</p>
    <div class="menu">
      <button class="menu-item" id="sec-toggle">
        <span class="em">${s.lock ? "🔓" : "🔒"}</span>
        <span class="grow">${s.lock ? "Turn off app lock" : "Set up a PIN"}</span>
        <span class="hint">${s.lock ? "on" : "off"}</span><span class="chev">›</span>
      </button>
      ${s.lock ? `<button class="menu-item" id="sec-change">
        <span class="em">🔑</span><span class="grow">Change PIN</span><span class="chev">›</span></button>` : ""}
      ${s.lock && bioOk ? `<div class="menu-item">
        <span class="em">☝️</span><span class="grow">Unlock with fingerprint</span>
        <input type="checkbox" id="sec-bio" ${s.biometric ? "checked" : ""} style="width:19px;height:19px;accent-color:var(--primary)"></div>` : ""}
    </div>
    ${s.lock && !bioOk ? `<p class="sub center">Fingerprint unlock isn't available on this device.</p>` : ""}
    <p class="sub center" style="margin-top:10px">⚠️ There's no way to recover a forgotten PIN — keep a backup of your data.</p>
    <button class="btn ghost mt8" data-action="close-sheet">Done</button>`);

  document.getElementById("sec-toggle").onclick = () => {
    if (s.lock) {
      confirmSheet("Turn off app lock?", "Anyone with your phone will be able to open Budget Bhai.", "Turn off", () => {
        Store.clearPin(); toast("App lock removed", "🔓"); App.render();
      });
    } else {
      Sheet.close();
      Lock.startSet(() => securitySheet());
    }
  };
  const chg = document.getElementById("sec-change");
  if (chg) chg.onclick = () => { Sheet.close(); Lock.startSet(() => securitySheet()); };

  const bio = document.getElementById("sec-bio");
  if (bio) bio.onchange = async () => {
    if (bio.checked) {
      if (await Lock.bioVerify()) { s.biometric = true; Store.save(); toast("Fingerprint unlock on", "☝️"); }
      else { bio.checked = false; toast("Couldn't verify fingerprint", "⚠️"); }
    } else { s.biometric = false; Store.save(); toast("Fingerprint unlock off"); }
  };
}

async function remindersSheet() {
  const r = Store.state.settings.reminders;
  const native = Notify.available();
  const toggle = (id, label, hint, on) => `
    <div class="menu-item">
      <span class="em">${hint}</span><span class="grow">${label}</span>
      <input type="checkbox" id="${id}" ${on ? "checked" : ""} style="width:19px;height:19px;accent-color:var(--primary)">
    </div>`;

  Sheet.open(`
    <div class="sheet-title">🔔 Reminders</div>
    ${!native ? `<p class="sub center" style="margin-bottom:14px">
      Scheduled reminders need the Android app — the iPhone web app can't wake itself up.
      Your settings are saved either way.</p>` : `<p class="sub center" style="margin-bottom:14px">
      Budget Bhai will nudge you even when it's closed.</p>`}
    <div class="menu">
      ${toggle("rm-on", "Turn reminders on", "🔔", r.enabled)}
    </div>
    <div id="rm-opts" style="${r.enabled ? "" : "opacity:.45;pointer-events:none"}">
      <div class="menu">
        ${toggle("rm-daily", "Daily logging nudge", "🌙", r.daily)}
        <div class="menu-item"><span class="em">⏰</span><span class="grow">Time</span>
          <input type="time" class="input" id="rm-time" value="${r.dailyTime}" style="width:auto;padding:7px 10px"></div>
        ${toggle("rm-bills", "Bills & salary due", "📅", r.bills)}
        ${toggle("rm-loans", "Loan due dates", "🤝", r.loans)}
      </div>
    </div>
    <div class="sub center" id="rm-status" style="margin-top:6px"></div>
    <button class="btn ghost mt8" data-action="close-sheet">Done</button>`);

  const status = document.getElementById("rm-status");
  const save = async (askPermission) => {
    const s = Store.state.settings.reminders;
    s.enabled = document.getElementById("rm-on").checked;
    s.daily = document.getElementById("rm-daily").checked;
    s.bills = document.getElementById("rm-bills").checked;
    s.loans = document.getElementById("rm-loans").checked;
    s.dailyTime = document.getElementById("rm-time").value || "21:00";
    document.getElementById("rm-opts").style.cssText = s.enabled ? "" : "opacity:.45;pointer-events:none";

    if (s.enabled && askPermission && native) {
      const ok = await Notify.ensurePermission();
      if (!ok) {
        s.enabled = false;
        document.getElementById("rm-on").checked = false;
        document.getElementById("rm-opts").style.cssText = "opacity:.45;pointer-events:none";
        Store.save();
        return toast("Notifications are blocked in Android settings", "⚠️");
      }
    }
    Store.save();
    const n = await Notify.reschedule();
    if (status) status.textContent = !native ? "" : s.enabled ? n + " reminder" + (n === 1 ? "" : "s") + " scheduled" : "Reminders off";
    App.render();
  };

  document.getElementById("rm-on").onchange = () => save(true);
  ["rm-daily", "rm-bills", "rm-loans"].forEach(id => { document.getElementById(id).onchange = () => save(false); });
  document.getElementById("rm-time").onchange = () => save(false);
  save(false);
}

function statementSheet() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth(), label: D.monthName(d.getFullYear(), d.getMonth()) });
  }
  Sheet.open(`
    <div class="sheet-title">📄 Monthly statement</div>
    <p class="sub center" style="margin-bottom:14px">A printable PDF with your summary, categories,
      budgets, top places, balances and every transaction.</p>
    <div class="field"><label>Month</label>
      <select class="input" id="stm-month">
        ${months.map((x, i) => `<option value="${i}">${esc(x.label)}</option>`).join("")}
      </select></div>
    <div class="sub center" id="stm-info" style="margin-bottom:12px"></div>
    <button class="btn primary" id="stm-go">Create PDF</button>`);

  const sel = document.getElementById("stm-month");
  const info = document.getElementById("stm-info");
  const refresh = () => {
    const { y, m } = months[Number(sel.value)];
    const n = Store.monthTx(y, m).length;
    const spent = Store.monthTotal(y, m, "expense");
    info.innerHTML = n ? `${n} transaction${n === 1 ? "" : "s"} · ${fmt(spent)} spent`
      : `<span class="warn">No transactions that month</span>`;
  };
  sel.onchange = refresh; refresh();

  document.getElementById("stm-go").onclick = async () => {
    const { y, m } = months[Number(sel.value)];
    const btn = document.getElementById("stm-go");
    btn.textContent = "Building…"; btn.disabled = true;
    try {
      await Report.share(y, m);
      toast("Statement ready", "📄");
      Sheet.close();
    } catch (e) {
      toast("Couldn't build the PDF", "⚠️");
      btn.textContent = "Create PDF"; btn.disabled = false;
    }
  };
}

/* =============== SPLIT STATEMENT =============== */
const Stmt = {
  friendId: null,
  period: "since",            // since | daily | weekly | monthly | yearly | custom | all
  anchor: D.todayISO(),
  custom: { from: D.addDays(D.todayISO(), -29), to: D.todayISO() },

  range() {
    const p = this.period, a = this.anchor;
    if (p === "all") return { from: "", to: "", label: "All time" };
    if (p === "since") {
      const last = Store.lastSettlementWith(this.friendId);
      if (!last) return { from: "", to: "", label: "All time (no payments yet)" };
      const from = D.addDays(last.date, 1);
      return { from, to: "", label: "Since the payment on " + D.short(last.date) };
    }
    if (p === "custom") return { from: this.custom.from, to: this.custom.to,
      label: D.short(this.custom.from) + " – " + D.short(this.custom.to) };
    if (p === "daily") return { from: a, to: a, label: D.human(a) };
    if (p === "weekly") {
      const from = D.weekStart(a);
      return { from, to: D.addDays(from, 6), label: D.short(from) + " – " + D.short(D.addDays(from, 6)) };
    }
    if (p === "yearly") {
      const y = a.slice(0, 4);
      return { from: y + "-01-01", to: y + "-12-31", label: y };
    }
    const [y, m] = a.split("-").map(Number);
    return { from: a.slice(0, 7) + "-01",
      to: a.slice(0, 7) + "-" + String(D.daysInMonth(y, m - 1)).padStart(2, "0"),
      label: D.monthName(y, m - 1) };
  },

  move(dir) {
    const p = this.period;
    if (p === "daily") this.anchor = D.addDays(this.anchor, dir);
    else if (p === "weekly") this.anchor = D.addDays(this.anchor, 7 * dir);
    else if (p === "yearly") this.anchor = D.addMonths(this.anchor, 12 * dir);
    else if (p === "monthly") this.anchor = D.addMonths(this.anchor, dir);
    this.render();
  },

  open(friendId) {
    this.friendId = friendId;
    this.period = Store.lastSettlementWith(friendId) ? "since" : "all";
    this.anchor = D.todayISO();
    this.render();
  },

  render() {
    const who = Store.friend(this.friendId)?.name || "Friend";
    const r = this.range();
    const st = Store.friendStatement(this.friendId, r.from, r.to);
    const due = st.closing;
    const nExp = st.items.filter(i => i.kind === "expense").length;
    const nPay = st.items.filter(i => i.kind === "payment").length;
    const stepper = ["daily", "weekly", "monthly", "yearly"].includes(this.period);

    Sheet.open(`
      <div class="sheet-title">📄 Statement for ${esc(who)}</div>
      <div class="seg" style="margin-bottom:10px">
        ${[["since", "Since payment"], ["all", "All"], ["custom", "Range"]].map(([k, lb]) =>
          `<button class="${this.period === k ? "on" : ""}" data-sp="${k}" style="font-size:11.5px">${lb}</button>`).join("")}
      </div>
      <div class="seg" style="margin-bottom:10px">
        ${[["daily", "Day"], ["weekly", "Week"], ["monthly", "Month"], ["yearly", "Year"]].map(([k, lb]) =>
          `<button class="${this.period === k ? "on" : ""}" data-sp="${k}" style="font-size:11.5px">${lb}</button>`).join("")}
      </div>
      ${stepper ? `<div class="month-sel">
        <button data-smove="-1">‹</button><div class="m">${esc(r.label)}</div><button data-smove="1">›</button>
      </div>` : this.period === "custom" ? `
      <div class="card flat" style="padding:12px 14px">
        <div class="row2">
          <div class="field" style="margin:0"><label>From</label>
            <input class="input" type="date" id="sm-from" value="${this.custom.from}"></div>
          <div class="field" style="margin:0"><label>To</label>
            <input class="input" type="date" id="sm-to" value="${this.custom.to}"></div>
        </div>
      </div>` : `<div class="sub center" style="margin-bottom:10px">${esc(r.label)}</div>`}

      <div class="card" style="margin-bottom:12px">
        <div class="center">
          <div class="sub">${Math.abs(due) < 0.01 ? "All settled up"
            : due > 0 ? esc(who) + " owes you" : "You owe " + esc(who)}</div>
          <div class="h1 money ${due > 0 ? "pos" : due < 0 ? "neg" : ""}" style="margin:4px 0 12px">${fmt(Math.abs(due))}</div>
        </div>
        <div class="menu" style="margin:0">
          <div class="menu-item"><span class="grow">Brought forward</span><b class="money">${fmt(st.opening)}</b></div>
          ${st.period.expenseCharges ? `<div class="menu-item"><span class="grow">New shared expenses</span><b class="money">+ ${fmt(st.period.expenseCharges)}</b></div>` : ""}
          ${st.period.expenseCredits ? `<div class="menu-item"><span class="grow">${esc(who)} paid for shared costs</span><b class="money">− ${fmt(st.period.expenseCredits)}</b></div>` : ""}
          ${st.period.paymentsIn ? `<div class="menu-item"><span class="grow">Paid by ${esc(who)}</span><b class="money pos">− ${fmt(st.period.paymentsIn)}</b></div>` : ""}
          ${st.period.paymentsOut ? `<div class="menu-item"><span class="grow">You paid ${esc(who)}</span><b class="money">+ ${fmt(st.period.paymentsOut)}</b></div>` : ""}
          <div class="menu-item"><span class="grow"><b>Amount due</b></span><b class="money ${due > 0 ? "pos" : due < 0 ? "neg" : ""}">${fmt(Math.abs(due))}</b></div>
        </div>
        <div class="sub center mt8">${nExp} expense${nExp === 1 ? "" : "s"} · ${nPay} payment${nPay === 1 ? "" : "s"} in this period</div>
      </div>

      ${st.opening && r.from ? `<p class="sub center" style="margin-bottom:12px">
        Carried forward: ${fmt(st.prior.expenseCharges)} was charged earlier${st.prior.paymentsIn
          ? ", of which " + fmt(st.prior.paymentsIn) + " was paid" : ""} — leaving ${fmt(st.opening)}.</p>` : ""}

      <button class="btn primary" id="sm-pdf">📄 Create PDF to send</button>
      <button class="btn ghost mt8" data-action="close-sheet">Close</button>`);

    document.querySelectorAll("#sheet [data-sp]").forEach(b =>
      b.onclick = () => { this.period = b.dataset.sp; this.anchor = D.todayISO(); this.render(); });
    document.querySelectorAll("#sheet [data-smove]").forEach(b =>
      b.onclick = () => this.move(Number(b.dataset.smove)));
    const f = document.getElementById("sm-from"), t = document.getElementById("sm-to");
    if (f && t) {
      const apply = () => {
        let a = f.value, b = t.value;
        if (!a || !b) return;
        if (a > b) [a, b] = [b, a];
        this.custom = { from: a, to: b };
        this.render();
      };
      f.onchange = apply; t.onchange = apply;
    }
    document.getElementById("sm-pdf").onclick = async () => {
      const btn = document.getElementById("sm-pdf");
      btn.textContent = "Building…"; btn.disabled = true;
      try {
        await Report.shareSplitStatement(this.friendId, this.range());
        toast("Statement ready", "📄");
        Sheet.close();
      } catch (e) {
        toast("Couldn't build the PDF", "⚠️");
        btn.textContent = "📄 Create PDF to send"; btn.disabled = false;
      }
    };
  },
};

function currencySheet() {
  Sheet.open(`
    <div class="sheet-title">Currency</div>
    <div class="menu" style="margin-bottom:6px">
      ${CURRENCIES.map(c => `<button class="menu-item" data-cur="${c.code}">
        <span class="em">${c.sym}</span><span class="grow">${c.name}</span>
        <span class="hint">${c.code}</span>${Store.state.settings.currency === c.code ? "✓" : ""}</button>`).join("")}
    </div>`);
  document.querySelectorAll("#sheet [data-cur]").forEach(b => b.onclick = () => {
    Store.state.settings.currency = b.dataset.cur; Store.save();
    toast("Currency set to " + b.dataset.cur, "💱"); Sheet.close(); App.render();
  });
}
