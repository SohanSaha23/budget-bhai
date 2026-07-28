/* ============ Paisa — app controller ============ */
"use strict";

const App = {
  isNative() {
    const cap = window.Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  },

  init() {
    Store.load();
    document.documentElement.dataset.theme = Store.state.settings.theme || "dark";
    this.syncSystemBars();
    this.initBackButton();
    this.initServiceWorker();
    const posted = Store.processRecurring();
    if (posted) setTimeout(() => toast(posted + " recurring transaction" + (posted > 1 ? "s" : "") + " auto-posted", "⚡"), 600);
    this.render();
  },

  /* ---------- back navigation ---------- */
  _lastBack: 0,

  /* offline support for the installed web app (never inside the native shell,
     where Capacitor serves the files itself) */
  initServiceWorker() {
    if (this.isNative() || !("serviceWorker" in navigator)) return;
    if (!location.protocol.startsWith("http")) return; // file:// has no SW
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;           // a new version took over
      reloading = true;
      location.reload();
    });
  },

  initBackButton() {
    const cap = window.Capacitor;
    if (this.isNative() && cap.Plugins && cap.Plugins.App) {
      cap.Plugins.App.addListener("backButton", () => App.back());
    } else {
      // browser: keep one buffer entry so back triggers popstate instead of leaving
      history.pushState({ bb: 1 }, "");
      window.addEventListener("popstate", () => {
        App.back();
        history.pushState({ bb: 1 }, "");
      });
    }
  },

  /* navigate deeper: remember where we came from */
  push(state) {
    UI.stack.push({ view: UI.view, groupId: UI.groupId, friendId: UI.friendId, accountId: UI.accountId });
    Object.assign(UI, { groupId: null, friendId: null, accountId: null }, state);
    if (Sheet.isOpen()) Sheet.close();
    this.render();
  },

  back() {
    if (Sheet.isOpen()) { Sheet.close(); return; }
    if (UI.stack.length) {
      const s = UI.stack.pop();
      Object.assign(UI, { groupId: null, friendId: null, accountId: null }, s);
      this.render();
      return;
    }
    if (UI.view !== "home") { UI.view = "home"; this.render(); return; }
    if (!this.isNative()) return;      // web app: nothing to exit to
    const now = Date.now();
    if (now - this._lastBack < 2200) {
      window.Capacitor.Plugins.App.exitApp();
    } else {
      this._lastBack = now;
      toast("Press back again to exit", "👋");
    }
  },

  /* keep the status bar readable for the current theme (Android shell + iOS PWA) */
  syncSystemBars() {
    const dark = (Store.state.settings.theme || "dark") === "dark";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0b0f1a" : "#eef1f8");
    const cap = window.Capacitor;
    if (this.isNative() && cap.Plugins && cap.Plugins.SystemBars) {
      cap.Plugins.SystemBars.setStyle({ style: dark ? "DARK" : "LIGHT" }).catch(() => {});
    }
  },

  render() {
    const main = document.getElementById("view");
    const v = UI.view;
    const fn = Views[v] || Views.home;
    main.innerHTML = fn.call(Views);
    main.classList.remove("view-anim");
    void main.offsetWidth; // restart animation
    main.classList.add("view-anim");
    main.scrollTop = 0;
    if (Views[v + "After"]) Views[v + "After"]();

    // nav highlight
    const tab = v === "home" ? "home" : v === "trans" ? "trans" : v === "stats" ? "stats" : v === "more" ? "more" : null;
    document.querySelectorAll(".nav-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.view === tab));
  },

  /* bottom-nav tabs are root destinations: back from any tab goes home */
  go(view) {
    if (UI.view === view) return;
    UI.stack = view === "home" ? [] : [{ view: "home", groupId: null, friendId: null, accountId: null }];
    UI.view = view;
    UI.groupId = UI.friendId = UI.accountId = null;
    if (Sheet.isOpen()) Sheet.close();
    this.render();
  },

  /* step the stats anchor by one period unit */
  statsMove(dir) {
    const p = UI.stats.period, a = UI.stats.anchor;
    if (p === "daily") UI.stats.anchor = D.addDays(a, dir);
    else if (p === "weekly") UI.stats.anchor = D.addDays(a, 7 * dir);
    else if (p === "yearly") UI.stats.anchor = D.addMonths(a, 12 * dir);
    else UI.stats.anchor = D.addMonths(a, dir);
    this.render();
  },

  /* contextual FAB */
  fab() {
    const v = UI.view;
    if (v === "splits" || v === "groupDetail") splitSheet(UI.groupId ? { group: UI.groupId } : null);
    else if (v === "friendDetail") splitSheet({ friend: UI.friendId });
    else if (v === "accounts" || v === "accountDetail") accountSheet();
    else if (v === "goals") goalSheet();
    else if (v === "recurring") recurringSheet();
    else if (v === "categories") categorySheet();
    else if (v === "budgets") budgetSheet();
    else TxSheet.open();
  },

  async download(filename, text, mime) {
    const type = mime || "text/plain";

    // Android shell: write to cache, then open the native share sheet
    const cap = window.Capacitor;
    if (this.isNative()) {
      try {
        const { Filesystem, Share } = cap.Plugins;
        await Filesystem.writeFile({ path: filename, data: text, directory: "CACHE", encoding: "utf8" });
        const { uri } = await Filesystem.getUri({ path: filename, directory: "CACHE" });
        await Share.share({ title: filename, files: [uri] });
      } catch (e) { /* user closed the share sheet */ }
      return;
    }

    // installed web app (iOS especially): <a download> is ignored in standalone
    // mode, so hand the file to the OS share sheet instead
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (standalone && navigator.canShare) {
      try {
        const file = new File([text], filename, { type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return; // user dismissed the sheet
      }
    }

    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
};

/* =============== global action dispatcher =============== */
const Actions = {
  "nav": d => App.go(d.view),
  "back": () => App.back(),
  "fab": () => App.fab(),
  "close-sheet": () => Sheet.close(),
  "toggle-theme": () => {
    const s = Store.state.settings;
    s.theme = s.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = s.theme;
    Store.save(); App.syncSystemBars(); App.render();
  },

  "open-splits": () => App.push({ view: "splits" }),
  "open-accounts": () => App.push({ view: "accounts" }),
  "open-budgets": () => App.push({ view: "budgets" }),
  "open-goals": () => App.push({ view: "goals" }),
  "open-recurring": () => App.push({ view: "recurring" }),
  "open-categories": () => App.push({ view: "categories" }),

  "month-prev": () => { const d = new Date(UI.month.y, UI.month.m - 1, 1); UI.month = { y: d.getFullYear(), m: d.getMonth() }; App.render(); },
  "month-next": () => { const d = new Date(UI.month.y, UI.month.m + 1, 1); UI.month = { y: d.getFullYear(), m: d.getMonth() }; App.render(); },

  "stats-type": d => { UI.statsType = d.type; App.render(); },
  "stats-period": d => { UI.stats.period = d.p; UI.stats.anchor = D.todayISO(); App.render(); },
  "stats-prev": () => { App.statsMove(-1); },
  "stats-next": () => { App.statsMove(1); },
  "stats-cat": d => Views.statsCat(d.cat),
  "splits-tab": d => { UI.splitsTab = d.tab; App.render(); },
  "tx-filter-type": d => { UI.transFilter.type = d.type; App.render(); },

  "tx-detail": d => txDetailSheet(d.id),
  "split-detail": d => splitDetailSheet(d.id),
  "friend-detail": d => App.push({ view: "friendDetail", friendId: d.id }),
  "group-detail": d => App.push({ view: "groupDetail", groupId: d.id }),
  "account-detail": d => App.push({ view: "accountDetail", accountId: d.id }),
  "goal-detail": d => goalDetailSheet(d.id),

  "add-budget": () => budgetSheet(),
  "edit-budget": d => budgetSheet(d.id),
  "add-account": () => accountSheet(),
  "edit-account": d => accountSheet(d.id),
  "add-transfer": () => transferSheet(),
  "add-friend": () => friendSheet(),
  "add-group": () => groupSheet(),
  "add-split": d => splitSheet({ group: d.group, friend: d.friend }),
  "settle-up": d => settleSheet({ group: d.group, friend: d.friend }),
  "add-goal": () => goalSheet(),
  "add-recurring": () => recurringSheet(),
  "edit-recurring": d => recurringSheet(d.id),
  "add-category": () => categorySheet(),
  "edit-category": d => categorySheet(d.id),
  "edit-profile": () => profileSheet(),
  "pick-currency": () => currencySheet(),

  "delete-friend": d => {
    const f = Store.friend(d.id);
    const involved = Store.state.splitExpenses.some(e => e.paidBy === d.id || e.shares.some(s => s.id === d.id));
    if (involved) return toast(f.name + " has split history — settle & delete splits first", "⚠️");
    confirmSheet("Remove " + f.name + "?", "They will be removed from all groups.", "Remove", () => {
      Store.state.friends = Store.state.friends.filter(x => x.id !== d.id);
      Store.state.groups.forEach(g => g.memberIds = g.memberIds.filter(m => m !== d.id));
      Store.save(); toast("Friend removed", "🗑️"); App.back();
    });
  },
  "delete-group": d => {
    const g = Store.group(d.id);
    confirmSheet("Delete " + g.name + "?", "All its split expenses and settlements will be deleted too.", "Delete", () => {
      Store.state.groups = Store.state.groups.filter(x => x.id !== d.id);
      Store.state.splitExpenses = Store.state.splitExpenses.filter(e => e.groupId !== d.id);
      Store.state.settlements = Store.state.settlements.filter(s => s.groupId !== d.id);
      Store.save(); toast("Group deleted", "🗑️"); App.back();
    });
  },

  "post-due": () => {
    let n = 0;
    for (const r of Store.dueRecurring()) {
      Store.addTransaction({ type: r.type, amount: r.amount, categoryId: r.categoryId, accountId: r.accountId, date: r.nextDue, payee: r.name, note: "Recurring" });
      r.nextDue = Store.advance(r.nextDue, r.freq);
      n++;
    }
    Store.save(); toast(n + " transaction" + (n > 1 ? "s" : "") + " posted", "⚡"); App.render();
  },

  "export-csv": () => {
    App.download("budget-bhai-transactions.csv", Store.toCSV(), "text/csv");
    toast("CSV downloaded", "📤");
  },
  "backup-json": () => {
    App.download("budget-bhai-backup-" + D.todayISO() + ".json", JSON.stringify(Store.state, null, 2), "application/json");
    toast("Backup downloaded", "💾");
  },
  "restore-json": () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,application/json";
    inp.onchange = () => {
      const file = inp.files[0];
      if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const data = JSON.parse(rd.result);
          if (!data.settings || !Array.isArray(data.transactions)) throw new Error("bad file");
          Store.state = data; Store.save();
          document.documentElement.dataset.theme = data.settings.theme || "dark";
          toast("Backup restored", "✅"); App.render();
        } catch (e) { toast("That doesn't look like a Budget Bhai backup", "⚠️"); }
      };
      rd.readAsText(file);
    };
    inp.click();
  },
  "reset-demo": () => confirmSheet("Reset demo data?", "Your current data will be replaced with fresh sample data.", "Reset", () => {
    Store.state = Store.seedDemo(); Store.save();
    toast("Demo data loaded", "🧪"); UI.view = "home"; App.render();
  }),
  "erase-all": () => confirmSheet("Erase everything?", "All data will be permanently deleted from this device.", "Erase", () => {
    Store.state = Store.blank(); Store.save();
    toast("Fresh start ✨"); UI.view = "home"; App.render();
  }),
};

/* single delegated click handler */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const fn = Actions[el.dataset.action];
  if (fn) { e.stopPropagation(); fn(el.dataset); }
});

document.addEventListener("DOMContentLoaded", () => App.init());
