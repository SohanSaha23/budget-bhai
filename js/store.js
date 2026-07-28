/* ============ Paisa — data store & business logic ============ */
"use strict";

const LS_KEY = "paisa.v1";
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- date helpers ---------- */
const D = {
  todayISO() { return D.toISO(new Date()); },
  toISO(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },
  parse(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); },
  addDays(iso, n) { const d = D.parse(iso); d.setDate(d.getDate() + n); return D.toISO(d); },
  addMonths(iso, n) { const d = D.parse(iso); d.setMonth(d.getMonth() + n); return D.toISO(d); },
  monthKey(iso) { return iso.slice(0, 7); },
  daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); },
  monthName(y, m, short) {
    return new Date(y, m, 1).toLocaleDateString("en-IN", { month: short ? "short" : "long", year: "numeric" });
  },
  human(iso) {
    const t = D.todayISO();
    if (iso === t) return "Today";
    if (iso === D.addDays(t, -1)) return "Yesterday";
    return D.parse(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  },
  short(iso) { return D.parse(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); },
};

/* ---------- currencies ---------- */
const CURRENCIES = [
  { code: "INR", sym: "₹", locale: "en-IN", name: "Indian Rupee" },
  { code: "USD", sym: "$", locale: "en-US", name: "US Dollar" },
  { code: "EUR", sym: "€", locale: "de-DE", name: "Euro" },
  { code: "GBP", sym: "£", locale: "en-GB", name: "British Pound" },
  { code: "BDT", sym: "৳", locale: "bn-BD", name: "Bangladeshi Taka" },
  { code: "AED", sym: "د.إ", locale: "en-AE", name: "UAE Dirham" },
];

/* ---------- default categories ---------- */
const DEFAULT_CATEGORIES = [
  { id: "c_food", name: "Food & Drinks", emoji: "🍔", color: "#fb7185", type: "expense" },
  { id: "c_groc", name: "Groceries", emoji: "🛒", color: "#34d399", type: "expense" },
  { id: "c_trans", name: "Transport", emoji: "🚕", color: "#fbbf24", type: "expense" },
  { id: "c_shop", name: "Shopping", emoji: "🛍️", color: "#f472b6", type: "expense" },
  { id: "c_ent", name: "Entertainment", emoji: "🎬", color: "#a78bfa", type: "expense" },
  { id: "c_bills", name: "Bills & Utilities", emoji: "💡", color: "#60a5fa", type: "expense" },
  { id: "c_health", name: "Health", emoji: "💊", color: "#2dd4bf", type: "expense" },
  { id: "c_edu", name: "Education", emoji: "🎓", color: "#818cf8", type: "expense" },
  { id: "c_travel", name: "Travel", emoji: "✈️", color: "#38bdf8", type: "expense" },
  { id: "c_rent", name: "Rent", emoji: "🏠", color: "#fb923c", type: "expense" },
  { id: "c_subs", name: "Subscriptions", emoji: "📺", color: "#e879f9", type: "expense" },
  { id: "c_care", name: "Personal Care", emoji: "💇", color: "#f9a8d4", type: "expense" },
  { id: "c_gift", name: "Gifts", emoji: "🎁", color: "#fca5a5", type: "expense" },
  { id: "c_other", name: "Other", emoji: "📦", color: "#94a3b8", type: "expense" },
  { id: "c_salary", name: "Salary", emoji: "💼", color: "#34d399", type: "income" },
  { id: "c_biz", name: "Business", emoji: "🏪", color: "#fbbf24", type: "income" },
  { id: "c_invest", name: "Investments", emoji: "📈", color: "#60a5fa", type: "income" },
  { id: "c_giftin", name: "Gifts", emoji: "🧧", color: "#f472b6", type: "income" },
  { id: "c_refund", name: "Refunds", emoji: "💸", color: "#2dd4bf", type: "income" },
  { id: "c_otherin", name: "Other", emoji: "💰", color: "#94a3b8", type: "income" },
];

const ACCOUNT_TYPES = [
  { id: "cash", name: "Cash", emoji: "💵" },
  { id: "bank", name: "Bank", emoji: "🏦" },
  { id: "card", name: "Credit Card", emoji: "💳" },
  { id: "wallet", name: "E-Wallet / UPI", emoji: "📱" },
  { id: "invest", name: "Investment", emoji: "📈" },
];

const AVATAR_COLORS = ["#7c6bff", "#2dd4bf", "#fb7185", "#fbbf24", "#60a5fa", "#f472b6", "#34d399", "#fb923c"];

/* ============ Store ============ */
const Store = {
  state: null,

  blank() {
    return {
      settings: { name: "You", currency: "INR", theme: "dark", demo: false },
      accounts: [], categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
      transactions: [], budgets: [], friends: [], groups: [],
      splitExpenses: [], settlements: [], goals: [], recurring: [],
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { this.state = JSON.parse(raw); return; }
    } catch (e) { /* corrupted -> reseed */ }
    this.state = this.seedDemo();
    this.save();
  },

  save() { localStorage.setItem(LS_KEY, JSON.stringify(this.state)); },

  /* ---------- accounts ---------- */
  accountBalance(accId) {
    const acc = this.state.accounts.find(a => a.id === accId);
    if (!acc) return 0;
    let bal = acc.initialBalance || 0;
    for (const t of this.state.transactions) {
      if (t.type === "income" && t.accountId === accId) bal += t.amount;
      else if (t.type === "expense" && t.accountId === accId) bal -= t.amount;
      else if (t.type === "transfer") {
        if (t.accountId === accId) bal -= t.amount;
        if (t.toAccountId === accId) bal += t.amount;
      }
    }
    return bal;
  },

  netWorth() {
    return this.state.accounts.filter(a => !a.excludeTotal)
      .reduce((s, a) => s + this.accountBalance(a.id), 0);
  },

  /* ---------- transactions ---------- */
  addTransaction(t) { this.state.transactions.push({ ...t, id: uid() }); this.save(); },
  updateTransaction(id, patch) {
    const t = this.state.transactions.find(x => x.id === id);
    if (t) { Object.assign(t, patch); this.save(); }
  },
  deleteTransaction(id) {
    this.state.transactions = this.state.transactions.filter(t => t.id !== id);
    this.save();
  },

  monthTx(y, m, type) {
    const key = y + "-" + String(m + 1).padStart(2, "0");
    return this.state.transactions.filter(t =>
      D.monthKey(t.date) === key && (!type || t.type === type));
  },

  monthTotal(y, m, type) {
    return this.monthTx(y, m, type).reduce((s, t) => s + t.amount, 0);
  },

  /* inclusive date-range queries (stats periods) */
  rangeTx(from, to, type) {
    return this.state.transactions.filter(t =>
      t.date >= from && t.date <= to && (!type || t.type === type));
  },
  rangeTotal(from, to, type) {
    return this.rangeTx(from, to, type).reduce((s, t) => s + t.amount, 0);
  },
  categorySpendRange(from, to, type) {
    const map = {};
    for (const t of this.rangeTx(from, to, type)) map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    return Object.entries(map)
      .map(([cid, amt]) => ({ cat: this.cat(cid), amt }))
      .sort((a, b) => b.amt - a.amt);
  },

  categorySpend(y, m) {
    const map = {};
    for (const t of this.monthTx(y, m, "expense")) {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    }
    return Object.entries(map)
      .map(([cid, amt]) => ({ cat: this.cat(cid), amt }))
      .sort((a, b) => b.amt - a.amt);
  },

  cat(id) {
    return this.state.categories.find(c => c.id === id) ||
      { id, name: "Unknown", emoji: "❓", color: "#94a3b8", type: "expense" };
  },
  acc(id) { return this.state.accounts.find(a => a.id === id); },
  catUsed(id) {
    return this.state.transactions.some(t => t.categoryId === id) ||
      this.state.budgets.some(b => b.categoryId === id) ||
      this.state.recurring.some(r => r.categoryId === id);
  },

  /* daily spend series for last n days (for sparkline) */
  dailySpend(nDays) {
    const out = [];
    let iso = D.addDays(D.todayISO(), -(nDays - 1));
    for (let i = 0; i < nDays; i++) {
      const sum = this.state.transactions
        .filter(t => t.type === "expense" && t.date === iso)
        .reduce((s, t) => s + t.amount, 0);
      out.push({ date: iso, amt: sum });
      iso = D.addDays(iso, 1);
    }
    return out;
  },

  /* ---------- budgets ---------- */
  budgetStatus(b, y, m) {
    const spent = b.categoryId === "ALL"
      ? this.monthTotal(y, m, "expense")
      : this.monthTx(y, m, "expense").filter(t => t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0);
    const pct = b.amount > 0 ? Math.min(100, Math.round(spent / b.amount * 100)) : 0;
    return { spent, pct, left: b.amount - spent, over: spent > b.amount };
  },

  /* ---------- splits ---------- */
  friend(id) { return id === "me" ? { id: "me", name: "You", color: "#7c6bff" } : this.state.friends.find(f => f.id === id); },
  group(id) { return this.state.groups.find(g => g.id === id); },

  /* net positions inside one context (a group, or 1-to-1 with a friend) */
  contextNets(expenses, settlements) {
    const net = {};
    const bump = (id, amt) => { net[id] = (net[id] || 0) + amt; };
    for (const e of expenses) {
      bump(e.paidBy, e.amount);
      for (const s of e.shares) bump(s.id, -s.amount);
    }
    for (const st of settlements) { bump(st.from, st.amount); bump(st.to, -st.amount); }
    return net;
  },

  /* greedy debt simplification -> [{from,to,amount}] */
  simplify(net) {
    const debtors = [], creditors = [];
    for (const [id, v] of Object.entries(net)) {
      if (v < -0.01) debtors.push({ id, v: -v });
      else if (v > 0.01) creditors.push({ id, v });
    }
    debtors.sort((a, b) => b.v - a.v); creditors.sort((a, b) => b.v - a.v);
    const edges = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].v, creditors[j].v);
      edges.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
      debtors[i].v -= pay; creditors[j].v -= pay;
      if (debtors[i].v < 0.01) i++;
      if (creditors[j].v < 0.01) j++;
    }
    return edges;
  },

  groupEdges(groupId) {
    const exp = this.state.splitExpenses.filter(e => e.groupId === groupId);
    const set = this.state.settlements.filter(s => s.groupId === groupId);
    return this.simplify(this.contextNets(exp, set));
  },

  /* 1-to-1 (non group) edges with a friend */
  personalEdges(friendId) {
    const exp = this.state.splitExpenses.filter(e => !e.groupId &&
      (e.paidBy === friendId || e.shares.some(s => s.id === friendId)));
    const set = this.state.settlements.filter(s => !s.groupId &&
      (s.from === friendId || s.to === friendId));
    return this.simplify(this.contextNets(exp, set));
  },

  /* net balance between me and one friend across all contexts. >0 friend owes me */
  friendBalance(friendId) {
    let bal = 0;
    const collect = edges => {
      for (const e of edges) {
        if (e.from === friendId && e.to === "me") bal += e.amount;
        if (e.from === "me" && e.to === friendId) bal -= e.amount;
      }
    };
    collect(this.personalEdges(friendId));
    for (const g of this.state.groups) {
      if (g.memberIds.includes(friendId)) collect(this.groupEdges(g.id));
    }
    return bal;
  },

  splitTotals() {
    let owedToMe = 0, iOwe = 0;
    for (const f of this.state.friends) {
      const b = this.friendBalance(f.id);
      if (b > 0) owedToMe += b; else iOwe += -b;
    }
    return { owedToMe, iOwe };
  },

  /* my balance inside a group. >0 = group owes me */
  myGroupBalance(groupId) {
    let bal = 0;
    for (const e of this.groupEdges(groupId)) {
      if (e.to === "me") bal += e.amount;
      if (e.from === "me") bal -= e.amount;
    }
    return bal;
  },

  /* ---------- recurring ---------- */
  advance(iso, freq) {
    if (freq === "daily") return D.addDays(iso, 1);
    if (freq === "weekly") return D.addDays(iso, 7);
    if (freq === "yearly") return D.addMonths(iso, 12);
    return D.addMonths(iso, 1);
  },

  processRecurring() {
    const today = D.todayISO();
    let posted = 0;
    for (const r of this.state.recurring) {
      let guard = 0;
      while (r.nextDue <= today && guard++ < 36) {
        if (r.autoPost) {
          this.state.transactions.push({
            id: uid(), type: r.type, amount: r.amount, categoryId: r.categoryId,
            accountId: r.accountId, date: r.nextDue, note: r.name + " (auto)", payee: r.name,
          });
          posted++;
        } else break; // waits for manual confirm
        r.nextDue = this.advance(r.nextDue, r.freq);
      }
    }
    if (posted) this.save();
    return posted;
  },

  dueRecurring() {
    const today = D.todayISO();
    return this.state.recurring.filter(r => !r.autoPost && r.nextDue <= today);
  },
  upcomingRecurring(days) {
    const limit = D.addDays(D.todayISO(), days);
    return this.state.recurring
      .filter(r => r.nextDue <= limit)
      .sort((a, b) => a.nextDue < b.nextDue ? -1 : 1);
  },

  /* ---------- insights (rule-based smart cards) ---------- */
  insights() {
    const out = [];
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
    const spent = this.monthTotal(y, m, "expense");
    const prevY = m === 0 ? y - 1 : y, prevM = m === 0 ? 11 : m - 1;

    // vs last month, same number of days
    const lastSameDay = this.state.transactions.filter(t => {
      if (t.type !== "expense") return false;
      const d = D.parse(t.date);
      return d.getFullYear() === prevY && d.getMonth() === prevM && d.getDate() <= day;
    }).reduce((s, t) => s + t.amount, 0);
    if (lastSameDay > 0 && spent > 0) {
      const diff = Math.round((spent - lastSameDay) / lastSameDay * 100);
      if (diff <= -5) out.push({ ic: "📉", tone: "good", t: "Spending down " + Math.abs(diff) + "%", d: "You've spent " + fmt(lastSameDay - spent) + " less than this time last month. Keep it up!" });
      else if (diff >= 5) out.push({ ic: "📈", tone: "bad", t: "Spending up " + diff + "%", d: "You've spent " + fmt(spent - lastSameDay) + " more than this time last month." });
      else out.push({ ic: "⚖️", tone: "", t: "Steady spending", d: "You're on pace with last month — within " + Math.abs(diff) + "%." });
    }

    // projection
    if (day >= 3 && spent > 0) {
      const dim = D.daysInMonth(y, m);
      const proj = Math.round(spent / day * dim);
      out.push({ ic: "🔮", tone: "", t: "Projected " + fmt(proj), d: "At your current pace of " + fmt(Math.round(spent / day)) + "/day, that's your month-end estimate." });
    }

    // top category
    const cats = this.categorySpend(y, m);
    if (cats.length) {
      const top = cats[0];
      const pc = spent ? Math.round(top.amt / spent * 100) : 0;
      out.push({ ic: top.cat.emoji, tone: "", t: top.cat.name + " leads", d: fmt(top.amt) + " (" + pc + "% of this month's spending)." });
    }

    // budget alerts
    for (const b of this.state.budgets) {
      const st = this.budgetStatus(b, y, m);
      const nm = b.categoryId === "ALL" ? "Overall budget" : this.cat(b.categoryId).name;
      if (st.over) out.push({ ic: "🚨", tone: "bad", t: nm + " exceeded", d: "Over by " + fmt(st.spent - b.amount) + ". Time to slow down." });
      else if (st.pct >= 80) out.push({ ic: "⚠️", tone: "warn", t: nm + " at " + st.pct + "%", d: "Only " + fmt(st.left) + " left for the rest of the month." });
    }

    // largest expense
    const monthExp = this.monthTx(y, m, "expense");
    if (monthExp.length) {
      const big = monthExp.reduce((a, b) => a.amount > b.amount ? a : b);
      out.push({ ic: "💥", tone: "", t: "Biggest expense", d: (big.payee || this.cat(big.categoryId).name) + " — " + fmt(big.amount) + " on " + D.short(big.date) + "." });
    }

    // no-spend days
    let noSpend = 0;
    for (let d2 = 1; d2 <= day; d2++) {
      const iso = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d2).padStart(2, "0");
      if (!monthExp.some(t => t.date === iso)) noSpend++;
    }
    if (noSpend > 0) out.push({ ic: "🌱", tone: "good", t: noSpend + " no-spend day" + (noSpend > 1 ? "s" : ""), d: "Days this month with zero expenses. Small wins add up!" });

    // upcoming bills
    const up = this.upcomingRecurring(7);
    if (up.length) {
      const tot = up.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);
      if (tot > 0) out.push({ ic: "📅", tone: "warn", t: up.length + " bill" + (up.length > 1 ? "s" : "") + " due soon", d: fmt(tot) + " in recurring payments within 7 days." });
    }
    return out.slice(0, 6);
  },

  /* ---------- export ---------- */
  toCSV() {
    const rows = [["Date", "Type", "Amount", "Category", "Account", "To Account", "Payee", "Note"]];
    const sorted = [...this.state.transactions].sort((a, b) => a.date < b.date ? -1 : 1);
    for (const t of sorted) {
      rows.push([
        t.date, t.type, t.amount,
        t.type === "transfer" ? "Transfer" : this.cat(t.categoryId).name,
        this.acc(t.accountId)?.name || "", t.toAccountId ? (this.acc(t.toAccountId)?.name || "") : "",
        t.payee || "", (t.note || "").replace(/"/g, '""'),
      ]);
    }
    return rows.map(r => r.map(c => '"' + c + '"').join(",")).join("\r\n");
  },

  /* ---------- demo seed ---------- */
  seedDemo() {
    const s = this.blank();
    s.settings.demo = true;
    const today = new Date();
    const iso = (offset) => D.addDays(D.todayISO(), -offset);
    let rnd = 42;
    const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
    const between = (a, b) => Math.round(a + rand() * (b - a));

    s.accounts = [
      { id: "a_bank", name: "HDFC Bank", type: "bank", initialBalance: 52000, excludeTotal: false },
      { id: "a_cash", name: "Cash", type: "cash", initialBalance: 6000, excludeTotal: false },
      { id: "a_card", name: "Credit Card", type: "card", initialBalance: 0, excludeTotal: false },
      { id: "a_upi", name: "Paytm UPI", type: "wallet", initialBalance: 1200, excludeTotal: false },
    ];

    const tx = (type, amount, categoryId, accountId, offset, payee, note) =>
      s.transactions.push({ id: uid(), type, amount, categoryId, accountId, date: iso(offset), payee: payee || "", note: note || "" });
    const trf = (amount, from, to, offset, note) =>
      s.transactions.push({ id: uid(), type: "transfer", amount, categoryId: null, accountId: from, toAccountId: to, date: iso(offset), payee: "", note });

    // ~70 days of history
    for (let off = 70; off >= 0; off--) {
      const d = D.parse(iso(off));
      const dom = d.getDate(), dow = d.getDay();
      if (dom === 1) {
        tx("income", 65000, "c_salary", "a_bank", off, "Acme Corp", "Monthly salary");
        tx("expense", 18000, "c_rent", "a_bank", off, "Landlord", "House rent");
      }
      if (dom === 3) tx("expense", 1500, "c_health", "a_upi", off, "Cult.fit", "Gym membership");
      if (dom === 5) tx("expense", 649, "c_subs", "a_card", off, "Netflix", "");
      if (dom === 12) tx("expense", 199, "c_subs", "a_card", off, "Spotify", "");
      if (dom === 7) trf(8000, "a_bank", "a_card", off, "Card bill payment");
      if (off % 14 === 0) trf(5000, "a_bank", "a_cash", off, "ATM withdrawal");
      if (off % 7 === 3) trf(4000, "a_bank", "a_upi", off, "UPI top-up");
      if (dom === 8) tx("expense", between(1800, 2600), "c_bills", "a_upi", off, "Electricity", "Power bill");
      if (dom === 15) tx("expense", 599, "c_bills", "a_upi", off, "Jio Fiber", "Internet");
      if (off % 3 === 0) tx("expense", between(400, 1500), "c_groc", rand() > .5 ? "a_upi" : "a_cash", off, ["BigBasket", "DMart", "Local store"][between(0, 2)], "");
      if (rand() > .45) tx("expense", between(120, 600), "c_food", rand() > .5 ? "a_upi" : "a_cash", off, ["Zomato", "Swiggy", "Cafe Coffee Day", "Dominos", "Street food"][between(0, 4)], "");
      if (rand() > .55) tx("expense", between(50, 300), "c_trans", "a_upi", off, ["Uber", "Ola", "Metro", "Rapido"][between(0, 3)], "");
      if ((dow === 0 || dow === 6) && rand() > .55) tx("expense", between(300, 1500), "c_ent", "a_card", off, ["PVR Cinemas", "BookMyShow", "Gaming"][between(0, 2)], "");
      if (rand() > .9) tx("expense", between(800, 4200), "c_shop", "a_card", off, ["Amazon", "Flipkart", "Myntra"][between(0, 2)], "");
      if (rand() > .95) tx("expense", between(300, 900), "c_care", "a_cash", off, "Salon", "");
      if (rand() > .96) tx("income", between(500, 2500), "c_refund", "a_bank", off, "Cashback", "");
    }
    s.budgets = [
      { id: uid(), categoryId: "ALL", amount: 40000 },
      { id: uid(), categoryId: "c_food", amount: 8000 },
      { id: uid(), categoryId: "c_groc", amount: 10000 },
      { id: uid(), categoryId: "c_trans", amount: 3000 },
      { id: uid(), categoryId: "c_ent", amount: 4000 },
      { id: uid(), categoryId: "c_shop", amount: 5000 },
    ];

    s.friends = [
      { id: "f_rahul", name: "Rahul", color: "#2dd4bf" },
      { id: "f_priya", name: "Priya", color: "#fb7185" },
      { id: "f_aakash", name: "Aakash", color: "#fbbf24" },
    ];
    s.groups = [{ id: "g_goa", name: "Goa Trip", emoji: "🏖️", memberIds: ["f_rahul", "f_priya", "f_aakash"] }];

    const eq = (amt, ids) => ids.map(id => ({ id, amount: Math.round(amt / ids.length) }));
    s.splitExpenses = [
      { id: uid(), groupId: "g_goa", desc: "Flight tickets", amount: 18400, paidBy: "me", shares: eq(18400, ["me", "f_rahul", "f_priya", "f_aakash"]), date: iso(21) },
      { id: uid(), groupId: "g_goa", desc: "Beach resort · 2 nights", amount: 12000, paidBy: "me", shares: eq(12000, ["me", "f_rahul", "f_priya", "f_aakash"]), date: iso(19) },
      { id: uid(), groupId: "g_goa", desc: "Seafood dinner", amount: 3200, paidBy: "f_rahul", shares: eq(3200, ["me", "f_rahul", "f_priya", "f_aakash"]), date: iso(19) },
      { id: uid(), groupId: "g_goa", desc: "Scooty rental", amount: 1600, paidBy: "f_priya", shares: eq(1600, ["me", "f_rahul", "f_priya", "f_aakash"]), date: iso(18) },
      { id: uid(), groupId: null, desc: "Movie tickets", amount: 600, paidBy: "me", shares: eq(600, ["me", "f_aakash"]), date: iso(5) },
    ];
    s.settlements = [
      { id: uid(), groupId: "g_goa", from: "f_aakash", to: "me", amount: 3000, date: iso(10) },
    ];

    s.goals = [
      { id: uid(), name: "iPhone 17", emoji: "📱", color: "#7c6bff", target: 90000, saved: 32000 },
      { id: uid(), name: "Emergency Fund", emoji: "🛡️", color: "#2dd4bf", target: 150000, saved: 78000 },
      { id: uid(), name: "Ladakh Bike Trip", emoji: "🏍️", color: "#fbbf24", target: 45000, saved: 12500 },
    ];

    const nextDom = (dom) => {
      const t2 = new Date(today.getFullYear(), today.getMonth(), dom);
      if (t2 <= today) t2.setMonth(t2.getMonth() + 1);
      return D.toISO(t2);
    };
    s.recurring = [
      { id: uid(), name: "Salary", type: "income", amount: 65000, categoryId: "c_salary", accountId: "a_bank", freq: "monthly", nextDue: nextDom(1), autoPost: true },
      { id: uid(), name: "House Rent", type: "expense", amount: 18000, categoryId: "c_rent", accountId: "a_bank", freq: "monthly", nextDue: nextDom(1), autoPost: true },
      { id: uid(), name: "Netflix", type: "expense", amount: 649, categoryId: "c_subs", accountId: "a_card", freq: "monthly", nextDue: nextDom(5), autoPost: true },
      { id: uid(), name: "Spotify", type: "expense", amount: 199, categoryId: "c_subs", accountId: "a_card", freq: "monthly", nextDue: nextDom(12), autoPost: true },
      { id: uid(), name: "Gym", type: "expense", amount: 1500, categoryId: "c_health", accountId: "a_upi", freq: "monthly", nextDue: nextDom(3), autoPost: false },
      { id: uid(), name: "SIP · Mutual Fund", type: "expense", amount: 5000, categoryId: "c_other", accountId: "a_bank", freq: "monthly", nextDue: nextDom(10), autoPost: false },
    ];
    return s;
  },
};
