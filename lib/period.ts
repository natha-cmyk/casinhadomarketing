// Janela civil (YYYY-MM-DD) a partir do escopo da toolbar.
// Cada tela passa a política que já usava — o cálculo mora num lugar só,
// o número que o painel mostra não muda.
import { daysInMonth } from "./scope";

export interface PeriodScope {
  period: "semana" | "mes" | "trimestre" | "ano";
  year: number;
  month: number;
  quarter: number;
  week?: number;
}

export interface PeriodPolicy {
  /** "civil" = 1 jan–31 dez. "social90" = 2 out–31 dez (teto do provedor social). */
  year: "civil" | "social90";
  /**
   * seven: 7 dias (W4 = 22–28, o que Canais/Painel/Ads/GBP pedem hoje).
   * restOfMonth: W4 vai até o fim do mês (rótulo do agente).
   * asMonth: "semana" cai no mês inteiro (Geração, hoje).
   */
  week: "seven" | "restOfMonth" | "asMonth";
  /** Teto em dias corridos, aplicado depois da janela. Só o provedor social. */
  capDays?: number;
}

export const POLICY_SOCIAL: PeriodPolicy = { year: "social90", week: "seven", capDays: 90 };
export const POLICY_ADS: PeriodPolicy = { year: "civil", week: "seven" };
export const POLICY_CRM: PeriodPolicy = { year: "civil", week: "asMonth" };
export const POLICY_AGENT: PeriodPolicy = { year: "civil", week: "restOfMonth" };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function periodRange(scope: PeriodScope, policy: PeriodPolicy): { since: string; until: string } {
  const { period, year, month, quarter } = scope;
  const week = scope.week ?? 0;
  let since: Date;
  let until: Date;

  if (period === "semana" && policy.week !== "asMonth") {
    const last = daysInMonth(year, month);
    if (policy.week === "restOfMonth") {
      const startDay = [1, 8, 15, 22][week] ?? 1;
      const endDay = [7, 14, 21, last][week] ?? last;
      since = new Date(year, month, startDay);
      until = new Date(year, month, endDay);
    } else {
      const startDay = week * 7 + 1;
      since = new Date(year, month, startDay);
      until = new Date(year, month, Math.min(startDay + 6, last));
    }
  } else if (period === "trimestre") {
    since = new Date(year, quarter * 3, 1);
    until = new Date(year, quarter * 3 + 2, daysInMonth(year, quarter * 3 + 2));
  } else if (period === "ano" && policy.year === "social90") {
    until = new Date(year, 11, 31);
    since = new Date(year, 9, 2);
  } else if (period === "ano") {
    since = new Date(year, 0, 1);
    until = new Date(year, 11, 31);
  } else {
    since = new Date(year, month, 1);
    until = new Date(year, month, daysInMonth(year, month));
  }

  if (policy.capDays) {
    const cap = policy.capDays * 864e5;
    if (until.getTime() - since.getTime() > cap) since = new Date(until.getTime() - cap);
  }
  return { since: iso(since), until: iso(until) };
}
