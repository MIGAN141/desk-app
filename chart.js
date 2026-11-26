// chart.js - everything drawn by hand on <canvas>, devicePixelRatio aware. No libraries.
(function (root) {
  const C = { green: "#00d35a", red: "#ff453a", orange: "#ff9f0a", cyan: "#64d2ff", blue: "#0a84ff", card: "#1c1c1e", card2: "#2c2c2e",
              t2: "rgba(235,235,245,0.6)", t3: "rgba(235,235,245,0.3)", sep: "rgba(84,84,88,0.55)" };
  const FONT = '600 11px -apple-system, "SF Pro Text", system-ui, sans-serif';
  const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TONE = { blue: C.blue, green: C.green, red: C.red };

  function fit(canvas) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return { g, w, h };
  }
  function pill(g, x, y, text, color, w) {
    g.font = FONT;
    const tw = g.measureText(text).width + 14, h = 20;
    const px = Math.min(Math.max(x - tw / 2, 4), w - tw - 4);
    g.fillStyle = C.card; g.beginPath(); g.roundRect ? g.roundRect(px, y, tw, h, 10) : g.rect(px, y, tw, h); g.fill();
    g.fillStyle = color; g.textBaseline = "middle"; g.textAlign = "left"; g.fillText(text, px + 7, y + h / 2 + 0.5);
    return { x: px, w: tw, h };
  }

  // ---------------------------------------------------------------- LIVE line chart
  class LineChart {
    constructor(canvas) { this.c = canvas; this.data = { points: [], start: null, marks: [] }; this.raf = null; this.from = null; this.p = 1; }
    set(data, animate) {
      const old = this.data;
      this.data = data || { points: [], start: null, marks: [] };
      const a = old.points[old.points.length - 1], b = this.data.points[this.data.points.length - 1];
      cancelAnimationFrame(this.raf);
      if (animate && a && b && b[0] > a[0] && !reduced()) {           // a new point slides in over 250ms
        this.from = a; const t0 = performance.now();
        const step = (now) => { this.p = Math.min(1, (now - t0) / 250); this.draw(); if (this.p < 1) this.raf = requestAnimationFrame(step); };
        this.p = 0; this.raf = requestAnimationFrame(step);
      } else { this.from = null; this.p = 1; this.draw(); }
    }
    draw() {
      const { g, w, h } = fit(this.c); if (w < 8 || h < 8) return;
      let pts = this.data.points.slice();
      if (!pts.length) return;
      if (this.from && this.p < 1 && pts.length > 1) {
        const last = pts[pts.length - 1], f = this.from, e = 1 - Math.pow(1 - this.p, 3);
        pts[pts.length - 1] = [f[0] + (last[0] - f[0]) * e, f[1] + (last[1] - f[1]) * e];
      }
      const t0 = pts[0][0], t1 = pts[pts.length - 1][0], span = t1 - t0 || 1;
      const marks = (this.data.marks || []).filter((m) => m.ts >= t0 && m.ts <= t1);
      const rows = marks.length ? Math.min(4, Math.max(...marks.map((m) => m.row || 0)) + 1) : 0;
      const padT = 14 + rows * 24, padB = 12;
      const vals = pts.map((p) => p[1]), start = this.data.start;
      let lo = Math.min(...vals, start == null ? Infinity : start), hi = Math.max(...vals, start == null ? -Infinity : start);
      const pad = (hi - lo) * 0.08 || Math.max(Math.abs(hi) * 0.01, 0.01);
      lo -= pad; hi += pad;
      const X = (t) => (pts.length === 1 ? w : ((t - t0) / span) * w), Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
      if (start != null) {                                                      // dashed start line
        g.strokeStyle = C.t3; g.lineWidth = 1; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(0, Y(start)); g.lineTo(w, Y(start)); g.stroke(); g.setLineDash([]);
      }
      const xy = pts.length === 1 ? [[0, Y(pts[0][1])], [w, Y(pts[0][1])]] : pts.map((p) => [X(p[0]), Y(p[1])]);
      const grad = g.createLinearGradient(0, padT, 0, h);                       // the one gradient: under the line
      grad.addColorStop(0, "rgba(0,211,90,0.28)"); grad.addColorStop(1, "rgba(0,211,90,0)");
      g.beginPath(); xy.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.lineTo(xy[xy.length - 1][0], h); g.lineTo(xy[0][0], h); g.closePath(); g.fillStyle = grad; g.fill();
      g.beginPath(); xy.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.strokeStyle = C.green; g.lineWidth = 2.5; g.lineJoin = "round"; g.lineCap = "round"; g.stroke();
      const e = xy[xy.length - 1]; g.fillStyle = C.green; g.beginPath(); g.arc(Math.min(e[0], w - 4), e[1], 4, 0, 7); g.fill();
      for (const m of marks) {                                                  // marks above the line; a later mark sits one row higher
        let yi = pts.findIndex((p) => p[0] >= m.ts); if (yi < 0) yi = pts.length - 1;
        const mx = X(m.ts), my = Y(pts[yi][1]), col = TONE[m.tone] || C.blue;
        const py = Math.max(2, my - 14 - 22 - (m.row || 0) * 24);
        g.strokeStyle = col; g.globalAlpha = 0.5; g.lineWidth = 1; g.beginPath(); g.moveTo(mx, py + 20); g.lineTo(mx, my); g.stroke(); g.globalAlpha = 1;
        g.fillStyle = col; g.beginPath(); g.arc(mx, my, 3.5, 0, 7); g.fill();
        pill(g, mx, py, m.label, col, w);
      }
    }
  }

  // ---------------------------------------------------------------- 1-minute candles with the orange dashed exit line
  class CandleChart {
    constructor(canvas) { this.c = canvas; this.data = { candles: [], exit: null }; }
    set(candles, exit) { this.data = { candles: candles || [], exit }; this.draw(); }
    draw() {
      const { g, w, h } = fit(this.c), cs = this.data.candles, exit = this.data.exit; if (w < 8 || h < 8) return;
      if (!cs.length) { g.fillStyle = C.t2; g.font = '15px -apple-system, system-ui, sans-serif'; g.textAlign = "center"; g.fillText("No price history yet", w / 2, h / 2); return; }
      const padR = 58, padT = 12, padB = 14, cw = (w - padR) / Math.max(cs.length, 24);
      let lo = Math.min(...cs.map((c) => c.l), exit == null ? Infinity : exit), hi = Math.max(...cs.map((c) => c.h), exit == null ? -Infinity : exit);
      const pad = (hi - lo) * 0.1 || hi * 0.01; lo -= pad; hi += pad;
      const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
      g.font = '11px ui-monospace, "SF Mono", Menlo, monospace'; g.textAlign = "right"; g.textBaseline = "middle"; g.fillStyle = C.t3;
      [hi, (hi + lo) / 2, lo].forEach((v) => g.fillText(fmt(v), w - 4, Y(v)));
      cs.forEach((c, i) => {
        const x = (w - padR) - (cs.length - i) * cw + cw / 2, up = c.c >= c.o, col = up ? C.green : C.red;
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, Y(c.h)); g.lineTo(x, Y(c.l)); g.stroke();
        const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
        g.fillRect(x - cw * 0.3, y1, cw * 0.6, Math.max(1.5, y2 - y1));
      });
      if (exit != null) {
        g.strokeStyle = C.orange; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(0, Y(exit)); g.lineTo(w - padR, Y(exit)); g.stroke(); g.setLineDash([]);
        g.fillStyle = C.orange; g.textAlign = "left"; g.font = '600 11px -apple-system, system-ui, sans-serif'; g.fillText("Exit " + fmt(exit), 6, Math.max(10, Y(exit) - 9));
      }
    }
  }
  function fmt(p) { return p >= 1 ? p.toFixed(2) : p.toFixed(Math.min(10, Math.max(4, 3 - Math.floor(Math.log10(p))))); }

  // ---------------------------------------------------------------- score ring 0-100, green from `greenFrom`
  function drawRing(canvas, score, greenFrom) {
    const { g, w, h } = fit(canvas), r = Math.min(w, h) / 2 - 4; if (r < 4) return;
    g.lineWidth = 5; g.lineCap = "round";
    g.strokeStyle = C.sep; g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.stroke();
    if (score != null) {
      g.strokeStyle = score >= greenFrom ? C.green : C.orange;
      g.beginPath(); g.arc(w / 2, h / 2, r, -Math.PI / 2, -Math.PI / 2 + (Math.min(100, score) / 100) * Math.PI * 2); g.stroke();
    }
    g.fillStyle = "#fff"; g.font = '600 17px -apple-system, "SF Pro Display", system-ui, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(score == null ? "—" : String(Math.round(score)), w / 2, h / 2 + 1);
  }

  // ---------------------------------------------------------------- audit: the coin as 8 discs, a cyan beam reads each layer
  class AuditStage {
    constructor(canvas, symbol, layers) { this.c = canvas; this.sym = symbol; this.layers = layers; this.t = 0; this.revealed = -1; this.raf = null; this.onReveal = null; }
    run() {
      const SLOT = 430, n = this.layers.length, t0 = performance.now();
      if (reduced()) { this.revealed = n - 1; this.t = n; this.draw(); for (let i = 0; i < n; i++) this.onReveal && this.onReveal(i); return; }
      const step = (now) => {
        const e = now - t0; this.t = Math.min(n, e / SLOT);
        const rev = Math.min(n - 1, Math.floor(this.t - 0.55));
        while (this.revealed < rev) { this.revealed++; this.onReveal && this.onReveal(this.revealed); }
        this.draw();
        if (e < SLOT * n + 400) this.raf = requestAnimationFrame(step); else { while (this.revealed < n - 1) { this.revealed++; this.onReveal && this.onReveal(this.revealed); } this.t = n; this.draw(); }
      };
      this.raf = requestAnimationFrame(step);
    }
    stop() { cancelAnimationFrame(this.raf); }
    draw() {
      const { g, w, h } = fit(this.c); if (w < 8 || h < 8) return; const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 34, n = this.layers.length;
      g.strokeStyle = C.sep; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
      const ang = (i) => -Math.PI / 2 + (i / n) * Math.PI * 2;
      if (this.t < n) {                                                         // the beam: a cyan line from the coin to the disc being read
        const a = -Math.PI / 2 + (this.t / n) * Math.PI * 2;
        g.strokeStyle = C.cyan; g.lineWidth = 2; g.lineCap = "round"; g.beginPath(); g.moveTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34); g.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6)); g.stroke();
      }
      g.fillStyle = C.card2; g.beginPath(); g.arc(cx, cy, 32, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.font = '700 16px -apple-system, system-ui, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText((this.sym || "?").slice(0, 5), cx, cy + 1);
      this.layers.forEach((l, i) => {
        const x = cx + Math.cos(ang(i)) * R, y = cy + Math.sin(ang(i)) * R, done = i <= this.revealed;
        const col = !done ? C.card2 : l.pass === true ? C.green : l.pass === false ? C.red : "#48484a";
        g.fillStyle = col; g.beginPath(); g.arc(x, y, 21, 0, 7); g.fill();
        g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = '700 15px -apple-system, system-ui, sans-serif';
        g.fillText(done ? (l.pass === true ? "✓" : l.pass === false ? "✕" : "–") : String(i + 1), x, y + 1);
      });
    }
  }

  root.Charts = { LineChart, CandleChart, drawRing, AuditStage, reduced, C };
})(window);
