// odometer.js - changed digits roll 600ms ease-out, 30ms stagger. prefers-reduced-motion: no roll, values swap.
(function (root) {
  const U = root.U;
  class Odometer {
    constructor(el, opts = {}) { this.el = el; this.text = ""; this.opts = opts; el.classList.add("odo"); }
    set(text) {
      if (text === this.text) return;
      const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      const plan = U.rollPlan(this.text, text), rebuild = text.length !== this.text.length || reduce || !this.text;
      this.text = text;
      this.el.setAttribute("aria-label", text);
      if (rebuild) {
        this.el.textContent = "";
        plan.forEach((p) => this.el.appendChild(this.cell(p.ch, p.digit)));
        return;
      }
      let k = 0;
      plan.forEach((p, i) => {
        const cell = this.el.children[i];
        if (!p.changed) return;
        if (!p.digit || !cell.firstChild || !cell.firstChild.classList || !cell.firstChild.classList.contains("strip")) {
          cell.replaceWith(this.cell(p.ch, p.digit)); return;
        }
        cell.firstChild.style.transitionDelay = (k++) * 30 + "ms";               // 30ms stagger
        cell.firstChild.style.transform = "translateY(" + (-Number(p.ch) * 1.08) + "em)";
      });
    }
    cell(ch, digit) {
      const c = document.createElement("span"); c.className = "ch";
      if (!digit) { c.textContent = ch; c.style.width = ch === "," || ch === "." ? "0.3em" : ""; return c; }
      const s = document.createElement("span"); s.className = "strip";
      for (let d = 0; d < 10; d++) { const x = document.createElement("span"); x.textContent = d; s.appendChild(x); }
      s.style.transform = "translateY(" + (-Number(ch) * 1.08) + "em)";
      c.appendChild(s); return c;
    }
  }
  root.Odometer = Odometer;
})(window);
