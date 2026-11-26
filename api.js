// api.js - the data layer. Plan A: GET/POST {base}/api/* with Authorization: Bearer {token}. Plan B: polls files {base}/d/{DATA_PATH}/*.json.
// The token / data path live ONLY in this browser's localStorage (never in the repo, never in a URL after the first open).
(function (root) {
  const U = root.U;
  const LS = (typeof localStorage !== "undefined") ? localStorage : { getItem() { return null; }, setItem() {}, removeItem() {} };
  const D = { mode: null, base: "", token: null, dp: null, ok: false };

  D.load = () => {
    D.token = LS.getItem("desk_t");
    D.dp = LS.getItem("desk_d");
    D.base = LS.getItem("desk_base") || "";
    D.mode = D.token ? "api" : D.dp ? "files" : null;
    return D.mode;
  };
  D.save = (link) => {                                      // link = U.parseLink(...) result
    if (link.t) { LS.setItem("desk_t", link.t); LS.removeItem("desk_d"); }
    else { LS.setItem("desk_d", link.d); LS.removeItem("desk_t"); }
    if (link.base) LS.setItem("desk_base", link.base); else LS.removeItem("desk_base");
    return D.load();
  };
  D.forget = () => { ["desk_t", "desk_d", "desk_base"].forEach((k) => LS.removeItem(k)); D.load(); };
  // first open: {URL}#t=... or #d=... -> keep it, then scrub the fragment from the address bar
  D.adoptHash = () => {
    const l = U.parseLink(location.hash);
    if (!l) return false;
    if (!l.base) l.base = "";
    D.save(l);
    history.replaceState(null, "", location.pathname + location.search);
    return true;
  };
  D.canAct = () => D.mode === "api";

  const abs = (p) => (D.base || "") + p;
  const filePath = (p) => abs("d/" + encodeURIComponent(D.dp) + "/" + p);
  async function req(url, opt = {}) {
    const headers = Object.assign({}, opt.headers || {});
    if (D.mode === "api") headers.Authorization = "Bearer " + D.token;
    const r = await fetch(url, Object.assign({ cache: "no-store" }, opt, { headers }));
    if (r.status === 401) { const e = new Error("unauthorized"); e.status = 401; throw e; }
    return r;
  }
  async function json(url, opt) {
    const r = await req(url, opt);
    let body = null;
    try { body = await r.json(); } catch (e) { /* non-JSON */ }
    if (!r.ok) { const e = new Error((body && body.error) || "http " + r.status); e.status = r.status; e.body = body; throw e; }
    return body;
  }
  const q = (o) => Object.entries(o).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");

  D.state = () => json(D.mode === "api" ? abs("api/state") : filePath("state.json"));
  D.chart = async (range) => {
    if (D.mode === "api") return json(abs("api/chart?range=" + range));
    const all = await json(filePath("chart.json"));
    return all[range] || all.LIVE;
  };
  D.activity = (before) => json(D.mode === "api" ? abs("api/activity" + (before ? "?" + q({ before }) : "")) : filePath("activity.json"));
  D.coin = (m) => json(D.mode === "api" ? abs("api/coin/" + m) : filePath("coin/" + m + ".json"));
  D.audit = (m) => json(D.mode === "api" ? abs("api/audit/" + m) : filePath("audit/" + m + ".json"));
  D.decisions = (b) => json(D.mode === "api" ? abs("api/bots/" + b + "/decisions") : filePath("bots/" + b + ".json"));
  D.orders = () => json(D.mode === "api" ? abs("api/orders") : filePath("orders.json"));
  D.account = () => json(D.mode === "api" ? abs("api/account") : filePath("account.json"));
  D.settings = () => json(D.mode === "api" ? abs("api/settings") : filePath("settings.json"));
  const post = (path, body) => json(abs(path), { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  D.saveSettings = (changes) => post("api/settings", { changes });
  D.resolveProposal = (id, approve) => post("api/proposals/" + encodeURIComponent(id) + (approve ? "/approve" : "/dismiss"), {});
  D.pause = (b, on) => post("api/bots/" + b + (on ? "/pause" : "/resume"));
  D.setMode = (mode, confirm) => post("api/mode", confirm ? { mode, confirm } : { mode });
  D.sell = (mint, pct) => post("api/sell/" + mint, { pct, confirm: true });
  D.pushSub = (sub) => post("api/push", sub);
  D.testPush = () => post("api/push/test");
  D.setCopy = (handle, on) => post("api/picks/" + encodeURIComponent(handle) + "/copy", { on });

  // newest frame of the bot's screen: Blob URL, or null (no frame yet / private)
  D.frame = async () => {
    const url = D.mode === "api" ? abs("api/screen.jpg") : filePath("screen.jpg") + "?t=" + Date.now();
    const r = await req(url);
    if (!r.ok) return null;
    return URL.createObjectURL(await r.blob());
  };

  // Server-sent events over fetch (EventSource cannot send the Bearer header). Reconnects; stops on 401.
  D.stream = (onEvent, onState) => {
    if (D.mode !== "api") return () => {};
    let stop = false, ctl = null;
    (async function loop() {
      while (!stop) {
        try {
          ctl = new AbortController();
          const r = await fetch(abs("api/stream"), { headers: { Authorization: "Bearer " + D.token }, signal: ctl.signal, cache: "no-store" });
          if (r.status === 401) return;
          if (!r.ok || !r.body) throw new Error("stream " + r.status);
          onState && onState(true);
          const rd = r.body.getReader(), dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { value, done } = await rd.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n\n")) >= 0) {
              const block = buf.slice(0, i); buf = buf.slice(i + 2);
              let ev = "message", data = "";
              block.split("\n").forEach((ln) => { if (ln.startsWith("event:")) ev = ln.slice(6).trim(); else if (ln.startsWith("data:")) data += ln.slice(5).trim(); });
              if (data) { try { onEvent(ev, JSON.parse(data)); } catch (e) { /* ignore a bad frame */ } }
            }
          }
        } catch (e) { /* fall through to retry */ }
        onState && onState(false);
        if (!stop) await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => { stop = true; try { ctl && ctl.abort(); } catch (e) { /* ignore */ } };
  };

  root.Desk = D;
  if (typeof module !== "undefined") module.exports = D;
})(typeof window !== "undefined" ? window : globalThis);
