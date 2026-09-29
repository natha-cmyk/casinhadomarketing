// Tipos do payload da planilha anual (compartilhados servidor↔cliente).
import type { PSection } from "./spec";

export type Cell = number | string | null;

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
  sections: PSection[]; // ESTRUTURA vinda do servidor (por tab+ano) — engine renderiza isto
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
