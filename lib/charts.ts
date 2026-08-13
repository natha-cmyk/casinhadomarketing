// Gráficos SVG portados VERBATIM do blueprint (linhas 768-801). Retornam string SVG
// com data-meta (tooltip interativo lido por components/ChartTooltips).
import { sum, kfmt, fmt, pct } from "./format";

export interface LineSeries {
  name?: string;
  color: string;
  data: number[];
  fill?: boolean;
  dash?: boolean;
}
export interface ChartOpts {
  w?: number;
  h?: number;
  sel?: number;
  name?: string;
  vfmt?: "num" | "pct";
}

export function lineChart(labels: string[], series: LineSeries[], opts: ChartOpts = {}): string {
  const W = opts.w || 720, H = opts.h || 240, pl = 44, pr = 14, pt = 16, pb = 28, iw = W - pl - pr, ih = H - pt - pb;
  const all = series.flatMap((s) => s.data.filter((v) => v != null));
  const max = Math.max(1, ...all) * 1.12;
  const n = labels.length;
  const x = (i: number) => (n <= 1 ? pl + iw / 2 : pl + (iw * i) / (n - 1));
  const y = (v: number) => pt + ih - (v / max) * ih;
  const sel = opts.sel ?? -1;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => {
      const gy = pt + ih - ih * t;
      return `<line x1="${pl}" y1="${gy}" x2="${W - pr}" y2="${gy}" stroke="rgba(0,0,0,.06)"/><text x="${pl - 8}" y="${gy + 3.5}" text-anchor="end" font-size="10" fill="#9A9AA0">${kfmt(Math.round(max * t))}</text>`;
    })
    .join("");
  const xlab = labels
    .map(
      (l, i) =>
        `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="${i === sel ? "#121111" : "#6E6E73"}" font-weight="${i === sel ? 700 : 400}">${l}</text>`
    )
    .join("");
  const paths = series
    .map((s) => {
      const pts = s.data.map((v, i) => [x(i), y(v || 0)]);
      const d = "M" + pts.map((p) => p.join(",")).join(" L");
      const dots =
        n <= 6 && !s.dash
          ? s.data
              .map(
                (v, i) =>
                  `<circle cx="${x(i)}" cy="${y(v || 0)}" r="${i === sel ? 4.5 : 3}" fill="#fff" stroke="${s.color}" stroke-width="${i === sel ? 3 : 2}"/>`
              )
              .join("")
          : "";
      return `${s.fill && !s.dash ? `<path d="${d} L${x(n - 1)},${pt + ih} L${x(0)},${pt + ih} Z" fill="${s.color}" opacity=".10"/>` : ""}<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.dash ? 2 : 2.4}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 5" opacity=".7"' : ""}/>${dots}`;
    })
    .join("");
  const selMark =
    sel >= 0 && series[0]
      ? `<line x1="${x(sel)}" y1="${pt}" x2="${x(sel)}" y2="${pt + ih}" stroke="rgba(0,0,0,.14)" stroke-dasharray="3 3"/>`
      : "";
  const meta = {
    type: "line", pl, pr, pt, pb, W, H, max, labels,
    series: series.map((s) => ({ name: s.name || "", color: s.color, values: s.data, dash: !!s.dash })),
    vfmt: opts.vfmt || "num",
  };
  const metaStr = JSON.stringify(meta).replace(/'/g, "&#39;");
  return `<svg class="chart chartI" viewBox="0 0 ${W} ${H}" role="img" data-meta='${metaStr}'>${grid}${selMark}${paths}${xlab}</svg>`;
}

export function barChart(labels: string[], values: number[], color: string | string[], opts: ChartOpts = {}): string {
  const W = opts.w || 720, H = opts.h || 220, pl = 44, pr = 14, pt = 14, pb = 34, iw = W - pl - pr, ih = H - pt - pb, n = values.length;
  const max = Math.max(1, ...values) * 1.14, bw = Math.min(46, (iw / n) * 0.62), step = iw / n;
  const sel = opts.sel ?? -1;
  const grid = [0, 0.5, 1]
    .map((t) => {
      const gy = pt + ih - ih * t;
      return `<line x1="${pl}" y1="${gy}" x2="${W - pr}" y2="${gy}" stroke="rgba(0,0,0,.06)"/><text x="${pl - 8}" y="${gy + 3.5}" text-anchor="end" font-size="10" fill="#9A9AA0">${kfmt(Math.round(max * t))}</text>`;
    })
    .join("");
  const bars = values
    .map((v, i) => {
      const cx = pl + step * i + step / 2, bh = ((v || 0) / max) * ih, by = pt + ih - bh;
      const c = Array.isArray(color) ? color[i] : color;
      return `<rect x="${cx - bw / 2}" y="${by}" width="${bw}" height="${Math.max(bh, 1)}" rx="5" fill="${i === sel ? "#FF001E" : c}"/><text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#6E6E73">${labels[i]}</text>`;
    })
    .join("");
  const meta = {
    type: "bar", pl, pr, pt, pb, W, H, max, step, labels,
    series: [{ name: opts.name || "", color: Array.isArray(color) ? "#121111" : color, values }],
    vfmt: opts.vfmt || "num",
  };
  const metaStr = JSON.stringify(meta).replace(/'/g, "&#39;");
  return `<svg class="chart chartI" viewBox="0 0 ${W} ${H}" role="img" data-meta='${metaStr}'>${grid}${bars}</svg>`;
}

export interface PieDatum {
  v: number;
  color: string;
  label: string;
}
export function pieChart(data: PieDatum[], size = 200, centerLabel = "leads"): string {
  const r = size / 2, cx = r, cy = r, inner = r * 0.6, total = sum(data.map((d) => d.v)) || 1;
  let a0 = -Math.PI / 2;
  const arcs = data
    .filter((d) => d.v > 0)
    .map((d) => {
      const frac = d.v / total, a1 = a0 + frac * 2 * Math.PI;
      const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const ix0 = cx + inner * Math.cos(a1), iy0 = cy + inner * Math.sin(a1), ix1 = cx + inner * Math.cos(a0), iy1 = cy + inner * Math.sin(a0);
      const large = frac > 0.5 ? 1 : 0;
      a0 = a1;
      return `<path d="M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${ix0},${iy0} A${inner},${inner} 0 ${large} 0 ${ix1},${iy1} Z" fill="${d.color}" stroke="#fff" stroke-width="2"><title>${d.label}: ${fmt(d.v)} (${pct(d.v / total)})</title></path>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">${arcs}<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="23" font-weight="700" fill="#121111">${fmt(total)}</text><text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="10.5" fill="#6E6E73">${centerLabel}</text></svg>`;
}
