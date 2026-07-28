/* ============ Paisa — lightweight SVG charts ============ */
"use strict";

const Charts = {
  /* Donut: items = [{label, value, color}] ; centerText shown in middle */
  donut(items, size, centerTop, centerBottom) {
    const sz = size || 150, r = sz / 2 - 12, cx = sz / 2, cy = sz / 2;
    const circ = 2 * Math.PI * r;
    const total = items.reduce((s, i) => s + i.value, 0) || 1;
    let offset = 0;
    const segs = items.map(i => {
      const frac = i.value / total;
      const len = Math.max(0, frac * circ - 3); // 3px gap
      const seg = `<circle class="seg" cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${i.color}" stroke-width="16" stroke-linecap="round"
        stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset * circ}"
        transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += frac;
      return seg;
    }).join("");
    return `<svg class="donut" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--chip)" stroke-width="16"/>
      ${segs}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="var(--muted)" font-size="10.5" font-weight="600">${esc(centerTop || "")}</text>
      <text x="${cx}" y="${cy + 15}" text-anchor="middle" fill="var(--text)" font-size="15" font-weight="800">${esc(centerBottom || "")}</text>
    </svg>`;
  },

  /* Grouped bars: months = [{label, inc, exp}] */
  incExpBars(months, w, h) {
    w = w || 340; h = h || 150;
    const padB = 22, padT = 12, bw = 11, gap = 4;
    const max = Math.max(...months.map(m => Math.max(m.inc, m.exp)), 1);
    const groupW = w / months.length;
    let bars = "", labels = "";
    months.forEach((m, i) => {
      const cx = i * groupW + groupW / 2;
      const hInc = (m.inc / max) * (h - padB - padT);
      const hExp = (m.exp / max) * (h - padB - padT);
      bars += `<rect class="b" x="${cx - bw - gap / 2}" y="${h - padB - hInc}" width="${bw}" height="${Math.max(2, hInc)}" rx="4" fill="var(--green)" style="animation-delay:${i * 70}ms"/>`;
      bars += `<rect class="b" x="${cx + gap / 2}" y="${h - padB - hExp}" width="${bw}" height="${Math.max(2, hExp)}" rx="4" fill="var(--red)" style="animation-delay:${i * 70 + 40}ms"/>`;
      labels += `<text x="${cx}" y="${h - 6}" text-anchor="middle" font-size="10" fill="var(--muted)" font-weight="600">${esc(m.label)}</text>`;
    });
    return `<svg class="bars-svg" width="100%" viewBox="0 0 ${w} ${h}">${bars}${labels}</svg>`;
  },

  /* Sparkline area for daily spending */
  spark(points, w, h, color) {
    w = w || 340; h = h || 70;
    const max = Math.max(...points.map(p => p.amt), 1);
    const stepX = w / (points.length - 1 || 1);
    const ys = points.map(p => h - 8 - (p.amt / max) * (h - 16));
    let d = `M 0 ${ys[0].toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const x = i * stepX, px = (i - 1) * stepX;
      const cxm = (px + x) / 2;
      d += ` C ${cxm.toFixed(1)} ${ys[i - 1].toFixed(1)}, ${cxm.toFixed(1)} ${ys[i].toFixed(1)}, ${x.toFixed(1)} ${ys[i].toFixed(1)}`;
    }
    const c = color || "var(--primary2)";
    return `<svg class="spark" width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs><linearGradient id="sparkg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${c}" stop-opacity=".35"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${d} L ${w} ${h} L 0 ${h} Z" fill="url(#sparkg)" stroke="none" style="animation:none;stroke-dasharray:none"/>
      <path d="${d}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`;
  },

  /* small circular progress ring (for goals) */
  ring(pct, size, color, label) {
    const sz = size || 62, r = sz / 2 - 6, cx = sz / 2, cy = sz / 2;
    const circ = 2 * Math.PI * r;
    const len = Math.min(1, pct / 100) * circ;
    return `<svg class="donut" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--chip)" stroke-width="7"/>
      <circle class="seg" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="7"
        stroke-linecap="round" stroke-dasharray="${len} ${circ - len}" transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="var(--text)" font-size="12.5" font-weight="800">${esc(label != null ? label : Math.round(pct) + "%")}</text>
    </svg>`;
  },
};
