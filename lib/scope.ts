// Contexto temporal e resolução de escopo (semana/mês/trimestre/ano).
import { sum } from "./format";

export const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
export const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
// Calendário civil do negócio (Natal/RN). Não congela no import do módulo:
// um isolate que atravessa a meia-noite continua no dia certo.
export const BUSINESS_TZ = "America/Fortaleza";

export function civilToday(now = new Date(), timeZone = BUSINESS_TZ): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: n("year"), month: n("month") - 1, day: n("day") };
}

export const curYear = (now?: Date) => civilToday(now).year;
export const curMonth = (now?: Date) => civilToday(now).month;

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}
export const quarterOf = (m: number) => Math.floor(m / 3);
export function weekRange(y: number, m: number, w: number) {
  const last = daysInMonth(y, m);
  const st = [1, 8, 15, 22];
  const en = [7, 14, 21, last];
  return st[w] + "–" + en[w];
}

export type Period = "semana" | "mes" | "trimestre" | "ano";
export interface Scope {
  period: Period;
  year: number;
  month: number;
  week: number;
  quarter: number;
}

export function scopeLabelText(cfg: Scope) {
  const { period, year, month, week, quarter } = cfg;
  if (period === "semana")
    return "W" + (week + 1) + " · " + weekRange(year, month, week) + " · " + MONTHS[month] + " " + year;
  if (period === "mes") return MONTHS_FULL[month] + " " + year;
  if (period === "trimestre") return "Q" + (quarter + 1) + " · " + year;
  return String(year);
}

type WkGetter = ((y: number, m: number, w: number) => number) | null | undefined;

// valor escalar do escopo, a partir de monthly[12] + weekly getter(y,m,w)
export function scopeVal(monthly: number[], wk: WkGetter, cfg: Scope) {
  const { period, month, year, week, quarter } = cfg;
  if (period === "semana") return wk ? wk(year, month, week) : 0;
  if (period === "mes") return monthly[month];
  if (period === "trimestre") return sum(monthly.slice(quarter * 3, quarter * 3 + 3));
  return sum(monthly);
}

// comparativos automáticos (período anterior + ano anterior), adaptável
export function autoCompare(
  getMonthly: (y: number) => number[],
  getWk: ((y: number, m: number, w: number) => number) | null,
  cfg: Scope
): [string, number, number][] {
  const { period, year, month, week, quarter } = cfg;
  const cur = scopeVal(getMonthly(year), getWk ?? null, cfg);
  const rows: [string, number, number][] = [];
  if (period === "semana") {
    let prev: number | null = null;
    if (getWk) {
      if (week > 0) prev = getWk(year, month, week - 1);
      else if (month > 0) prev = getWk(year, month - 1, 3);
      if (prev != null && prev > 0) rows.push(["semana passada", cur, prev]);
      const ya = getWk(year - 1, month, week);
      if (ya > 0) rows.push(["mesma semana, ano passado", cur, ya]);
    }
  } else if (period === "mes") {
    if (month > 0) rows.push(["mês passado", cur, getMonthly(year)[month - 1]]);
    const ya = getMonthly(year - 1)[month];
    if (ya > 0) rows.push(["mesmo mês, ano passado", cur, ya]);
  } else if (period === "trimestre") {
    if (quarter > 0)
      rows.push(["trimestre passado", cur, sum(getMonthly(year).slice((quarter - 1) * 3, quarter * 3))]);
    const ya = sum(getMonthly(year - 1).slice(quarter * 3, quarter * 3 + 3));
    if (ya > 0) rows.push(["mesmo trim., ano passado", cur, ya]);
  } else {
    const ya = sum(getMonthly(year - 1));
    if (ya > 0) rows.push(["ano passado", cur, ya]);
  }
  return rows.filter((r) => r[2] != null && r[2] > 0);
}

// série do gráfico: rótulos + valores + índice destacado
export function chartSeries(
  getMonthly: (y: number) => number[],
  getWk: ((y: number, m: number, w: number) => number) | null,
  cfg: Scope
) {
  const { period, year, month, week, quarter } = cfg;
  if (period === "semana")
    return {
      labels: ["W1", "W2", "W3", "W4"],
      values: [0, 1, 2, 3].map((w) => (getWk ? getWk(year, month, w) : 0)),
      sel: week,
    };
  const m = getMonthly(year);
  if (period === "trimestre")
    return {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      values: [0, 1, 2, 3].map((q) => sum(m.slice(q * 3, q * 3 + 3))),
      sel: quarter,
    };
  return { labels: MONTHS, values: m.slice(0, 12), sel: period === "mes" ? month : -1 };
}

// Classificadores de status para Pill
export type StatusTier = "exc" | "bom" | "ate" | "cri";
export const convClass = (v: number): StatusTier =>
  v >= 0.3 ? "exc" : v >= 0.18 ? "bom" : v >= 0.1 ? "ate" : "cri";
export const roasClass = (v: number): StatusTier =>
  v >= 2.5 ? "exc" : v >= 1.5 ? "bom" : v >= 1 ? "ate" : "cri";
export const attClass = (p: number): StatusTier =>
  p >= 1 ? "exc" : p >= 0.75 ? "bom" : p >= 0.5 ? "ate" : "cri";

// Delta estruturado — renderizado por <DeltaChip>
export interface Delta {
  kind: "up" | "down" | "flat";
  pctLabel: string;
  numLabel?: string;
}
export function computeDelta(
  cur: number | null | undefined,
  prev: number | null | undefined,
  withNum = false
): Delta {
  if (prev == null || prev === 0 || cur == null || isNaN(cur))
    return { kind: "flat", pctLabel: "—" };
  const d = (cur - prev) / prev;
  const up = d >= 0;
  const pctLabel =
    (up ? "▲ " : "▼ ") +
    (Math.abs(d) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) +
    "%";
  let numLabel: string | undefined;
  if (withNum) {
    const dv = Math.abs(cur - prev);
    const kf =
      Math.abs(dv) >= 1000
        ? (dv / 1000).toLocaleString("pt-BR", {
            maximumFractionDigits: Math.abs(dv) >= 100000 ? 0 : 1,
          }) + "k"
        : Math.round(dv).toLocaleString("pt-BR");
    numLabel = (up ? "+" : "−") + kf;
  }
  return { kind: up ? "up" : "down", pctLabel, numLabel };
}
