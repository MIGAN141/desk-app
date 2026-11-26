// util.js - pure helpers (no DOM except h()). Also loaded by node for tests: module.exports at the bottom.
(function (root) {
  const U = {};
  const nf = (v, d) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const ok = (v) => v !== null && v !== undefined && v !== "" && isFinite(Number(v));

  U.fmtUsd = (v, d = 2) => (ok(v) ? "$" + nf(v, d) : "—");
  U.fmtSigned = (v) => (ok(v) ? (v < 0 ? "-$" : "+$") + nf(Math.abs(v), 2) : "—");
  U.fmtPct = (v, d = 2) => (ok(v) ? (v < 0 ? "-" : "+") + nf(Math.abs(v), d) + "%" : "—");
  U.fmtMult = (v) => (ok(v) ? nf(v, 2) + "×" : "—");
  U.fmtBig = (v) => {
    if (!ok(v)) return "—";
    const a = Math.abs(v);
    if (a >= 1e9) return "$" + nf(v / 1e9, 2) + "B";
    if (a >= 1e6) return "$" + nf(v / 1e6, 2) + "M";
    if (a >= 1e3) return "$" + nf(v / 1e3, 1) + "K";
    return "$" + nf(v, 0);
  };
  U.fmtPrice = (p) => {
    if (!ok(p)) return "—";
    p = Number(p);
    if (p >= 1) return "$" + nf(p, p >= 100 ? 2 : 4);
    const dec = Math.min(12, Math.max(4, 3 - Math.floor(Math.log10(p))));
    return "$" + p.toFixed(dec);
  };
  U.shortMint = (m) => (m && m.length > 9 ? m.slice(0, 4) + "…" + m.slice(-4) : m || "");
  U.fmtTime = (ts) => {
    if (!ok(ts)) return "—";
    const d = new Date(ts > 1e11 ? ts : ts * 1000);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return h + ":" + m + " " + ap;
  };
  U.ago = (sec) => {
    if (!ok(sec)) return "—";
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + "s ago";
    if (sec < 3600) return Math.round(sec / 60) + "m ago";
    if (sec < 86400) return Math.round(sec / 3600) + "h ago";
    return Math.round(sec / 86400) + "d ago";
  };
  U.isMint = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s || "");

  // The desk link: {URL}#t={APP_TOKEN} (plan A API) or {URL}#d={DATA_PATH} (plan B files). Pasted whole, or just the fragment.
  U.parseLink = (str) => {
    str = String(str || "").trim();
    const t = str.match(/[#&?]t=([^&#\s]+)/) || str.match(/^t=([^&#\s]+)/);
    const d = str.match(/[#&?]d=([^&#\s]+)/) || str.match(/^d=([^&#\s]+)/);
    if (!t && !d) return null;
    let base = null;
    if (/^https?:\/\//i.test(str)) {
      try {
        const u = new URL(str);
        base = u.origin + u.pathname.replace(/[^/]*$/, "");          // directory of the page, no file name
      } catch (e) { return null; }
    }
    return { base, t: t ? decodeURIComponent(t[1]) : null, d: d ? decodeURIComponent(d[1]) : null };
  };

  // Odometer: which characters changed. Aligned from the right so "$9.99" -> "$10.00" rolls every column that differs.
  U.rollPlan = (oldS, newS) => {
    const out = [];
    for (let i = 0; i < newS.length; i++) {
      const j = oldS.length - (newS.length - i);
      const was = j >= 0 ? oldS[j] : null;
      out.push({ ch: newS[i], digit: /\d/.test(newS[i]), changed: was !== newS[i] });
    }
    return out;
  };
  // 66-100px for the big balance; shrinks (never below 66) so a long number still fits the gutters.
  U.balanceFont = (text, width) => Math.max(66, Math.min(100, Math.floor(width / (Math.max(1, text.length) * 0.6))));

  // chart geometry shared by the canvas code and the tests
  U.scale = (vals, lo, hi, h, padT, padB) => {
    const a = Math.min(...vals, lo), b = Math.max(...vals, hi), span = b - a || Math.max(Math.abs(b) * 0.01, 0.01);
    return (v) => padT + (1 - (v - (a - 0)) / span) * (h - padT - padB);
  };

  // tiny DOM builder: text only, never raw markup. Coin names/symbols come off a chain: they are untrusted.
  U.h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    const add = (k) => {
      if (k === null || k === undefined || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return el;
  };
  // only https links from the API's own `link` fields are ever opened
  U.safeHref = (u) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : null);

  root.U = U;
  if (typeof module !== "undefined") module.exports = U;
})(typeof window !== "undefined" ? window : globalThis);
