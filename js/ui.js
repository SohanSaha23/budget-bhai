/* ============ Paisa — UI helpers ============ */
"use strict";

function currencyInfo() {
  return CURRENCIES.find(c => c.code === Store.state.settings.currency) || CURRENCIES[0];
}

/* money format: symbol + locale grouping, decimals only when needed */
function fmt(n, showSign) {
  const cur = currencyInfo();
  const abs = Math.abs(n);
  const numStr = new Intl.NumberFormat(cur.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: abs % 1 ? 2 : 0,
  }).format(abs);
  const sign = showSign ? (n > 0 ? "+" : n < 0 ? "−" : "") : (n < 0 ? "−" : "");
  return sign + cur.sym + numStr;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function tint(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

/* ---------- toast ---------- */
function toast(msg, emoji) {
  const wrap = document.getElementById("toast-wrap");
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = (emoji ? `<span>${emoji}</span>` : "") + esc(msg);
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ---------- bottom sheet ---------- */
const Sheet = {
  onClose: null,
  open(html, onClose) {
    const sh = document.getElementById("sheet");
    const bd = document.getElementById("sheet-backdrop");
    sh.innerHTML = html;
    sh.classList.remove("hidden");
    bd.classList.remove("hidden");
    sh.scrollTop = 0;
    this.onClose = onClose || null;
  },
  close() {
    document.getElementById("sheet").classList.add("hidden");
    document.getElementById("sheet-backdrop").classList.add("hidden");
    if (this.onClose) { this.onClose(); this.onClose = null; }
  },
  isOpen() { return !document.getElementById("sheet").classList.contains("hidden"); },
};

/* ---------- confirm dialog (uses sheet) ---------- */
function confirmSheet(title, message, okLabel, onOk) {
  Sheet.open(`
    <div class="sheet-title">${esc(title)}</div>
    <p class="sub center" style="margin-bottom:18px">${esc(message)}</p>
    <div class="row2">
      <button class="btn ghost" data-action="close-sheet">Cancel</button>
      <button class="btn danger" id="confirm-ok">${esc(okLabel)}</button>
    </div>`);
  document.getElementById("confirm-ok").onclick = () => { Sheet.close(); onOk(); };
}

/* ---------- animated count-up ---------- */
function countUp(el, value, ms) {
  const dur = ms || 700, start = performance.now();
  const step = now => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(value * eased);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = fmt(value);
  };
  requestAnimationFrame(step);
}

/* ---------- misc option builders ---------- */
function accountOptions(selectedId) {
  return Store.state.accounts.map(a => {
    const t = ACCOUNT_TYPES.find(x => x.id === a.type);
    return `<option value="${a.id}" ${a.id === selectedId ? "selected" : ""}>${t ? t.emoji + " " : ""}${esc(a.name)}</option>`;
  }).join("");
}

function categoryChips(type, selectedId) {
  return Store.state.categories.filter(c => c.type === type).map(c => `
    <button class="chip ${c.id === selectedId ? "on" : ""}" data-cat="${c.id}">
      <span class="em">${c.emoji}</span>${esc(c.name)}
    </button>`).join("");
}

const EMOJI_CHOICES = ["🍔","🍕","☕","🛒","🚕","🚌","⛽","🛍️","👗","🎬","🎮","🎵","💡","💧","📶","💊","🏥","🏋️","🎓","📚","✈️","🏖️","🏠","📺","💇","🎁","🐶","👶","💼","🏪","📈","💰","🧧","💸","🔧","📦","🖥️","📱","🏍️","🛡️","💍","🍺"];
const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
