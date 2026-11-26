// app.js - FOMO Desk, STEP 10. Plain JS, no framework, no build. Every string that came off a chain is rendered with textContent (U.h).
(function () {
  "use strict";
  const { h } = U, D = Desk, Ch = Charts;
  const BOTS = ["scanner", "analyst", "brain", "executor", "risk"];
  const COLOR = { scanner: "#64d2ff", analyst: "#ffd60a", brain: "#bf5af2", executor: "#00d35a", risk: "#ff6b9a" };
  const RANGES = ["LIVE", "1H", "4H", "1D", "1W", "ALL"];
  const S = { st: null, stAt: 0, range: "LIVE", chart: null, acct: null, orders: [], act: { rows: [], next: null, loaded: false }, decs: {}, tab: "home",
              fails: 0, retry: 0, down: false, lastOk: 0, firstChart: true, frameTimer: null };
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  function ico(d, cls) { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 24 24"); if (cls) s.setAttribute("class", cls);
    d.split("|").forEach((p) => { const e = document.createElementNS(NS, "path"); e.setAttribute("d", p); s.appendChild(e); }); return s; }
  const ICON = {
    home: "M3 11.5 12 4l9 7.5|M5.5 10v9.5h13V10", bots: "M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3z|M12 4v4|M9 13h.01|M15 13h.01",
    act: "M4 6h16|M4 12h16|M4 18h10", acct: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M4.5 20c.8-3.4 3.8-5.5 7.5-5.5s6.7 2.1 7.5 5.5",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z|M20 20l-4-4", bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z|M10 21h4",
    chev: "M9 6l6 6-6 6", back: "M15 4 7 12l8 8", ext: "M14 4h6v6|M20 4 10 14|M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" };
  const $ = (id) => document.getElementById(id);
  const link = (u) => U.safeHref(u);
  const kindColor = { bought: "var(--blue)", sold: "var(--green)", stopped: "var(--red)", rejected: "var(--text3)", copied: "var(--purple)" };

  // ============================================================ toast / sheet / fullscreen
  let toastT = null;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600); }
  function openSheet(content) { const s = $("sheet"); s.replaceChildren(h("div", { class: "grab" }), content); s.classList.add("on"); $("scrim").classList.add("on"); }
  function closeSheet() { $("sheet").classList.remove("on"); $("scrim").classList.remove("on"); }

  // ============================================================ the paste-your-desk-link screen (1 field)
  function showPaste(msg) {
    const p = $("paste"); p.classList.add("on");
    $("paste-msg").textContent = msg || "";
  }
  function submitPaste() {
    const l = U.parseLink($("paste-in").value);
    if (!l) { $("paste-msg").textContent = "That link has no token. It ends with #t=… or #d=…"; return; }
    D.save(l); location.reload();
  }

  // ============================================================ small builders
  function actRow(a, opts = {}) {
    const sym = a.symbol || (a.mint ? U.shortMint(a.mint) : "?");
    const right = a.kind === "rejected" ? "Skipped" : a.value;
    const rc = a.kind === "sold" ? "green" : a.kind === "stopped" ? "red" : "t2";
    const open = () => a.mint && (a.kind === "rejected" ? pushAudit(a.mint) : pushCoin(a.mint));
    const ext = link(a.link) ? h("a", { class: "ext", href: link(a.link), target: "_blank", rel: "noopener", "aria-label": "Open on FOMO", onclick: (e) => e.stopPropagation() }, ico(ICON.ext)) : null;
    return h("div", { class: "row", role: "button", tabindex: 0, onclick: open },
      h("div", { class: "ic", style: { color: kindColor[a.kind] || "#fff" } }, (sym[0] || "?").toUpperCase()),
      h("div", { class: "mid" }, h("div", { class: "t" }, a.title || a.kind), h("div", { class: "s" }, a.subtitle || "")),
      h("div", { class: "v " + rc }, right || ""), ext);
  }
  function emptyBox(t) { return h("div", { class: "emptybox" }, t); }
  function skel(hpx, w) { return h("div", { class: "sk", style: { height: hpx + "px", width: w || "100%" } }); }
  function secHead(title, more, onmore) {
    return h("div", { class: "sec" }, h("h2", {}, title), more ? h("button", { class: "more", onclick: onmore }, more) : null);
  }
  const offlineEls = [];
  function offlineRow() { const e = h("div", { class: "offline", role: "status" }); offlineEls.push(e); return e; }
  function paperBadge() { const b = h("span", { class: "badge", "data-paper": "" }, "PAPER"); paperBadges.push(b); return b; }
  const paperBadges = [];

  // ============================================================ HOME
  const H = {};
  function buildHome() {
    const root = $("v-home");
    H.av = h("button", { class: "ibtn", "aria-label": "Account", onclick: () => setTab("account") }, h("div", { class: "avatar" }, "·"));
    H.search = h("button", { class: "ibtn", "aria-label": "Search", onclick: toggleSearch }, ico(ICON.search));
    H.dot = h("span", { class: "dot", hidden: true });
    H.bell = h("button", { class: "ibtn bell", "aria-label": "Alerts", onclick: openBell }, ico(ICON.bell), H.dot);
    const nav = h("div", { class: "nav" }, H.av, h("button", { class: "title", onclick: () => setTab("account") }, "Grok Bot", ico(ICON.chev)), h("div", { class: "sp" }), H.search, H.bell);
    H.sbox = h("div", { class: "search" }, H.sin = h("input", { type: "search", placeholder: "Name, symbol or mint", autocomplete: "off", autocapitalize: "off", spellcheck: "false", oninput: runSearch }), H.sres = h("div", { class: "res" }));
    H.balEl = h("div", {}); H.bal = new Odometer(H.balEl);
    H.balrow = h("div", { class: "balrow" }, H.balEl, paperBadge());
    H.pctEl = h("span", { class: "pct" }); H.pct = new Odometer(H.pctEl);
    H.multEl = h("span", {}); H.mult = new Odometer(H.multEl);
    H.multPill = h("span", { class: "mult" }, H.multEl); H.market = h("span", { class: "pill" });
    H.sub = h("div", { class: "subrow" }, H.pctEl, H.multPill, H.market);
    H.canvas = h("canvas", { "aria-label": "Balance chart" });
    H.line = new Ch.LineChart(H.canvas);
    H.ranges = h("div", { class: "ranges live" }, RANGES.map((r) => h("button", { "data-r": r, class: r === S.range ? "on" : "", onclick: () => { S.range = r; S.firstChart = true; markRanges(); loadChart(); } }, r)));
    H.chartwrap = h("div", { class: "chartwrap" }, H.canvas);
    // live screen card
    H.imgA = h("img", { alt: "", class: "front" }); H.imgB = h("img", { alt: "" });
    H.led = h("span", { class: "led" }); H.tlt = h("span", {}, "—");
    H.tl = h("div", { class: "tl" }, H.led, H.tlt); H.tr = h("div", { class: "tr" }, "Idle");
    H.empty = h("div", { class: "empty" }, "No frame yet");
    H.screen = h("div", { class: "screen", role: "button", tabindex: 0, "aria-label": "Live screen, tap for full screen", onclick: openFull }, H.imgA, H.imgB, H.empty, H.tl, H.tr, h("div", { class: "bl" }, paperBadge()));
    H.last = h("div", { class: "lastorder" }); 
    H.carousel = h("div", { class: "carousel" });
    H.botsHead = secHead("Bots · 5 running");
    H.actList = h("div", {});
    H.skel = h("div", {}, h("div", { class: "balrow" }, skel(70, "210px")), h("div", { class: "subrow" }, skel(28, "150px")), skel(230), h("div", { style: { height: "14px" } }), skel(190),
      h("div", { style: { height: "26px" } }), h("div", { class: "carousel" }, skel(176, "232px"), skel(176, "232px")), h("div", { style: { height: "26px" } }), skel(180));
    H.real = h("div", { hidden: true }, H.balrow, H.sub, H.chartwrap, H.ranges, H.screen, H.last, H.botsHead, H.carousel,
      secHead("Activity", "See all", () => setTab("activity")), H.actList);
    root.append(nav, offlineRow(), H.sbox, H.skel, H.real);
  }
  function markRanges() { H.ranges.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.r === S.range)); }

  function renderHome() {
    const st = S.st; if (!st) return;
    H.skel.hidden = true; H.real.hidden = false;
    const balText = U.fmtUsd(st.balance);
    H.balEl.style.fontSize = U.balanceFont(balText, Math.min(window.innerWidth, 560) - 32 - (st.mode === "PAPER" ? 78 : 0)) + "px";
    H.bal.set(balText);
    H.pct.set(U.fmtPct(st.today_pct));
    H.pctEl.className = "pct odo " + (st.today_pct > 0 ? "green" : st.today_pct < 0 ? "red" : "t2");
    H.mult.set(U.fmtMult(st.multiplier));
    const m = st.market || {};
    H.market.textContent = m.label || "—"; H.market.className = "pill" + (m.mode === "RED" ? " red" : "");
    H.balrow.querySelector(".badge").hidden = st.mode !== "PAPER";
    paperBadges.forEach((b) => (b.hidden = st.mode !== "PAPER"));
    // bots carousel
    const running = (st.bots || []).filter((b) => !b.paused).length;
    H.botsHead.querySelector("h2").textContent = "Bots · " + running + " running";
    H.carousel.replaceChildren(...(st.bots || []).map(botCard));
    // activity (last 5 rows) / empty
    const rows = (st.activity || []).slice(0, 5);
    H.actList.replaceChildren(rows.length ? h("div", { class: "list" }, rows.map((a) => actRow(a))) : emptyBox("Waiting for the first trade"));
    renderLive();
    document.querySelectorAll(".bots-n").forEach((e) => (e.textContent = running));
  }

  function renderLive() {
    const st = S.st, lv = (st && st.live) || {};
    const since = (performance.now() - S.stAt) / 1000;
    const age = lv.frame_age_s == null ? null : lv.frame_age_s + (D.mode === "files" && S.st.ts ? Math.max(0, Date.now() / 1000 - S.st.ts) : since);   // files: age counts from when the desk published
    if (lv.private) { H.empty.textContent = "Paused · private"; H.empty.hidden = false; }
    else if (!lv.screen) { H.empty.textContent = "No frame yet"; H.empty.hidden = false; }
    const live = age != null && age < 5;
    H.led.className = "led" + (live ? " live" : "");
    H.tlt.textContent = lv.private ? "Paused · private" : live ? "Live · Bot's computer" : age == null ? "No frame yet" : "Last frame " + U.fmtTime(Date.now() / 1000 - age);
    const holder = lv.holder || "Idle", who = holder.split(" ")[0].toLowerCase();
    H.tr.textContent = holder; H.tr.style.color = COLOR[who] || "var(--text2)";
    // last order: "Bought X · $N · verified" + 3 small checks
    const o = lv.last_order;
    if (!o) { H.last.replaceChildren(h("span", { class: "t2" }, "No orders yet")); return; }
    const verb = o.side === "buy" ? "Bought" : "Sold";
    const amt = o.fill_usd != null ? U.fmtUsd(o.fill_usd) : o.usd != null ? U.fmtUsd(o.usd) : o.pct != null ? o.pct + "%" : "";
    const done = o.status === "done";
    const tail = done ? (o.simulated ? "simulated" : "verified") : o.status === "unverified" ? "unverified" : o.status === "failed" ? "failed" + (o.error ? " · " + o.error : "") : "working…";
    const txt = done || o.status === "unverified" ? [verb, o.symbol, amt && "· " + amt, "·", tail] : [(o.side === "buy" ? "Buy " : "Sell ") + (o.symbol || ""), "·", tail];
    const chk = (name, v) => h("span", { class: v === true ? "ok" : v === false ? "no" : "na", title: name }, h("i", {}, v === true ? "✓" : v === false ? "✕" : "–"), name);
    H.last.replaceChildren(h("span", { class: done ? "" : o.status === "unverified" ? "orange" : "t2", style: { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, txt.filter(Boolean).join(" ")),
      h("div", { class: "checks" }, chk("screen", o.checks.screen), chk("api", o.checks.api), chk("chain", o.checks.chain)));
    H.lastLink = link(o.link);
  }

  // ---- frames, double buffered so the screen never flashes
  let frameBusy = false, lastBlob = null;
  async function pollFrame() {
    if (frameBusy || !D.mode) return;
    frameBusy = true;
    try {
      const url = await D.frame();
      if (url) {
        const back = H.imgA.classList.contains("front") ? H.imgB : H.imgA, front = back === H.imgA ? H.imgB : H.imgA;
        await new Promise((res) => { back.onload = res; back.onerror = res; back.src = url; });
        back.classList.add("front"); front.classList.remove("front");
        H.empty.hidden = true;
        if (lastBlob) URL.revokeObjectURL(lastBlob);
        lastBlob = url; if (FULL.on) FULL.img.src = url;
      }
    } catch (e) { /* offline row handles it */ }
    frameBusy = false;
  }
  function frameLoop() { clearInterval(S.frameTimer); S.frameTimer = setInterval(pollFrame, D.mode === "api" ? 1000 : 15000); pollFrame(); }

  // ---- full screen: landscape allowed, pinch to zoom, "Open on FOMO"
  const FULL = { on: false, z: 1, x: 0, y: 0 };
  function openFull() {
    const f = $("full"); FULL.on = true; FULL.img = f.querySelector("img"); FULL.z = 1; FULL.x = FULL.y = 0; applyZoom();
    if (!f.querySelector(".pp")) f.append(h("div", { class: "pp" }, paperBadge()));          // every screen says PAPER
    if (lastBlob) FULL.img.src = lastBlob;
    const of = f.querySelector(".of"); const u = H.lastLink; of.hidden = !u; if (u) of.href = u;
    f.classList.add("on");
  }
  function applyZoom() { FULL.img.style.transform = `translate(-50%,-50%) translate(${FULL.x}px,${FULL.y}px) scale(${FULL.z})`; }
  function initFull() {
    const f = $("full"), pts = new Map(); let d0 = 0, z0 = 1, lx = 0, ly = 0;
    f.querySelector(".x").onclick = () => { f.classList.remove("on"); FULL.on = false; };
    f.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, e); if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); z0 = FULL.z; } lx = e.clientX; ly = e.clientY; });
    f.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; FULL.z = Math.min(6, Math.max(1, z0 * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / d0)); }
      else if (FULL.z > 1) { FULL.x += e.clientX - lx; FULL.y += e.clientY - ly; }
      lx = e.clientX; ly = e.clientY; applyZoom();
    });
    const up = (e) => { pts.delete(e.pointerId); if (FULL.z <= 1.02) { FULL.z = 1; FULL.x = FULL.y = 0; applyZoom(); } };
    f.addEventListener("pointerup", up); f.addEventListener("pointercancel", up);
    f.addEventListener("wheel", (e) => { e.preventDefault(); FULL.z = Math.min(6, Math.max(1, FULL.z * (e.deltaY < 0 ? 1.1 : 0.9))); applyZoom(); }, { passive: false });
    f.addEventListener("dblclick", () => { FULL.z = 1; FULL.x = FULL.y = 0; applyZoom(); });
  }

  // ---- bot cards (carousel)
  function botCard(c) {
    const col = COLOR[c.key] || "#fff";
    const head = h("div", { class: "bhead" }, h("span", { class: "bdot", style: { background: col } }), h("span", {}, c.name),
      h("span", { class: "bstat", style: { color: col } }, c.paused ? "Paused" : c.status));
    let body;
    if (c.key === "scanner") {
      body = h("div", { class: "feed" }, (c.feed || []).length ? c.feed.map((f) => f.struck
        ? h("div", { class: "r k" }, h("span", { class: "sym" }, f.symbol), h("span", { class: "why" }, f.reason || ""))
        : h("div", { class: "r p" }, h("b", {}, f.symbol), h("span", { class: "go" }, "→ Analyst"))) : h("div", { class: "t3" }, "No pools yet tonight"));
    } else if (c.key === "analyst") {
      const l = c.last, cv = h("canvas", { class: "ring", width: 56, height: 56 });
      body = h("div", { class: "analyst" }, cv, h("div", {}, h("div", { class: "small" }, l ? l.symbol : "Nothing taken apart yet"),
        l ? h("div", { class: "small", style: { color: "var(--yellow)" } }, "Social " + (l.social_pts ? (l.social_pts > 0 ? "+" : "") + Math.round(l.social_pts) : "+0")) : null,
        h("div", { class: "strips", style: { marginTop: "6px" } }, (l ? l.strips : Array(8).fill(null)).map((s) => h("i", { class: s === true ? "y" : s === false ? "n" : "" })))));
      requestAnimationFrame(() => Ch.drawRing(cv, l ? l.score : null, c.ring_green_from || 70));
    } else if (c.key === "brain") {
      const l = c.last;
      body = h("div", {}, h("div", { class: "big" }, l && l.text ? l.text : "—"), l && l.cap_text ? h("div", { class: "small" }, l.cap_text) : null, h("div", { class: "small", style: { marginTop: "8px", lineHeight: 1.5 } }, (c.legend || []).map((t) => h("div", {}, t))));
    } else if (c.key === "executor") {
      body = h("div", {}, h("div", { class: "bar" + (String(c.bar).startsWith("✓") ? " ok" : "") }, c.bar || "Idle"), c.waiting ? h("div", { class: "small", style: { marginTop: "8px" } }, c.waiting + " waiting") : null);
    } else {
      body = h("div", {}, h("div", { class: "pills" }, (c.pills || []).map((p) => h("span", { class: "pill mono " + (p.tone === "red" ? "red" : "green") }, p.label))),
        h("div", { class: "small", style: { marginTop: "10px" } }, c.count ? c.count + " open position" + (c.count > 1 ? "s" : "") : "No open positions"));
    }
    return h("div", { class: "bcard", role: "button", tabindex: 0, onclick: () => setTab("bots") }, head, body);
  }

  // ============================================================ chart loading
  async function loadChart() {
    if (!D.mode) return;
    try {
      const c = await D.chart(S.range);
      const first = S.firstChart; S.firstChart = false; S.chart = c;
      H.line.set(c, !first);
    } catch (e) { if (e.status === 401) rejected(); }
  }
  function onBalanceEvent(d) {                                        // SSE: a new point slides in
    if (!S.chart || d.value == null) return;
    const pts = S.chart.points, ms = Math.round(d.ts * 1000);
    if (!pts.length || ms > pts[pts.length - 1][0]) { pts.push([ms, d.value]); H.line.set(Object.assign({}, S.chart, { points: pts }), true); }
    if (S.st) { S.st.balance = d.value; S.st.equity_usd = d.value; renderBalanceOnly(); }
  }
  function renderBalanceOnly() { if (H.bal && S.st) H.bal.set(U.fmtUsd(S.st.balance)); }

  // ============================================================ polling (+ offline row)
  async function tick() {
    clearTimeout(S.tickT);
    let wait = D.mode === "api" ? 5000 : 15000;
    try {
      const st = await D.state();
      S.st = st; S.stAt = performance.now(); S.fails = 0; S.down = false; S.lastOk = Date.now();
      S.stale = D.mode === "files" && st.ts && Date.now() / 1000 - st.ts > 90;      // plan B: the desk stopped publishing
      renderOffline(); renderHome(); renderAvatar(); renderTabsFromState();
      loadChart();
      if (!S.orders.length || S.tickN++ % 3 === 0) loadOrders();
    } catch (e) {
      if (e.status === 401) return rejected();
      S.fails++; S.down = true; wait = Math.min(30000, 5000 * S.fails); S.retry = Math.round(wait / 1000); renderOffline();
    }
    S.tickT = setTimeout(tick, wait);
  }
  S.tickN = 0;
  function renderOffline() {
    const txt = S.stale && !S.down ? "Desk is not publishing · last update " + U.fmtTime(S.st.ts) : S.down ? "Desk offline · retrying in " + Math.max(0, S.retry) + "s · last update " + (S.lastOk ? U.fmtTime(S.lastOk) : "—") : "";
    offlineEls.forEach((e) => { e.textContent = txt; e.classList.toggle("on", !!txt); });
  }
  setInterval(() => { if (S.down && S.retry > 0) { S.retry--; renderOffline(); } if (S.st) renderLive(); }, 1000);
  function rejected() { D.forget(); clearTimeout(S.tickT); showPaste("The desk rejected this link. Paste a fresh one."); }

  async function loadOrders() {
    try { const o = await D.orders(); S.orders = o.rows || []; renderBell(); } catch (e) { /* offline row */ }
  }
  function alerts() {
    const out = S.orders.filter((o) => o.status === "unverified").map((o) => ({ t: "Unverified: " + (o.symbol || "?") + ", check FOMO", s: (o.error || "").slice(0, 120), mint: o.mint, link: o.link }));
    (S.st && S.st.bots || []).filter((b) => b.paused).forEach((b) => out.push({ t: b.name + " is paused", s: "Tap Bots to resume" }));
    return out;
  }
  function renderBell() { if (H.dot) H.dot.hidden = alerts().length === 0; }
  function openBell() {
    const a = alerts();
    openSheet(h("div", {}, h("h3", {}, "Alerts"), a.length ? h("div", { class: "list", style: { marginTop: "12px" } }, a.map((x) => h("div", { class: "row", onclick: () => { closeSheet(); x.mint && pushCoin(x.mint); } },
      h("div", { class: "mid" }, h("div", { class: "t" }, x.t), h("div", { class: "s" }, x.s || "")), link(x.link) ? h("a", { class: "ext", href: link(x.link), target: "_blank", rel: "noopener", onclick: (e) => e.stopPropagation() }, ico(ICON.ext)) : null)))
      : h("p", { class: "t2" }, "Nothing needs you.")));
  }
  function renderAvatar() {
    if (!S.acct) return;
    const hd = S.acct.fomo_handle || "?";
    H.av.firstChild.textContent = hd[0].toUpperCase();
  }
  function renderTabsFromState() { if (S.tab === "bots") renderBots(); }

  // ============================================================ search (name, symbol or mint)
  function toggleSearch() { H.sbox.classList.toggle("on"); if (H.sbox.classList.contains("on")) H.sin.focus(); else { H.sin.value = ""; H.sres.replaceChildren(); } }
  function knownCoins() {
    const m = new Map();
    const add = (mint, symbol, name) => { if (mint && !m.has(mint)) m.set(mint, { mint, symbol, name }); };
    ((S.st && S.st.positions) || []).forEach((p) => add(p.mint, p.symbol));
    ((S.st && S.st.activity) || []).concat(S.act.rows).forEach((a) => add(a.mint, a.symbol, a.title));
    ((S.st && S.st.bots) || []).forEach((b) => (b.feed || []).forEach((f) => add(f.mint, f.symbol)));
    return [...m.values()];
  }
  function runSearch() {
    const q = H.sin.value.trim(), ql = q.toLowerCase(); let rows = [];
    if (U.isMint(q)) rows.push({ mint: q, symbol: U.shortMint(q), name: "Open this mint" });
    else if (ql) rows = knownCoins().filter((c) => (c.symbol || "").toLowerCase().includes(ql) || (c.name || "").toLowerCase().includes(ql) || c.mint.toLowerCase().startsWith(ql));
    H.sres.replaceChildren(!ql ? "" : rows.length ? h("div", { class: "list" }, rows.slice(0, 8).map((c) => h("div", { class: "row", role: "button", onclick: () => { toggleSearch(); pushCoin(c.mint); } },
      h("div", { class: "ic" }, ((c.symbol || "?")[0] || "?").toUpperCase()), h("div", { class: "mid" }, h("div", { class: "t" }, c.symbol || U.shortMint(c.mint)), h("div", { class: "s" }, c.name || U.shortMint(c.mint)))))) : emptyBox("No coin like that tonight. Paste a mint to open it."));
  }

  // ============================================================ ACTIVITY tab
  const A = {};
  function buildActivity() {
    const root = $("v-activity");
    A.list = h("div", {}); A.more = h("button", { class: "more-btn", hidden: true, onclick: () => loadActivity(true) }, "Load more");
    root.append(h("div", { class: "pad-top" }), h("div", { class: "largetitle" }, "Activity"), offlineRow(), A.list, A.more);
  }
  async function loadActivity(more) {
    try {
      const p = await D.activity(more ? S.act.next : null);
      S.act.rows = more ? S.act.rows.concat(p.rows) : p.rows; S.act.next = D.canAct() ? p.next_before : null; S.act.loaded = true; renderActivity();
    } catch (e) { if (e.status === 401) rejected(); }
  }
  function renderActivity() {
    if (!S.act.loaded) { A.list.replaceChildren(skel(60), h("div", { style: { height: "8px" } }), skel(60), h("div", { style: { height: "8px" } }), skel(60)); return; }
    A.list.replaceChildren(S.act.rows.length ? h("div", { class: "list" }, S.act.rows.map((a) => actRow(a))) : emptyBox("Nothing yet tonight"));
    A.more.hidden = !S.act.next;
  }

  // ============================================================ BOTS tab
  const B = {};
  function buildBots() {
    const root = $("v-bots");
    B.list = h("div", {});
    root.append(h("div", { class: "pad-top" }), h("div", { class: "largetitle" }, "Bots"), offlineRow(), B.list);
  }
  function renderBots() {
    const bots = (S.st && S.st.bots) || [];
    if (!bots.length) { B.list.replaceChildren(skel(220), h("div", { style: { height: "12px" } }), skel(220)); return; }
    B.list.replaceChildren(...bots.map((c) => {
      const col = COLOR[c.key], locked = c.key === "risk" && c.locked;
      const sw = h("button", { class: "switch" + (c.paused ? "" : " on"), role: "switch", "aria-checked": String(!c.paused), "aria-label": "Pause " + c.name, disabled: locked || !D.canAct(),
        onclick: () => togglePause(c) });
      const decs = (S.decs[c.key] || []);
      return h("div", { class: "botcard", id: "bot-" + c.key },
        h("div", { class: "head" }, h("span", { class: "bdot", style: { background: col } }), h("div", {}, h("div", { class: "nm" }, c.name), h("div", { class: "cnt" }, c.paused ? "Paused" : c.status)),
          h("div", { style: { flex: 1 } }), sw),
        locked ? h("div", { class: "note" }, "Locked while a position is open") : !D.canAct() ? h("div", { class: "note" }, "Pause and resume go through Telegram in plan B") : null,
        h("div", { class: "decs" }, decs.length ? decs.map(decRow) : h("div", { class: "small", style: { padding: "8px 0 12px" } }, S.decs[c.key] ? "No decisions yet tonight" : "Loading…")),
        h("button", { class: "shortcut", onclick: () => openSettings(c.key) }, h("span", {}, "Settings"), ico(ICON.chev, "chv")));
    }));
    B.list.querySelectorAll(".shortcut .chv").forEach((s) => { s.style.cssText = "width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2.2"; });
  }
  function decRow(d) {
    const ext = link(d.link) ? h("a", { class: "ext", href: link(d.link), target: "_blank", rel: "noopener", "aria-label": "Open on FOMO", onclick: (e) => e.stopPropagation() }, ico(ICON.ext)) : null;
    return h("div", { class: "row", role: "button", onclick: () => d.mint && pushCoin(d.mint) },
      h("div", { class: "mid" }, h("div", { class: "t", style: { fontSize: "15px" } }, (d.symbol ? d.symbol + " " : "") + d.text), h("div", { class: "s" }, U.fmtTime(d.ts) + " · " + d.kind)), ext);
  }
  async function loadDecisions() {
    await Promise.all(BOTS.map(async (b) => { try { S.decs[b] = (await D.decisions(b)).decisions || []; } catch (e) { if (e.status === 401) rejected(); } }));
    renderBots();
  }
  async function togglePause(c) {
    try { await D.pause(c.key, !c.paused); toast(c.name + (c.paused ? " resumed" : " paused")); await tick(); renderBots(); }
    catch (e) { toast(e.body && e.body.error ? e.body.error : "Could not change " + c.name); }
  }
  function openSettings(botKey) { setTab("account"); const g = document.getElementById("grp-" + botKey); if (g) { g.classList.add("open"); g.scrollIntoView({ block: "start" }); } }

  // ============================================================ COIN + AUDIT (pushed screens)
  const stack = [];
  function pushScreen(el, onClose) {
    const st = $("stack"); el.classList.add("pushed"); st.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
    stack.push({ el, onClose });
  }
  function popScreen() {
    const s = stack.pop(); if (!s) return;
    s.onClose && s.onClose(); s.el.classList.remove("in");
    setTimeout(() => s.el.remove(), reduce() ? 0 : 260);
  }
  function pnav(title, extra) {
    return h("div", { class: "pnav" }, h("button", { class: "back", onclick: popScreen, "aria-label": "Back" }, ico(ICON.back), h("span", {}, "Back")), h("div", { class: "ttl" }, title || ""), extra || null);
  }

  function pushCoin(mint) {
    if (!U.isMint(mint)) return;
    const cv = h("canvas", { "aria-label": "1 minute candles" }), candles = new Ch.CandleChart(cv);
    const name = h("div", { class: "cname" }, "…"), meta = h("div", { class: "t2" }, ""), chip = h("span", { class: "chip", hidden: true }), badge = paperBadge();
    badge.hidden = !(S.st && S.st.mode === "PAPER");
    const price = h("div", { class: "price" }, "—"), since = h("div", { class: "pct" }, "");
    const stats = h("div", { class: "stats" }), posbox = h("div", {}), btns = h("div", { class: "btns" }), note = h("div", { class: "note", style: { marginTop: "8px" } });
    const body = h("div", {}, h("div", { class: "chead" }, name, badge, chip), meta, price, since, h("div", { class: "cchart" }, cv), stats, posbox, btns, note,
      h("div", { class: "list", style: { marginTop: "14px" } }, h("div", { class: "row", role: "button", onclick: () => pushAudit(mint) }, h("div", { class: "mid" }, h("div", { class: "t" }, "Audit"), h("div", { class: "s" }, "8 layers")), ico(ICON.chev, "chv"))));
    const el = h("div", {}, pnav(""), offlineRow(), body); let timer = null, closed = false, data = null;
    const refresh = async () => {
      try {
        const c = await D.coin(mint); data = c;
        name.textContent = c.name || c.symbol || U.shortMint(mint);
        meta.textContent = [c.symbol, c.chain, c.age].filter(Boolean).join(" · ");
        chip.hidden = !c.shield; chip.textContent = c.shield ? "🛡 " + c.shield : ""; chip.className = "chip" + (c.shield && c.shield.split("/")[0] !== c.shield.split("/")[1] ? " bad" : "");
        price.textContent = U.fmtPrice(c.price);
        since.textContent = c.since_entry_pct == null ? "" : (c.since_entry_pct >= 0 ? "▲ " : "▼ ") + Math.abs(c.since_entry_pct).toFixed(2) + "% since entry";
        since.className = "pct " + (c.since_entry_pct >= 0 ? "green" : "red");
        candles.set(c.candles, c.exit_line);
        stats.replaceChildren(...[["Market cap", U.fmtBig(c.market_cap)], ["Liquidity", U.fmtBig(c.liquidity_usd)], ["Holders", c.holders == null ? "—" : Number(c.holders).toLocaleString("en-US")]]
          .map(([k, v]) => h("div", { class: "stat" }, h("div", { class: "k" }, k), h("div", { class: "v" }, v))));
        const p = c.position;
        posbox.replaceChildren(p && p.open ? h("div", { class: "pos" }, h("span", {}, "Your position · " + U.fmtUsd(p.size_usd) + " in · " + (p.by || "Executor")), h("span", { class: (c.since_entry_pct || 0) >= 0 ? "green" : "red" }, U.fmtUsd(p.value_usd))) : "");
        const fl = link(c.link);
        btns.replaceChildren(h("a", { class: "btn blue", href: fl || "#", target: "_blank", rel: "noopener", "aria-disabled": String(!fl) }, "Open on FOMO"),
          h("button", { class: "btn red", disabled: !(c.can_sell && D.canAct()), onclick: () => sellSheet(c) }, "Sell now"));
        note.textContent = c.can_sell && !D.canAct() ? "Selling from the app needs the live API (plan A). In plan B ask in Telegram." : "";
        el.querySelector(".chv") && (el.querySelector(".chv").style.cssText = "width:14px;height:14px;fill:none;stroke:var(--text3);stroke-width:2.2");
      } catch (e) {
        if (e.status === 401) return rejected();
        if (e.status === 404 || e.status === 400) { name.textContent = U.shortMint(mint); meta.textContent = "No data for this coin yet"; }
        else { S.down = true; renderOffline(); }
      }
      if (!closed) timer = setTimeout(refresh, D.mode === "api" ? 5000 : 15000);
    };
    pushScreen(el, () => { closed = true; clearTimeout(timer); });
    refresh();
  }

  function sellSheet(c) {
    let pct = 100; const confirm = h("button", { class: "btn red", style: { width: "100%" }, onclick: async () => {
      confirm.disabled = true;
      try { await D.sell(c.mint, pct); closeSheet(); toast("Sell " + pct + "% queued · Executor clicks it"); }
      catch (e) { err.textContent = (e.body && e.body.error) || "Could not queue the sell"; confirm.disabled = false; }
    } }, "Confirm sell");
    const err = h("div", { class: "errtxt" });
    const opts = h("div", { class: "opts" }, c.sell_pcts.map((p) => h("button", { class: p === pct ? "on" : "", onclick: (e) => { pct = p; opts.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); } }, p + "%")));
    openSheet(h("div", {}, h("h3", {}, "Sell " + (c.symbol || "")), h("div", { class: "t2" }, "The Executor clicks it on FOMO and verifies the fill."), opts, err, confirm));
  }

  function pushAudit(mint) {
    if (!U.isMint(mint)) return;
    const stage = h("div", { class: "audit-stage" }), list = h("div", { class: "list" }), social = h("div", { class: "kvl", style: { marginTop: "12px" } });
    const el = h("div", {}, pnav("Audit"), offlineRow(), stage, list, social); let ast = null;
    pushScreen(el, () => ast && ast.stop());
    (async () => {
      try {
        const a = await D.audit(mint);
        const cv = h("canvas"); stage.replaceChildren(cv);
        const rows = a.layers.map((l) => h("div", { class: "lrow" }, h("div", { class: "n" }, String(l.n)), h("div", { class: "nm" }, l.name || "Layer " + l.n), h("div", { class: "val" }, l.value || "—")));
        list.replaceChildren(...rows);
        social.replaceChildren(h("div", { class: "kv" }, h("span", {}, a.social_line)));
        ast = new Ch.AuditStage(cv, a.symbol, a.layers);
        ast.onReveal = (i) => { const r = rows[i]; if (!r) return; r.classList.add("shown"); const n = r.firstChild, l = a.layers[i]; n.classList.add(l.pass === true ? "y" : l.pass === false ? "x" : "z"); n.textContent = l.pass === true ? "✓" : l.pass === false ? "✕" : "–"; };
        ast.draw(); ast.run();
      } catch (e) {
        if (e.status === 401) return rejected();
        stage.replaceChildren(emptyBox(e.status === 404 ? "No audit stored for this coin" : "Could not load the audit"));
      }
    })();
  }

  // ============================================================ ACCOUNT tab
  const ACC = {};
  const GROUPS = ["scanner", "analyst", "brain", "executor", "risk", "social", "regime", "vault", "picks", "repos", "desk"];
  const pretty = (s) => s.replace(/_/g, " ");
  function buildAccount() {
    const root = $("v-account");
    ACC.body = h("div", {});
    root.append(h("div", { class: "pad-top" }), h("div", { class: "largetitle" }, "Account"), offlineRow(), ACC.body);
  }
  async function loadAccount(force) {
    if (!force && ACC.body.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
    try { S.acct = await D.account(); renderAvatar(); renderAccount(); } catch (e) { if (e.status === 401) rejected(); }
  }
  function renderAccount() {
    const a = S.acct; if (!a) { ACC.body.replaceChildren(skel(120), h("div", { style: { height: "12px" } }), skel(220)); return; }
    const open = new Set([...ACC.body.querySelectorAll(".grp.open")].map((e) => e.id));
    const can = D.canAct();
    const modeSeg = h("div", { class: "seg", style: { width: "160px" } }, ["PAPER", "LIVE"].map((m) => h("button", { class: a.mode === m ? "on" : "", disabled: !can, onclick: () => (m === "LIVE" ? liveSheet() : switchPaper()) }, m)));
    const cashIn = h("input", { class: "num-in", inputmode: "decimal", value: a.cash == null ? "" : String(a.cash), disabled: !can || a.mode !== "PAPER", "aria-label": "Cash",
      onchange: () => saveSetting("desk.paper_start_cash", Number(cashIn.value), cashIn) });
    const share = async () => {
      const u = a.invite_url; if (!u) return;
      try { if (navigator.share) { await navigator.share({ url: u }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(u); toast("Link copied"); } catch (e) { toast("Could not copy the link"); }
    };
    const kv = (l, r, extra) => h("div", { class: "kv", role: extra ? "button" : null, onclick: extra }, h("span", {}, l), r);
    const pushes = a.pushes || {};
    const sections = [
      h("div", { class: "kvl" }, kv("Mode", modeSeg), kv("Cash", cashIn)),
      !can ? h("div", { class: "note" }, "Read only: plan B files. Changes go through Telegram.") : null,
      h("div", { class: "kvl" }, link(a.profile_url) ? h("a", { class: "kv", href: link(a.profile_url), target: "_blank", rel: "noopener", style: { color: "#fff" } }, h("span", {}, "Your FOMO profile"), h("span", { class: "t2" }, a.fomo_handle || "")) : null,
        kv("Invite a friend", h("span", { class: "blue", style: { color: "var(--blue)" } }, "Share"), share)),
      h("div", { class: "kvl" }, kv("Pushes", h("span", { class: pushes.telegram ? "green" : "t2" }, pushes.telegram ? "connected" : "not connected")),
        h("div", { class: "kv" }, h("span", { class: "small" }, pushes.note || "Plan B: Telegram only")),
        kv("Send test push", h("span", { style: { color: "var(--blue)" } }, "Send"), async () => {
          if (!pushes.telegram) return toast("Not connected: send /start to the Telegram bot first");
          if (!can) return toast("Test push needs the live API (plan A)");
          try { await D.testPush(); toast("Test push sent"); } catch (e) { toast((e.body && (e.body.reason || e.body.error)) || "Could not send the test push"); }
        }),
        canWebPush(a) ? kv("Enable notifications", h("span", { style: { color: "var(--blue)" } }, "Enable"), () => enablePush(a)) : null),
      h("div", { class: "kvl" }, kv("Copy picks", h("div", { class: "seg", style: { width: "190px" } }, ["off", "24h", "12h", "6h"].map((x) => h("button", { class: (a.copy_picks && a.copy_picks.every) === x ? "on" : "", disabled: !can, onclick: can ? () => saveSetting("picks.every", x) : undefined }, x)))),
        (a.copy_picks && a.copy_picks.every && a.copy_picks.every !== "off") ? kv("At", h("input", { class: "txt-in", type: "time", value: (a.copy_picks.time || "21:30"), disabled: !can, "aria-label": "Copy picks time", onchange: (e) => saveSetting("picks.time", e.target.value) })) : null,
        h("div", { class: "kv" }, h("span", { class: "small" }, (a.copy_picks && a.copy_picks.note) || ""))),
      ...copyPickCards(a.copy_picks || {}, can),
      h("div", { class: "kvl" }, kv("Vault", h("div", { class: "seg", style: { width: "190px" } }, ["plugin", "files"].map((x) => h("button", { class: (a.vault && a.vault.mode) === x ? "on" : "", disabled: true }, x)))),
        h("div", { class: "kv" }, h("span", { class: "small" }, (a.vault && a.vault.note) || ""))),
      h("div", { class: "kvl" }, kv("Social", h("span", { class: (a.social && a.social.plan === "C") ? "t2" : "" }, (a.social && a.social.line) || "Social: off"))),
      (a.pending && a.pending.length) ? h("div", { class: "kvl" }, h("div", { class: "kv" }, h("span", { class: "small" }, "Pending (secret card, not asked this step): " + a.pending.map((p) => p.what).join(", ") + "."))) : null,
      h("div", { class: "kvl" }, kv("Watch in Grok Bot", h("span", { class: "t2" }, a.watch_url ? "Open" : "Link not set"), a.watch_url && link(a.watch_url) ? () => window.open(link(a.watch_url), "_blank", "noopener") : null)),
      ...proposalCards(a.proposals || [], can),
      h("div", { class: "sec", style: { margin: "20px 0 10px" } }, h("h2", {}, "Settings")),
      ...settingGroups(a.settings || {}, can),
      h("button", { class: "more-btn", style: { color: "var(--red)" }, onclick: () => { D.forget(); location.reload(); } }, "Forget this desk link"),
    ];
    ACC.body.replaceChildren(...sections.filter(Boolean));
    open.forEach((id) => { const g = document.getElementById(id); g && g.classList.add("open"); });
  }

  function copyPickCards(cp, can) {
    const rows = cp.latest || [];
    const history = (cp.history || []).slice(1); // latest is already shown; the last 7 lists sit under it
    const card = (r) => h("div", { class: "card", style: { background: "#1c1c1e", padding: "14px 16px", margin: "8px 0", borderRadius: "16px" } },
      h("div", { style: { fontWeight: 650 } }, "#" + r.rank + " " + r.handle),
      h("div", { style: { margin: "6px 0", display: "flex", gap: "12px" } },
        h("span", { class: "green" }, "7d " + (r.pnl_7d_text || "")),
        h("span", { class: "green" }, "30d " + (r.pnl_30d_text || ""))),
      r.last_buy_url ? h("a", { class: "small", href: r.last_buy_url, target: "_blank", rel: "noopener" }, "last buy: " + (r.last_buy_symbol || "coin") + " at " + (r.last_buy_mcap_text || "?")) : h("div", { class: "small t2" }, "last buy: unknown"),
      r.why ? h("div", { class: "small t2", style: { marginTop: "4px" } }, r.why) : null,
      h("div", { style: { display: "flex", gap: "8px", marginTop: "10px", alignItems: "center" } },
        r.profile_url ? h("a", { class: "btn", href: r.profile_url, target: "_blank", rel: "noopener" }, "Profile") : null,
        kv("Copy on desk", h("div", { class: "seg", style: { width: "90px" } }, ["off", "on"].map((x) => h("button", {
          class: (r.copy_on ? "on" : "off") === x || (r.copy_on && x === "on") || (!r.copy_on && x === "off") ? "on" : "",
          disabled: !can,
          onclick: can ? async () => {
            try {
              const res = await D.setCopy(r.handle, x === "on");
              if (res && res.copy_picks && S.acct) S.acct.copy_picks = res.copy_picks;
              else if (S.acct && S.acct.copy_picks && S.acct.copy_picks.latest) {
                S.acct.copy_picks.latest = S.acct.copy_picks.latest.map((t) => t.handle === r.handle ? Object.assign({}, t, { copy_on: x === "on" }) : t);
              }
              toast(x === "on" ? "Copy on desk: " + r.handle : "Copy off: " + r.handle);
              tick();
            } catch (e) { toast((e.body && e.body.error) || "Max 2 traders on copy at a time"); }
          } : undefined
        }, x))))));
    const out = [];
    if (rows.length) out.push(h("div", { class: "sec", style: { margin: "8px 0 0" } }, h("h2", {}, "Today")), ...rows.map(card));
    if (history.length) {
      out.push(h("div", { class: "sec", style: { margin: "16px 0 6px" } }, h("h2", {}, "Last 7 lists")));
      history.forEach((L) => {
        const when = L.ts ? new Date(L.ts * 1000).toLocaleString() : "";
        out.push(h("div", { class: "small t2", style: { margin: "8px 0 0" } }, when), ...(L.rows || []).map((r) => h("div", { class: "small", style: { padding: "4px 0" } }, "#" + r.rank + " " + r.handle + " · 7d " + (r.pnl_7d_text || "") + " · 30d " + (r.pnl_30d_text || ""))));
      });
    }
    return out;
  }

  // STEP 14: the weekly review suggests at most 3 changes. Nothing changes until you tap Approve (change_log, who = me).
  function proposalCards(list, can) {
    if (!list.length) return [];
    const nums = (n) => (typeof n === "string" ? n : Array.isArray(n) ? n.join(" · ") : Object.entries(n || {}).map(([k, v]) => pretty(k) + " " + v).join(" · "));
    const act = async (p, approve) => {
      try { const r = await D.resolveProposal(p.id, approve); if (S.acct) S.acct.settings = r.groups; toast(approve ? "Approved and saved" : "Dismissed"); await loadAccount(true); tick(); }
      catch (e) { toast((e.body && e.body.error) || "Could not do that"); await loadAccount(true); }
    };
    return [h("div", { class: "sec", style: { margin: "20px 0 10px" } }, h("h2", {}, "Weekly review")),
      h("div", { class: "kvl", id: "proposals" }, list.map((p) => h("div", { class: "kv", style: { display: "block", padding: "14px 16px" } },
        h("div", { style: { fontWeight: 600 } }, pretty(p.key.split(".")[1]) + " · " + p.key.split(".")[0] + ": " + p.old + " → " + p.new),
        h("div", { class: "small", style: { margin: "4px 0" } }, p.why), h("div", { class: "small t2" }, nums(p.numbers)),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } },
          h("button", { class: "btn blue", disabled: !can, onclick: () => act(p, true) }, "Approve"),
          h("button", { class: "btn", disabled: !can, onclick: () => act(p, false) }, "Dismiss")))))];
  }
  function settingGroups(groups, can) {
    const keys = GROUPS.filter((g) => groups[g]).concat(Object.keys(groups).filter((g) => !GROUPS.includes(g)));
    return keys.map((g) => {
      const gb = h("div", { class: "gb" }, groups[g].map((s) => settingRow(s, can)));
      const grp = h("div", { class: "grp", id: "grp-" + g }, h("button", { class: "gh", onclick: () => grp.classList.toggle("open") }, h("span", {}, g[0].toUpperCase() + g.slice(1)), ico(ICON.chev)), gb);
      return grp;
    });
  }
  function settingRow(s, can) {
    const err = h("div", { class: "errtxt", hidden: true });
    const dis = !can || s.editable === false;
    let input;
    const wrap = h("div", { class: "set" });
    if (s.type === "enum" && s.choices) {
      const seg = h("div", { class: "seg", style: { width: "min(100%, 240px)" } }, s.choices.map((x) => h("button", { class: String(s.value) === String(x) ? "on" : "", disabled: dis, onclick: () => saveSetting(s.key, x, null, err) }, x)));
      wrap.append(h("div", { class: "l" }, h("span", { class: "nm" }, pretty(s.name)), seg), h("div", { class: "d" }, s.desc), err);
    } else if (s.type === "int" || s.type === "float") {
      const span = (s.max - s.min) || 1, step = s.type === "int" ? 1 : Math.pow(10, Math.floor(Math.log10(span / 200)));
      const num = h("input", { class: "num-in", inputmode: "decimal", value: String(s.value), disabled: dis, "aria-label": s.name });
      const rng = h("input", { type: "range", min: s.min, max: s.max, step, value: s.value, disabled: dis, "aria-label": s.name + " slider" });
      rng.oninput = () => { num.value = rng.value; };
      rng.onchange = () => saveSetting(s.key, Number(rng.value), rng, err, num);
      num.onchange = () => { rng.value = num.value; saveSetting(s.key, Number(num.value), num, err, rng); };
      wrap.append(h("div", { class: "l" }, h("span", { class: "nm" }, pretty(s.name)), num), h("div", { class: "d" }, s.desc), rng, err);
    } else if (s.type === "bool") {
      const sw = h("button", { class: "switch" + (s.value ? " on" : ""), role: "switch", disabled: dis, onclick: () => saveSetting(s.key, !sw.classList.contains("on"), sw, err) });
      wrap.append(h("div", { class: "l" }, h("span", { class: "nm" }, pretty(s.name)), sw), h("div", { class: "d" }, s.desc), err);
    } else {
      const masked = typeof s.value === "string" && (s.value.includes("…") || s.value.startsWith("set ·") || s.value === "set");
      input = h("input", { class: "txt-in", value: masked ? "" : (s.value == null ? "" : String(s.value)), placeholder: masked ? s.value + " · type a new value" : "", disabled: dis, autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": s.name });
      input.onchange = () => input.value && saveSetting(s.key, input.value, input, err);
      wrap.append(h("div", { class: "l" }, h("span", { class: "nm" }, pretty(s.name))), h("div", { class: "d" }, s.desc), input, err);
    }
    return wrap;
  }
  async function saveSetting(key, value, el, errEl, peer) {
    if (errEl) errEl.hidden = true;
    try {
      const r = await D.saveSettings({ [key]: value });
      if (S.acct) { S.acct.settings = r.groups; if (key === "desk.paper_start_cash") S.acct.cash = value; }
      toast("Saved"); tick();
    } catch (e) {
      const msg = (e.body && e.body.error) || "Not saved";
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; } else toast(msg);
      await loadAccount(true);
    }
  }
  function switchPaper() { D.setMode("PAPER").then(() => { toast("PAPER"); loadAccount(true); tick(); }).catch((e) => toast((e.body && e.body.error) || "Could not switch")); }
  function liveSheet() {
    const a = S.acct || {}, lv = a.live || {};
    const inp = h("input", { class: "big-in", placeholder: "Type LIVE", autocapitalize: "characters", autocomplete: "off" }), err = h("div", { class: "errtxt", style: { textAlign: "center", minHeight: "20px" } });
    const go = h("button", { class: "btn red", style: { width: "100%" }, onclick: async () => {
      try { await D.setMode("LIVE", inp.value.trim()); closeSheet(); toast("LIVE"); tick(); loadAccount(true); } catch (e) { err.textContent = (e.body && e.body.error) || "Could not switch to LIVE"; }
    } }, "Switch to LIVE");
    const need = lv.needs && lv.needs.length ? h("div", { class: "small", style: { margin: "8px 0" } }, "Still needed: " + lv.needs.join("; ") + ".") : null;
    // the one-line warning sits right above the LIVE field (STEP 13)
    openSheet(h("div", {}, h("h3", {}, "Switch to LIVE"), h("p", { class: "t2 livewarn" }, lv.warning || "LIVE trades real cash on FOMO. New coins can go to 0 in minutes. Only put in what you can lose."), need, inp, err, go));
  }
  function canWebPush(a) { return !!(a && a.vapid_public && window.matchMedia("(display-mode: standalone)").matches && "PushManager" in window); }
  async function enablePush(a) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") return toast("Notifications are off");
      const pad = "=".repeat((4 - (a.vapid_public.length % 4)) % 4), raw = atob((a.vapid_public + pad).replace(/-/g, "+").replace(/_/g, "/"));
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
      const j = sub.toJSON(); await D.pushSub({ endpoint: j.endpoint, keys: j.keys }); toast("Notifications on"); loadAccount(true);
    } catch (e) { toast("Could not enable notifications"); }
  }

  // ============================================================ tabs / shell
  function setTab(t) {
    S.tab = t;
    document.querySelectorAll(".tabview").forEach((v) => v.classList.toggle("on", v.id === "v-" + t));
    document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    while (stack.length) popScreen();
    if (t === "activity") loadActivity(false);
    if (t === "bots") { renderBots(); loadDecisions(); }
    if (t === "account") loadAccount(false);
    if (t === "home") { renderHome(); requestAnimationFrame(() => H.line.draw()); }
  }
  function buildShell() {
    const tabs = [["home", "Home", ICON.home], ["bots", "Bots", ICON.bots], ["activity", "Activity", ICON.act], ["account", "Account", ICON.acct]];
    $("tabbar").replaceChildren(...tabs.map(([k, label, d]) => h("button", { "data-t": k, onclick: () => setTab(k), "aria-label": label }, ico(d), h("span", {}, label))));
    $("scrim").onclick = closeSheet;
    $("paste-go").onclick = submitPaste; $("paste-in").addEventListener("keydown", (e) => e.key === "Enter" && submitPaste());
    buildHome(); buildBots(); buildActivity(); buildAccount(); initFull();
    renderBots(); renderActivity(); renderAccount();
    window.addEventListener("resize", () => { H.line.draw(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && D.mode) tick(); });
  }

  function boot() {
    D.adoptHash();
    D.load();
    buildShell();
    if (!D.mode) { showPaste(); return; }
    setTab("home");
    tick(); frameLoop(); loadAccount(true); loadActivity(false);
    D.stream((ev, d) => { if (ev === "balance") onBalanceEvent(d); else { clearTimeout(S.evT); S.evT = setTimeout(() => { tick(); if (S.tab === "activity") loadActivity(false); }, 700); } });
    // deep links for tests / screenshots only: ?v=bots | activity | account | coin:<mint> | audit:<mint> | bell, &range=1H
    const q = new URLSearchParams(location.search), v = q.get("v");
    if (q.get("range") && RANGES.includes(q.get("range"))) { S.range = q.get("range"); markRanges(); }
    if (v) setTimeout(() => { if (["bots", "activity", "account"].includes(v)) setTab(v); else if (v === "bell") openBell(); else if (v.startsWith("coin:")) pushCoin(v.slice(5)); else if (v.startsWith("audit:")) pushAudit(v.slice(6)); }, 400);
    if (q.get("open")) { setTab("account"); setTimeout(() => { const g = document.getElementById("grp-" + q.get("open")); if (g) { g.classList.add("open"); g.scrollIntoView({ block: "start" }); } }, 1500); }
  }
  boot();
  window.__desk = { S, H, setTab, pushCoin, pushAudit };   // debugging handle: holds no secret (the token stays inside api.js / localStorage)
})();
