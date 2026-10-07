import { describe, expect, it } from "vitest";
import {
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
