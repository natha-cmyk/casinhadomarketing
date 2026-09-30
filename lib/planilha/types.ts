// Tipos do payload da planilha anual (compartilhados servidor↔cliente).
import type { PSection, CellKind } from "./spec";

export type Cell = number | string | null;

// ── personalização da aba (por workspace, GLOBAL por aba — vale pra todos os anos) ──
export interface PlanilhaCustomRow { section: string; key: string; label: string; kind: CellKind }
export interface PlanilhaConfig {
  hidden: string[]; // row.keys ocultos
  custom: PlanilhaCustomRow[]; // indicadores manuais adicionados
  order: Record<string, string[]>; // ordem das linhas por seção (title -> [row.key...])
}
export const emptyConfig = (): PlanilhaConfig => ({ hidden: [], custom: [], order: {} });

export interface RowData {
  // weeks[mês 0-11][semana 0-3] — valor da semana (null = sem dado)
  weeks: Cell[][];
  // months[mês 0-11] — total do mês (null = sem dado; para linhas aditivas o engine soma as semanas)
  months: Cell[];
  // total do ano informado pela fonte (opcional; para linhas aditivas o engine soma os meses)
  year?: Cell;
}
export type TabData = Record<string, RowData>;

export interface PlanilhaPayload {
  year: number;
  tab: string;
  weekly: boolean; // regime de colunas (semanal vs mensal) — pode variar por ano
  sections: PSection[]; // ESTRUTURA COMPLETA vinda do servidor (por tab+ano)
  config: PlanilhaConfig; // personalização (ocultar/ordenar/indicadores manuais) — cliente aplica
  data: TabData;
  // procedência resumida (mostrada em nota de rodapé — honesto sobre a cobertura)
  coverage: string;
  updatedAt: string;
}

// helpers de construção (servidor)
export const emptyWeeks = (): Cell[][] => Array.from({ length: 12 }, () => [null, null, null, null]);
export const emptyMonths = (): Cell[] => Array.from({ length: 12 }, () => null);
export function emptyRow(): RowData {
  return { weeks: emptyWeeks(), months: emptyMonths() };
}
