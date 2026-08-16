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

  /* Multi-series line chart.
     series = [{ values:[n], color, dashed, fill }] ; labels align to values */
  line(series, labels, w, h, opts) {
    w = w || 340; h = h || 150;
    const o = opts || {};
    const padL = 4, padR = 4, padB = 20, padT = 10;
    const all = series.flatMap(s => s.values);
    const yMax = Math.max(o.yMax != null ? o.yMax : -Infinity, ...all, 1);
    const yMin = Math.min(o.yMin != null ? o.yMin : 0, ...all, 0);
    const span = (yMax - yMin) || 1;
    const n = Math.max(...series.map(s => s.values.length), 2);
    const px = i => padL + (i / (n - 1)) * (w - padL - padR);
    const py = v => h - padB - ((v - yMin) / span) * (h - padB - padT);

    let out = "";
    // zero line when the range dips negative
    if (yMin < 0) out += `<line x1="0" y1="${py(0)}" x2="${w}" y2="${py(0)}" stroke="var(--border2)" stroke-width="1"/>`;

    series.forEach((s, si) => {
      if (!s.values.length) return;
      const pts = s.values.map((v, i) => [px(i), py(v)]);
      let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1][0] + pts[i][0]) / 2;
        d += ` C ${mx.toFixed(1)} ${pts[i - 1][1].toFixed(1)}, ${mx.toFixed(1)} ${pts[i][1].toFixed(1)}, ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
      }
      if (s.fill) {
        out += `<defs><linearGradient id="lg${si}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${s.color}" stop-opacity=".32"/>
          <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>
          <path d="${d} L ${px(s.values.length - 1)} ${py(yMin)} L ${px(0)} ${py(yMin)} Z" fill="url(#lg${si})"/>`;
      }
      out += `<path class="ln" d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4"
        stroke-linecap="round" stroke-linejoin="round" ${s.dashed ? 'stroke-dasharray="5 5" stroke-width="1.8" opacity=".75"' : ""}/>`;
      if (s.dot !== false && pts.length) {
        const last = pts[pts.length - 1];
        out += `<circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.6" fill="${s.color}"/>`;
      }
    });

    (labels || []).forEach((lb, i) => {
      if (!lb) return;
      out += `<text x="${px(i)}" y="${h - 5}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--muted)">${esc(lb)}</text>`;
    });
    return `<svg class="linechart" width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${out}</svg>`;
  },

  /* vertical bars with the peak highlighted (weekday patterns) */
  vbars(items, w, h) {
    w = w || 340; h = h || 130;
    const max = Math.max(...items.map(i => i.total), 1);
    const peak = items.reduce((a, b) => b.total > a.total ? b : a, items[0]);
    const slot = w / items.length, bw = Math.min(30, slot * 0.56);
    let out = "";
    items.forEach((it, i) => {
      const cx = i * slot + slot / 2;
      const bh = Math.max(2, (it.total / max) * (h - 42));
      const isPeak = it.total === peak.total && it.total > 0;
      out += `<rect class="b" x="${cx - bw / 2}" y="${h - 22 - bh}" width="${bw}" height="${bh}" rx="5"
        fill="${isPeak ? "var(--primary)" : "var(--chip)"}" style="animation-delay:${i * 60}ms"/>`;
      out += `<text x="${cx}" y="${h - 8}" text-anchor="middle" font-size="10" font-weight="600"
        fill="${isPeak ? "var(--primary2)" : "var(--muted)"}">${esc(it.label)}</text>`;
    });
    return `<svg class="bars-svg" width="100%" viewBox="0 0 ${w} ${h}">${out}</svg>`;
  },

  /* GitHub-style month grid shaded by daily spend */
  calendarHeat(y, m, dayMap) {
    const dim = D.daysInMonth(y, m);
    const first = (new Date(y, m, 1).getDay() + 6) % 7;      // Monday-first offset
    const prefix = y + "-" + String(m + 1).padStart(2, "0");
    const vals = [];
    for (let d = 1; d <= dim; d++) vals.push(dayMap[prefix + "-" + String(d).padStart(2, "0")] || 0);
    const max = Math.max(...vals, 1);
    const today = D.todayISO();

    let cells = "";
    for (let i = 0; i < first; i++) cells += `<div class="hc empty"></div>`;
    for (let d = 1; d <= dim; d++) {
      const iso = prefix + "-" + String(d).padStart(2, "0");
      const v = dayMap[iso] || 0;
      const lvl = v === 0 ? 0 : Math.min(4, Math.ceil(v / max * 4));
      cells += `<div class="hc lv${lvl} ${iso === today ? "today" : ""}" title="${D.short(iso)}: ${fmt(v)}"
        data-action="heat-day" data-date="${iso}"><span>${d}</span></div>`;
    }
    return `<div class="heat">
      <div class="heat-head">${["M", "T", "W", "T", "F", "S", "S"].map(x => `<span>${x}</span>`).join("")}</div>
      <div class="heat-grid">${cells}</div>
      <div class="heat-legend"><span>Less</span>
        ${[0, 1, 2, 3, 4].map(l => `<i class="hc lv${l}"></i>`).join("")}
        <span>More</span></div>
    </div>`;
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
