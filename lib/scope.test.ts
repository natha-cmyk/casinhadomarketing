import { describe, expect, it } from "vitest";
import {
  civilToday,
  daysInMonth,
  quarterOf,
  scopeLabelText,
  scopeVal,
  weekRange,
  type Scope,
} from "./scope";

describe("escopo / período", () => {
  it("quarterOf agrupa meses em trimestres", () => {
    expect(quarterOf(0)).toBe(0);
    expect(quarterOf(5)).toBe(1);
    expect(quarterOf(11)).toBe(3);
  });

  it("daysInMonth usa calendário do ano", () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2028, 1)).toBe(29);
    expect(daysInMonth(2026, 0)).toBe(31);
  });

  it("civilToday segue America/Fortaleza, não o UTC do processo", () => {
    // 01/01 02:00 UTC ainda é 31/12 em Fortaleza (UTC−3)
    expect(civilToday(new Date("2026-01-01T02:00:00Z"))).toEqual({ year: 2025, month: 11, day: 31 });
    expect(civilToday(new Date("2026-01-01T03:00:00Z"))).toEqual({ year: 2026, month: 0, day: 1 });
  });

  it("weekRange formata intervalo da semana no mês", () => {
    expect(weekRange(2026, 0, 0)).toBe("1–7");
    expect(weekRange(2026, 0, 3)).toBe("22–31");
  });

  it("scopeVal retorna mês do array monthly no período mes", () => {
    const monthly = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
    const cfg: Scope = {
      period: "mes",
      year: 2026,
      month: 2,
      week: 0,
      quarter: 0,
    };
    expect(scopeVal(monthly, null, cfg)).toBe(30);
  });

  it("scopeLabelText descreve mês por extenso", () => {
    const cfg: Scope = {
      period: "mes",
      year: 2026,
      month: 0,
      week: 0,
      quarter: 0,
    };
    expect(scopeLabelText(cfg)).toBe("Janeiro 2026");
  });
});
