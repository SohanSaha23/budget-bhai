/* ============ Paisa — app controller ============ */
"use strict";

/* Holds the note editor's pending-save hook so navigation can flush it. */
const NoteEditor = { flush: null };

/* ---------------- reminders (Android local notifications) ----------------
   Web browsers can't schedule notifications for a future date without a
   server, so this is a no-op outside the native shell. */
const Notify = {
  plugin() {
    const c = window.Capacitor;
    return (App.isNative() && c.Plugins && c.Plugins.LocalNotifications) ? c.Plugins.LocalNotifications : null;
  },
  available() { return !!this.plugin(); },

  async ensurePermission() {
    const p = this.plugin();
    if (!p) return false;
    try {
      let st = await p.checkPermissions();
      if (st.display !== "granted") st = await p.requestPermissions();
      return st.display === "granted";
    } catch (e) { return false; }
  },

  /* wipes everything we scheduled and lays it out again from current data */
  async reschedule() {
    const p = this.plugin();
    if (!p) return 0;
    try {
      const pending = await p.getPending();
      if (pending.notifications.length) {
        await p.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }
      const r = Store.state.settings.reminders || {};
      if (!r.enabled) return 0;

      const list = [];
      let id = 1;
      const at9 = (iso) => { const d = D.parse(iso); d.setHours(9, 0, 0, 0); return d; };
      const future = (d) => d.getTime() > Date.now() + 30000;

      if (r.daily) {
        const [hh, mm] = (r.dailyTime || "21:00").split(":").map(Number);
        list.push({
          id: id++, title: "Log today's spending",
          body: "Anything to add to Budget Bhai before bed?",
          schedule: { on: { hour: hh, minute: mm }, allowWhileIdle: true },
        });
      }

      if (r.bills) {
        for (const rec of Store.upcomingRecurring(30)) {
          const when = at9(rec.nextDue);
          if (!future(when)) continue;
          list.push({
            id: id++, title: rec.name + (rec.type === "income" ? " expected" : " is due"),
            body: fmt(rec.amount) + " · " + (FREQ_LABEL[rec.freq] || ""),
            schedule: { at: when, allowWhileIdle: true },
          });
        }
      }

      if (r.loans) {
        const today = D.todayISO();
        for (const l of Store.state.loans) {
          const st = Store.loanStatus(l);
          if (st.closed || !l.dueDate) continue;
          const when = st.overdue ? at9(D.addDays(today, 1)) : at9(l.dueDate);
          if (!future(when)) continue;
          const who = Store.loanPerson(l);
          list.push({
            id: id++,
            title: st.overdue ? "Overdue: " + who : (l.type === "lent" ? who + " owes you" : "You owe " + who),
            body: fmt(st.remaining) + (st.overdue ? " — was due " + D.short(l.dueDate) : " due today"),
            schedule: { at: when, allowWhileIdle: true },
          });
        }
      }

      if (list.length) await p.schedule({ notifications: list });
      return list.length;
    } catch (e) { return 0; }
  },
};

/* ---------------- app lock (4-digit PIN + optional fingerprint) ---------------- */
const PIN_LEN = 4;

const Lock = {
  mode: "unlock",      // unlock | set | confirm
  entered: "",
  firstPin: "",
  onDone: null,
  locked: false,

  el() { return document.getElementById("lock"); },

  async bioAvailable() {
    const cap = window.Capacitor;
    if (!App.isNative() || !cap.Plugins || !cap.Plugins.NativeBiometric) return false;
    try { return !!(await cap.Plugins.NativeBiometric.isAvailable()).isAvailable; } catch (e) { return false; }
  },

  async bioVerify() {
    try {
      await window.Capacitor.Plugins.NativeBiometric.verifyIdentity({
        reason: "Unlock Budget Bhai", title: "Budget Bhai", subtitle: "", description: "",
      });
      return true;
    } catch (e) { return false; }
  },

  /* show the lock screen (cold start, or when the user locks manually) */
  async show() {
    if (this.locked) return;
    this.locked = true;
    this.mode = "unlock"; this.entered = ""; this.firstPin = "";
    this.el().classList.remove("hidden");
    this.render();
    if (Store.state.settings.biometric) this.promptBio();
  },

  /* one biometric prompt at a time — re-entrancy is what caused the unlock loop */
  async promptBio() {
    if (this.busy || !this.locked) return;
    this.busy = true;
    try {
      if (await this.bioAvailable() && await this.bioVerify()) this.hide();
    } finally {
      this.busy = false;
    }
  },

  hide() {
    this.locked = false;
    this.entered = "";
    this.el().classList.add("hidden");
  },

  /* PIN setup / change flow, used from Settings */
  startSet(onDone) {
    this.locked = true;
    this.mode = "set"; this.entered = ""; this.firstPin = "";
    this.onDone = onDone || null;
    this.el().classList.remove("hidden");
    this.render();
  },

  title() {
    if (this.mode === "set") return "Choose a 4-digit PIN";
    if (this.mode === "confirm") return "Re-enter your PIN";
    return "Enter your PIN";
  },

  render() {
    const dots = Array.from({ length: PIN_LEN }, (_, i) =>
      `<i class="${i < this.entered.length ? "on" : ""}"></i>`).join("");
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n =>
      `<button data-k="${n}"><span>${n}</span></button>`).join("");
    const canCancel = this.mode !== "unlock";
    const showBio = this.mode === "unlock" && Store.state.settings.biometric;
    const step = this.mode === "set" ? 1 : this.mode === "confirm" ? 2 : 0;

    this.el().innerHTML = `
      <div class="lock-bg"></div>
      <div class="lock-inner">
        <div class="lock-head">
          <div class="lock-badge"><img src="icons/icon-192.png" alt=""><span class="lock-dot"></span></div>
          <div class="lock-brand">Budget&nbsp;Bhai</div>
          <div class="lock-title">${this.title()}</div>
          <div class="lock-sub" id="lock-msg">${
            this.mode === "unlock" ? "Your data stays on this device"
            : this.mode === "set" ? "Pick something you'll remember"
            : "Type it once more to confirm"}</div>
          ${step ? `<div class="lock-steps">${[1, 2].map(i =>
            `<i class="${i <= step ? "on" : ""}"></i>`).join("")}</div>` : ""}
          <div class="pin-dots" id="pin-dots">${dots}</div>
        </div>

        <div class="pin-pad">
          ${keys}
          <button class="ghost" data-k="${showBio ? "bio" : canCancel ? "cancel" : ""}" ${!showBio && !canCancel ? "disabled" : ""}>
            ${showBio ? `<svg viewBox="0 0 24 24" class="fp"><path d="M12 2a9 9 0 0 0-9 9v3M12 2a9 9 0 0 1 9 9v6M7 11a5 5 0 0 1 10 0v7M12 11v8M4 19c1.2-1.6 1.8-3.4 1.8-5.2"/></svg>`
              : canCancel ? "Cancel" : ""}
          </button>
          <button data-k="0"><span>0</span></button>
          <button class="ghost" data-k="back" aria-label="Delete">
            <svg viewBox="0 0 24 24" class="bk"><path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7Z"/><path d="M13 10l4 4m0-4-4 4"/></svg>
          </button>
        </div>
      </div>`;

    this.el().onclick = (e) => {
      const b = e.target.closest("[data-k]");
      if (b && b.dataset.k) this.key(b.dataset.k);
    };
  },

  async key(k) {
    if (!k) return;
    if (k === "back") { this.entered = this.entered.slice(0, -1); return this.paint(); }
    if (k === "cancel") { this.hide(); if (this.onDone) { this.onDone(false); this.onDone = null; } return; }
    if (k === "bio") { this.promptBio(); return; }
    if (this.entered.length >= PIN_LEN) return;
    this.entered += k;
    this.paint();
    if (this.entered.length === PIN_LEN) setTimeout(() => this.submit(), 140);
  },

  paint() {
    const wrap = document.getElementById("pin-dots");
    if (!wrap) return;
    [...wrap.children].forEach((d, i) => d.classList.toggle("on", i < this.entered.length));
  },

  fail(msg) {
    const box = this.el().querySelector(".lock-inner");
    const m = document.getElementById("lock-msg");
    if (m) { m.textContent = msg; m.classList.add("bad"); }
    box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
    this.entered = ""; this.paint();
  },

  async submit() {
    const pin = this.entered;
    if (this.mode === "unlock") {
      if (await Store.checkPin(pin)) { this.hide(); }
      else this.fail("Wrong PIN — try again");
      return;
    }
    if (this.mode === "set") {
      this.firstPin = pin;
      this.mode = "confirm"; this.entered = "";
      this.render();
      return;
    }
    // confirm
    if (pin !== this.firstPin) {
      this.mode = "set"; this.firstPin = "";
      this.fail("PINs didn't match — start again");
      return;
    }
    await Store.setPin(pin);
    this.hide();
    toast("App lock enabled", "🔒");
    if (this.onDone) { this.onDone(true); this.onDone = null; }
    App.render();
  },
};

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
    Notify.reschedule();
    const s = Store.state.settings;
    // Locks on a cold start only. Merely switching apps does NOT re-lock:
    // the biometric prompt itself backgrounds the app, so resume-locking put
    // the unlock into an endless loop.
    if (s.lock && s.pinHash) Lock.show();
  },

  /* ---------- back navigation ---------- */
  _lastBack: 0,

  /* offline support for the installed web app (never inside the native shell,
     where Capacitor serves the files itself) */
  initServiceWorker() {
    if (this.isNative() || !("serviceWorker" in navigator)) return;
    if (!location.protocol.startsWith("http")) return; // file:// has no SW
    // skip on the dev preview: a cache-first worker would serve stale edits
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
      navigator.serviceWorker.getRegistrations()
        .then(rs => rs.forEach(r => r.unregister()))
        .catch(() => {});
      return;
    }
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

  /* save any half-typed note before the view changes */
  flushNote() {
    if (NoteEditor.flush) NoteEditor.flush();
    Store.pruneEmptyNotes();
  },

  /* navigate deeper: remember where we came from */
  push(state) {
    if (UI.view === "noteEdit") this.flushNote();
    UI.stack.push({ view: UI.view, groupId: UI.groupId, friendId: UI.friendId, accountId: UI.accountId, noteId: UI.noteId });
    Object.assign(UI, { groupId: null, friendId: null, accountId: null }, state);
    if (Sheet.isOpen()) Sheet.close();
    this.render();
  },

  back() {
    if (Lock.locked) return;                    // can't navigate past the lock screen
    if (Sheet.isOpen()) { Sheet.close(); return; }
    if (UI.view === "noteEdit") this.flushNote();
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
    if (UI.view === "noteEdit") this.flushNote();
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

  /* step the split-category window by one period unit */
  splitCatMove(dir) {
    const s = UI.splitCat;
    if (s.period === "daily") s.anchor = D.addDays(s.anchor, dir);
    else if (s.period === "weekly") s.anchor = D.addDays(s.anchor, 7 * dir);
    else if (s.period === "monthly") s.anchor = D.addMonths(s.anchor, dir);
    this.render();
  },

  /* contextual FAB */
  fab() {
    const v = UI.view;
    if (v === "splits" || v === "groupDetail") splitSheet(UI.groupId ? { group: UI.groupId } : null);
    else if (v === "friendDetail") splitSheet({ friend: UI.friendId });
    else if (v === "accounts" || v === "accountDetail") accountSheet();
    else if (v === "notes" || v === "noteEdit") Actions["note-new"]();
    else if (v === "loans") loanSheet();
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

  /* same idea for binary payloads (PDFs) — takes base64 */
  async downloadBinary(filename, base64, mime) {
    const cap = window.Capacitor;
    if (this.isNative()) {
      try {
        const { Filesystem, Share } = cap.Plugins;
        await Filesystem.writeFile({ path: filename, data: base64, directory: "CACHE" });
        const { uri } = await Filesystem.getUri({ path: filename, directory: "CACHE" });
        await Share.share({ title: filename, files: [uri] });
      } catch (e) { /* sheet dismissed */ }
      return;
    }
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime || "application/octet-stream" });

    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (standalone && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: mime });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
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
  "open-loans": () => App.push({ view: "loans" }),
  "open-notes": () => { UI.notesQuery = ""; UI.notesTag = "all"; App.push({ view: "notes" }); },
  "notes-tag": d => { UI.notesTag = d.t; App.render(); },
  "note-new": () => { const n = Store.newNote(UI.notesTag !== "all" ? UI.notesTag : "general"); App.push({ view: "noteEdit", noteId: n.id }); },
  "note-open": d => App.push({ view: "noteEdit", noteId: d.id }),
  "note-pin": d => {
    const n = Store.note(d.id);
    if (!n) return;
    Store.updateNote(d.id, { pinned: !n.pinned });
    toast(n.pinned ? "Unpinned" : "Pinned to top", n.pinned ? "" : "📌");
    App.render();
  },
  "note-delete": d => confirmSheet("Delete this note?", "You'll have 10 seconds to undo.", "Delete", () => {
    NoteEditor.flush = null;
    const snap = Store.removeFrom("notes", d.id);
    if (UI.view === "noteEdit") App.back(); else App.render();
    undoToast("Note deleted", snap);
  }),
  "loans-tab": d => { UI.loansTab = d.t; App.render(); },
  "add-loan": () => loanSheet(),
  "loan-detail": d => loanDetailSheet(d.id),
  "loan-unrepay": d => {
    const l = Store.state.loans.find(x => x.id === d.loan);
    if (!l) return;
    confirmSheet("Remove this repayment?", "The outstanding amount goes back up.", "Remove", () => {
      l.repayments = l.repayments.filter(r => r.id !== d.rep);
      Store.save(); toast("Repayment removed", "🗑️");
      App.render(); loanDetailSheet(l.id);
    });
  },
  "open-categories": () => App.push({ view: "categories" }),

  "month-prev": () => { const d = new Date(UI.month.y, UI.month.m - 1, 1); UI.month = { y: d.getFullYear(), m: d.getMonth() }; App.render(); },
  "month-next": () => { const d = new Date(UI.month.y, UI.month.m + 1, 1); UI.month = { y: d.getFullYear(), m: d.getMonth() }; App.render(); },

  "stats-type": d => { UI.statsType = d.type; App.render(); },
  "stats-period": d => { UI.stats.period = d.p; UI.stats.anchor = D.todayISO(); App.render(); },
  "stats-preset": d => {
    const n = Number(d.n);
    UI.stats.custom = n > 0
      ? { from: D.addDays(D.todayISO(), -(n - 1)), to: D.todayISO() }
      : { from: D.todayISO().slice(0, 4) + "-01-01", to: D.todayISO() };
    App.render();
  },
  "stats-prev": () => { App.statsMove(-1); },
  "stats-next": () => { App.statsMove(1); },
  "stats-cat": d => Views.statsCat(d.cat),
  "splits-tab": d => { UI.splitsTab = d.tab; App.render(); },
  "split-period": d => { UI.splitPeriod = d.p; App.render(); },
  "friend-tab": d => { UI.friendTab = d.t; App.render(); },
  "splitcat-period": d => { UI.splitCat.period = d.p; UI.splitCat.anchor = D.todayISO(); App.render(); },
  "splitcat-prev": () => { App.splitCatMove(-1); },
  "splitcat-next": () => { App.splitCatMove(1); },
  "splitcat-preset": d => {
    const n = Number(d.n);
    UI.splitCat.custom = { from: D.addDays(D.todayISO(), -(n - 1)), to: D.todayISO() };
    App.render();
  },
  "splitcat-open": d => splitCategorySheet(d.cat, d.friend || null, splitCatRange()),
  "settle-edit": d => settleSheet({ edit: d.id }),
  "tx-filter-type": d => { UI.transFilter.type = d.type; App.render(); },
  "tx-scope": d => {
    UI.transFilter.scope = d.s;
    document.getElementById("txlist").innerHTML = Views.txList();
  },

  "tx-detail": d => txDetailSheet(d.id),
  "split-detail": d => splitDetailSheet(d.id),
  "friend-detail": d => { UI.friendTab = "activity"; App.push({ view: "friendDetail", friendId: d.id }); },
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
  "open-security": () => securitySheet(),
  "open-reminders": () => remindersSheet(),
  "open-statement": () => statementSheet(),
  "heat-day": d => {
    const list = Store.state.transactions.filter(t => t.date === d.date);
    const spent = list.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    Sheet.open(`
      <div class="sheet-title">${D.human(d.date)}</div>
      <div class="center h2 money mb8">${spent ? fmt(spent) + " spent" : "No spending 🌱"}</div>
      <div style="max-height:52vh;overflow-y:auto">${list.length ? groupTxByDate(list) : ""}</div>
      <button class="btn ghost mt8" data-action="close-sheet">Close</button>`);
  },

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
