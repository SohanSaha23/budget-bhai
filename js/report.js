/* ============ Paisa — monthly statement PDF ============ */
"use strict";

const Report = {
  /* Helvetica has no rupee glyph, so money is written with the code instead */
  money(n) {
    const cur = currencyInfo();
    const abs = Math.abs(n);
    const num = new Intl.NumberFormat(cur.locale, {
      minimumFractionDigits: 0, maximumFractionDigits: abs % 1 ? 2 : 0,
    }).format(abs);
    const unit = cur.code === "INR" ? "Rs." : cur.code + " ";
    return (n < 0 ? "-" : "") + unit + num;
  },

  available() { return !!(window.jspdf && window.jspdf.jsPDF); },

  build(y, m) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 42;                      // page margin
    let cursor = 0;

    const INK = [16, 21, 48], MUTED = [93, 102, 132], VIOLET = [108, 92, 231];
    const GREEN = [5, 150, 105], RED = [225, 29, 72], LINE = [227, 231, 242];

    const from = y + "-" + String(m + 1).padStart(2, "0") + "-01";
    const to = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(D.daysInMonth(y, m)).padStart(2, "0");
    const monthName = D.monthName(y, m);

    const header = (first) => {
      doc.setFillColor(...VIOLET);
      doc.rect(0, 0, W, first ? 5 : 3, "F");
      cursor = first ? 64 : 48;
    };
    const footer = () => {
      const page = doc.internal.getNumberOfPages();
      doc.setDrawColor(...LINE); doc.setLineWidth(0.6);
      doc.line(M, H - 44, W - M, H - 44);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
      doc.text("Budget Bhai — statement for " + monthName, M, H - 30);
      doc.text("Page " + page, W - M, H - 30, { align: "right" });
    };
    const room = (need) => {
      if (cursor + need < H - 60) return;
      footer(); doc.addPage(); header(false);
    };
    const heading = (text) => {
      room(40);
      cursor += 10;
      doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...VIOLET);
      doc.text(text, M, cursor);
      cursor += 6;
      doc.setDrawColor(...LINE); doc.setLineWidth(0.8);
      doc.line(M, cursor, W - M, cursor);
      cursor += 16;
    };
    const row = (cells, opts) => {
      const o = opts || {};
      room(18);
      doc.setFont("helvetica", o.bold ? "bold" : "normal").setFontSize(o.size || 9.5);
      doc.setTextColor(...(o.color || INK));
      cells.forEach(c => {
        if (c.text === "" || c.text == null) return;
        doc.setTextColor(...(c.color || o.color || INK));
        if (c.bold) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", o.bold ? "bold" : "normal");
        doc.text(String(c.text), c.x, cursor, c.align ? { align: c.align } : undefined);
      });
      cursor += o.gap || 16;
      if (o.rule) {
        doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
        doc.line(M, cursor - 11, W - M, cursor - 11);
      }
    };

    /* ---------- title ---------- */
    header(true);
    doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...INK);
    doc.text("Monthly Statement", M, cursor);
    cursor += 22;
    doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(...MUTED);
    doc.text(monthName + "  ·  " + Store.state.settings.name, M, cursor);
    doc.setFontSize(8.5);
    doc.text("Generated " + new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      W - M, cursor, { align: "right" });
    cursor += 24;

    /* ---------- summary ---------- */
    const inc = Store.rangeTotal(from, to, "income");
    const exp = Store.rangeTotal(from, to, "expense");
    const net = inc - exp;
    const rate = inc > 0 ? Math.round(net / inc * 100) : null;

    doc.setFillColor(246, 247, 252);
    doc.roundedRect(M, cursor, W - 2 * M, 68, 6, 6, "F");
    const colW = (W - 2 * M) / 4;
    const cells = [
      ["Income", this.money(inc), GREEN],
      ["Expenses", this.money(exp), RED],
      ["Net saved", this.money(net), net >= 0 ? GREEN : RED],
      ["Savings rate", rate === null ? "—" : rate + "%", net >= 0 ? GREEN : RED],
    ];
    cells.forEach((c, i) => {
      const cx = M + colW * i + colW / 2;
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
      doc.text(c[0], cx, cursor + 24, { align: "center" });
      doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...c[2]);
      doc.text(c[1], cx, cursor + 46, { align: "center" });
    });
    cursor += 88;

    /* ---------- categories ---------- */
    const cats = Store.categorySpendRange(from, to, "expense");
    if (cats.length) {
      heading("Where the money went");
      const total = cats.reduce((s, c) => s + c.amt, 0);
      row([{ text: "Category", x: M }, { text: "Share", x: W - M - 150, align: "right" },
           { text: "Transactions", x: W - M - 80, align: "right" }, { text: "Amount", x: W - M, align: "right" }],
          { bold: true, size: 8.5, color: MUTED, gap: 14, rule: false });
      cats.forEach(c => {
        const n = Store.rangeTx(from, to, "expense").filter(t => t.categoryId === c.cat.id).length;
        row([
          { text: c.cat.name, x: M },
          { text: (total ? Math.round(c.amt / total * 100) : 0) + "%", x: W - M - 150, align: "right", color: MUTED },
          { text: String(n), x: W - M - 80, align: "right", color: MUTED },
          { text: this.money(c.amt), x: W - M, align: "right", bold: true },
        ], { rule: true });
      });
      row([{ text: "Total", x: M }, { text: this.money(total), x: W - M, align: "right" }], { bold: true });
    }

    /* ---------- budgets ---------- */
    const buds = Store.state.budgets;
    if (buds.length) {
      heading("Budgets");
      // two lines per budget: the long "spent / total" figure needs the full width
      buds.forEach(b => {
        const st = Store.budgetStatus(b, y, m);
        const nm = b.categoryId === "ALL" ? "Overall" : Store.cat(b.categoryId).name;
        room(28);
        doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...INK);
        doc.text(nm, M, cursor);
        doc.setFont("helvetica", "bold");
        doc.text(this.money(st.spent) + " / " + this.money(b.amount), W - M, cursor, { align: "right" });
        cursor += 11;
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
        doc.text(st.pct + "% used", M, cursor);
        doc.setTextColor(...(st.over ? RED : GREEN));
        doc.text(st.over ? "over by " + this.money(-st.left) : this.money(st.left) + " left",
          W - M, cursor, { align: "right" });
        cursor += 9;
        doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
        doc.line(M, cursor - 3, W - M, cursor - 3);
        cursor += 7;
      });
    }

    /* ---------- top merchants ---------- */
    const merch = Store.merchantStats(from, to).slice(0, 10);
    if (merch.length) {
      heading("Top places");
      merch.forEach(mm => row([
        { text: mm.name, x: M },
        { text: mm.count + (mm.count === 1 ? " visit" : " visits"), x: W - M - 120, align: "right", color: MUTED },
        { text: this.money(mm.total), x: W - M, align: "right", bold: true },
      ], { rule: true }));
    }

    /* ---------- accounts ---------- */
    if (Store.state.accounts.length) {
      heading("Account balances");
      Store.state.accounts.forEach(a => row([
        { text: a.name, x: M },
        { text: (ACCOUNT_TYPES.find(t => t.id === a.type) || {}).name || "", x: W - M - 140, align: "right", color: MUTED },
        { text: this.money(Store.accountBalance(a.id)), x: W - M, align: "right", bold: true },
      ], { rule: true }));
      row([{ text: "Net worth", x: M }, { text: this.money(Store.netWorth()), x: W - M, align: "right" }], { bold: true });
    }

    /* ---------- transactions ---------- */
    const txs = Store.rangeTx(from, to).sort((a, b) => a.date < b.date ? -1 : 1);
    if (txs.length) {
      heading("All transactions (" + txs.length + ")");
      row([{ text: "Date", x: M }, { text: "Details", x: M + 58 },
           { text: "Account", x: W - M - 130, align: "right" }, { text: "Amount", x: W - M, align: "right" }],
          { bold: true, size: 8.5, color: MUTED, gap: 14 });
      const detailX = M + 58;
      const detailW = (W - M - 140) - detailX;        // stop short of the account column
      txs.forEach(t => {
        const isTrf = t.type === "transfer";
        const cat = isTrf ? "Transfer" : Store.cat(t.categoryId).name;
        const sign = t.type === "income" ? "+" : t.type === "expense" ? "-" : "";

        // measure first so the row, its note and the rule never share a line
        doc.setFont("helvetica", "normal").setFontSize(9);
        const nameLines = doc.splitTextToSize(t.payee || cat, detailW).slice(0, 1);
        doc.setFont("helvetica", "italic").setFontSize(7.5);
        const noteLines = t.note ? doc.splitTextToSize(t.note, detailW).slice(0, 2) : [];
        const blockH = 13 + noteLines.length * 9 + 5;
        room(blockH + 6);

        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
        doc.text(D.parse(t.date).getDate() + " " + D.parse(t.date).toLocaleDateString("en-IN", { month: "short" }), M, cursor);
        doc.text((Store.acc(t.accountId) || {}).name || "", W - M - 130, cursor, { align: "right" });
        doc.setTextColor(...INK);
        doc.text(nameLines[0] || "", detailX, cursor);
        doc.setFont("helvetica", "bold").setTextColor(...(t.type === "income" ? GREEN : isTrf ? MUTED : RED));
        doc.text(sign + this.money(t.amount), W - M, cursor, { align: "right" });
        cursor += 11;

        if (noteLines.length) {
          doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(...MUTED);
          noteLines.forEach(ln => { doc.text(ln, detailX, cursor); cursor += 9; });
          cursor += 1;
        }
        cursor += 5;
        doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
        doc.line(M, cursor - 7, W - M, cursor - 7);
      });
    }

    footer();
    return doc;
  },

  /* ---------- split statement for one friend ---------- */
  splitStatement(friendId, range) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 42;
    let cursor = 0;

    const INK = [16, 21, 48], MUTED = [93, 102, 132], VIOLET = [108, 92, 231];
    const GREEN = [5, 150, 105], RED = [225, 29, 72], LINE = [227, 231, 242];

    const who = Store.friend(friendId)?.name || "Friend";
    const me = Store.state.settings.name || "Me";
    const st = Store.friendStatement(friendId, range.from, range.to);

    const header = (first) => {
      doc.setFillColor(...VIOLET);
      doc.rect(0, 0, W, first ? 5 : 3, "F");
      cursor = first ? 64 : 48;
    };
    const footer = () => {
      doc.setDrawColor(...LINE); doc.setLineWidth(0.6);
      doc.line(M, H - 44, W - M, H - 44);
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
      doc.text("Split statement · " + who + " · " + range.label, M, H - 30);
      doc.text("Page " + doc.internal.getNumberOfPages(), W - M, H - 30, { align: "right" });
    };
    const room = (need) => { if (cursor + need >= H - 60) { footer(); doc.addPage(); header(false); } };
    const heading = (text) => {
      room(44); cursor += 10;
      doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...VIOLET);
      doc.text(text, M, cursor);
      cursor += 6;
      doc.setDrawColor(...LINE); doc.setLineWidth(0.8);
      doc.line(M, cursor, W - M, cursor);
      cursor += 16;
    };

    /* ---- title ---- */
    header(true);
    doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...INK);
    doc.text("Split Statement", M, cursor);
    cursor += 22;
    doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(...MUTED);
    doc.text("For " + who + "   ·   from " + me, M, cursor);
    doc.setFontSize(8.5);
    doc.text("Generated " + new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      W - M, cursor, { align: "right" });
    cursor += 14;
    doc.setFontSize(9.5).setTextColor(...INK);
    doc.text("Period: " + range.label, M, cursor);
    cursor += 20;

    /* ---- amount due banner ---- */
    const due = st.closing;
    const owesMe = due > 0.01, owesThem = due < -0.01;
    doc.setFillColor(246, 247, 252);
    doc.roundedRect(M, cursor, W - 2 * M, 62, 6, 6, "F");
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text(owesMe ? who + " owes " + me : owesThem ? me + " owes " + who : "All settled up",
      W / 2, cursor + 22, { align: "center" });
    doc.setFont("helvetica", "bold").setFontSize(24)
      .setTextColor(...(owesMe ? GREEN : owesThem ? RED : MUTED));
    doc.text(this.money(Math.abs(due)), W / 2, cursor + 48, { align: "center" });
    cursor += 80;

    /* ---- how we got here ---- */
    heading("How this adds up");
    const lineItem = (label, value, opts) => {
      const o = opts || {};
      room(18);
      doc.setFont("helvetica", o.bold ? "bold" : "normal").setFontSize(o.bold ? 10.5 : 9.5);
      doc.setTextColor(...(o.labelColor || (o.bold ? INK : MUTED)));
      doc.text(label, M, cursor);
      doc.setTextColor(...(o.color || INK));
      doc.setFont("helvetica", "bold");
      doc.text(value, W - M, cursor, { align: "right" });
      cursor += o.gap || 16;
      if (o.rule) {
        doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
        doc.line(M, cursor - 11, W - M, cursor - 11);
      }
    };

    const p = st.prior;
    if (range.from && (p.expenseCharges || p.paymentsIn || p.paymentsOut || p.expenseCredits)) {
      lineItem("Earlier charges (before " + D.short(range.from) + ")", this.money(p.expenseCharges), { rule: true });
      if (p.expenseCredits) lineItem("Less: " + who + " paid for shared costs", "- " + this.money(p.expenseCredits), { rule: true });
      if (p.paymentsIn) lineItem("Less: already paid by " + who, "- " + this.money(p.paymentsIn), { color: GREEN, rule: true });
      if (p.paymentsOut) lineItem("Plus: paid to " + who, "+ " + this.money(p.paymentsOut), { rule: true });
      lineItem("Brought forward", this.money(st.opening), { bold: true, rule: true });
    } else {
      lineItem("Brought forward", this.money(st.opening), { bold: true, rule: true });
    }

    const per = st.period;
    if (per.expenseCharges) lineItem("New shared expenses this period", "+ " + this.money(per.expenseCharges), { rule: true });
    if (per.expenseCredits) lineItem("Paid by " + who + " this period", "- " + this.money(per.expenseCredits), { rule: true });
    if (per.paymentsIn) lineItem("Payments received from " + who, "- " + this.money(per.paymentsIn), { color: GREEN, rule: true });
    if (per.paymentsOut) lineItem("Payments made to " + who, "+ " + this.money(per.paymentsOut), { rule: true });
    cursor += 2;
    lineItem(owesThem ? "Amount you owe " + who : "Amount due from " + who, this.money(Math.abs(due)),
      { bold: true, color: owesMe ? GREEN : owesThem ? RED : INK });

    /* ---- itemised expenses ---- */
    const exps = st.items.filter(i => i.kind === "expense");
    if (exps.length) {
      heading("Shared expenses in this period (" + exps.length + ")");
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...MUTED);
      doc.text("Date", M, cursor);
      doc.text("Details", M + 58, cursor);
      doc.text("Total bill", W - M - 150, cursor, { align: "right" });
      doc.text(who + "'s share", W - M, cursor, { align: "right" });
      cursor += 14;

      const detailX = M + 58, detailW = (W - M - 160) - detailX;
      exps.forEach(it => {
        const cat = Store.cat(it.categoryId || "c_other");
        const grp = it.groupId ? Store.group(it.groupId) : null;
        doc.setFont("helvetica", "normal").setFontSize(9);
        const nameLine = doc.splitTextToSize(it.desc, detailW)[0] || "";
        const sub = cat.name + (grp ? " · " + grp.name : "") +
          (it.paidBy === "me" ? " · you paid" : " · " + who + " paid") + " · " + it.ways + " ways";
        doc.setFontSize(7.5);
        const subLine = doc.splitTextToSize(sub, detailW)[0] || "";
        room(30);

        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
        doc.text(D.parse(it.date).getDate() + " " + D.parse(it.date).toLocaleDateString("en-IN", { month: "short" }), M, cursor);
        doc.setTextColor(...INK);
        doc.text(nameLine, detailX, cursor);
        doc.text(this.money(it.total), W - M - 150, cursor, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...(it.delta >= 0 ? INK : RED));
        doc.text((it.delta >= 0 ? "" : "- ") + this.money(Math.abs(it.delta)), W - M, cursor, { align: "right" });
        cursor += 11;
        doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(...MUTED);
        doc.text(subLine, detailX, cursor);
        cursor += 9;
        doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
        doc.line(M, cursor - 3, W - M, cursor - 3);
        cursor += 7;
      });
    }

    /* ---- payments ---- */
    const pays = st.items.filter(i => i.kind === "payment");
    if (pays.length) {
      heading("Payments in this period (" + pays.length + ")");
      pays.forEach(it => {
        room(18);
        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
        doc.text(D.parse(it.date).getDate() + " " + D.parse(it.date).toLocaleDateString("en-IN", { month: "short" }), M, cursor);
        doc.setTextColor(...INK);
        doc.text(it.direction === "in" ? who + " paid " + me : me + " paid " + who, M + 58, cursor);
        doc.setFont("helvetica", "bold").setTextColor(...(it.direction === "in" ? GREEN : INK));
        doc.text((it.direction === "in" ? "- " : "+ ") + this.money(it.amount), W - M, cursor, { align: "right" });
        cursor += 13;
        doc.setDrawColor(...LINE); doc.setLineWidth(0.5);
        doc.line(M, cursor - 5, W - M, cursor - 5);
        cursor += 4;
      });
    }

    if (!exps.length && !pays.length) {
      heading("Activity");
      doc.setFont("helvetica", "italic").setFontSize(9.5).setTextColor(...MUTED);
      doc.text("No shared expenses or payments in this period.", M, cursor);
      cursor += 16;
    }

    /* ---- note when the app's simplified group maths differs ---- */
    if ((!range.to || range.to >= D.todayISO()) && Math.abs(st.simplified - due) > 1) {
      room(40);
      cursor += 6;
      doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(...MUTED);
      const note = "Note: this statement is the direct account between the two of you. Inside shared groups "
        + "Budget Bhai can also simplify who pays whom across everyone, which nets your balance to "
        + this.money(Math.abs(st.simplified)) + ".";
      doc.splitTextToSize(note, W - 2 * M).forEach(l => { doc.text(l, M, cursor); cursor += 10; });
    }

    footer();
    return doc;
  },

  async shareSplitStatement(friendId, range) {
    if (!this.available()) { toast("PDF engine didn't load", "⚠️"); return; }
    const doc = this.splitStatement(friendId, range);
    const who = (Store.friend(friendId)?.name || "friend").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await App.downloadBinary("statement-" + who + "-" + D.todayISO() + ".pdf",
      doc.output("datauristring").split(",")[1], "application/pdf");
  },

  async share(y, m) {
    if (!this.available()) { toast("PDF engine didn't load", "⚠️"); return; }
    const doc = this.build(y, m);
    const name = "budget-bhai-" + y + "-" + String(m + 1).padStart(2, "0") + ".pdf";
    const b64 = doc.output("datauristring").split(",")[1];
    await App.downloadBinary(name, b64, "application/pdf");
  },
};
