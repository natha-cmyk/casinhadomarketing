"use client";
// Tooltip global dos gráficos (line/bar), portado verbatim do blueprint (1892-1921).
// Um único listener em document; opera sobre qualquer svg.chartI com data-meta.
import { useEffect } from "react";

function kfmt(n: number) {
  n = Number(n) || 0;
  return Math.abs(n) >= 1000
    ? (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(n) >= 100000 ? 0 : 1 }) + "k"
    : n.toLocaleString("pt-BR");
}

export function ChartTooltips() {
  useEffect(() => {
    let tip: HTMLDivElement | null = null;
    const chartTip = () => {
      if (!tip) {
        tip = document.createElement("div");
        tip.className = "chart-tip";
        tip.style.display = "none";
        document.body.appendChild(tip);
      }
      return tip;
    };
    const hideTip = () => {
      if (tip) tip.style.display = "none";
      document.querySelectorAll("svg.chartI .hoverlay").forEach((g) => g.remove());
    };
    const onMove = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      const svg = target?.closest ? (target.closest("svg.chartI") as SVGSVGElement | null) : null;
      if (!svg) {
        if (tip && tip.style.display !== "none") hideTip();
        return;
      }
      let meta: {
        type: string; pl: number; pr: number; pt: number; pb: number; W: number; H: number; max: number;
        labels: string[]; series: { name: string; color: string; values: number[] }[]; vfmt: string;
      };
      try {
        meta = JSON.parse((svg.getAttribute("data-meta") || "").replace(/&#39;/g, "'"));
      } catch {
        return;
      }
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const P = svg.createSVGPoint();
      P.x = ev.clientX;
      P.y = ev.clientY;
      const loc = P.matrixTransform(ctm.inverse());
      const iw = meta.W - meta.pl - meta.pr, ih = meta.H - meta.pt - meta.pb, n = meta.labels.length;
      let idx = meta.type === "bar"
        ? Math.floor((loc.x - meta.pl) / (iw / n))
        : n <= 1 ? 0 : Math.round((loc.x - meta.pl) / (iw / (n - 1)));
      if (idx < 0) idx = 0;
      if (idx > n - 1) idx = n - 1;
      const xOf = (i: number) =>
        meta.type === "bar" ? meta.pl + (iw / n) * i + iw / n / 2 : n <= 1 ? meta.pl + iw / 2 : meta.pl + (iw * i) / (n - 1);
      const yOf = (v: number) => meta.pt + ih - ((v || 0) / meta.max) * ih;
      const cx = xOf(idx);
      let g = svg.querySelector(".hoverlay");
      if (!g) {
        g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("class", "hoverlay");
        svg.appendChild(g);
      }
      let mk = `<line x1="${cx}" y1="${meta.pt}" x2="${cx}" y2="${meta.pt + ih}" stroke="rgba(0,0,0,.22)" stroke-dasharray="3 3"/>`;
      if (meta.type !== "bar") {
        meta.series.forEach((s) => {
          const v = s.values[idx];
          if (v == null) return;
          mk += `<circle cx="${cx}" cy="${yOf(v)}" r="4.6" fill="#fff" stroke="${s.color}" stroke-width="3"/>`;
        });
      }
      g.innerHTML = mk;
      const fv = (v: number) =>
        v == null || isNaN(v) ? "—" : meta.vfmt === "pct" ? Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : kfmt(v);
      const rows = meta.series
        .map((s) => `<div class="ctr"><i style="background:${s.color}"></i>${s.name || ""}<b>${fv(s.values[idx])}</b></div>`)
        .join("");
      const t = chartTip();
      t.innerHTML = `<div class="cth">${meta.labels[idx]}</div>${rows}`;
      t.style.display = "block";
      const tw = t.offsetWidth, th = t.offsetHeight;
      let L = ev.clientX + 14, T = ev.clientY - th - 12;
      if (L + tw > window.innerWidth - 8) L = ev.clientX - tw - 14;
      if (T < 8) T = ev.clientY + 16;
      t.style.left = L + "px";
      t.style.top = T + "px";
    };
    document.addEventListener("mousemove", onMove, true);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      if (tip) tip.remove();
    };
  }, []);
  return null;
}
