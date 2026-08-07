"use client";
// Store de estado de UI — espelha o objeto `state` do blueprint (linhas 681-690).
// `view` NÃO fica aqui: é derivado da rota (ver lib/nav.ts). Persistência (Bloco 4)
// hidratará redes/contas/paineis/perfil a partir do banco.
import { create } from "zustand";
import { CUR_YEAR, CUR_MONTH, quarterOf, type Period } from "./scope";

export interface Cmp {
  period: Period;
  year: number;
  month: number;
  week: number;
  quarter: number;
}

export interface UIState {
  // escopo temporal
  period: Period;
  year: number;
  month: number;
  week: number;
  quarter: number;
  scenario: boolean;
  cmp: Cmp;
  // filtros por painel
  adsMetric: string;
  adsPlat: string;
  canaisView: string;
  concProd: string;
  igProfile: string;
  ufFeriado: string;
  ind: Record<string, boolean>;
  // config / conexões
  redes: Record<string, boolean>;
  contas: Record<string, boolean>;
  paineis: Record<string, Record<string, boolean>>;
  cfgOpen: Record<string, boolean>;
  impOpen: boolean;
  // agente
  agentOpen: boolean;
  agentMsgs: Record<string, { role: "user" | "bot"; text: string }[]>;
  // metas / persona / concorrência / calendário
  metasEdit: boolean;
  personaIdx: number;
  personaPhotos: Record<number, string>;
  compIcons: Record<string, string>;
  compEdit: string | null;
  calCanal: string;
  calPerfil: string;
  calCV: string;
  postModal: { mode: "new" | "edit"; id?: string; y: number; m: number; d: number } | null;

  // setters
  set: (patch: Partial<UIState>) => void;
  setPeriod: (p: Period) => void;
  setYear: (y: number) => void;
  setMonth: (m: number) => void; // sincroniza quarter
  setWeek: (w: number) => void;
  setQuarter: (q: number) => void;
  toggleScenario: () => void;
  toggleAgent: () => void;
}

export const useStore = create<UIState>((set) => ({
  period: "mes",
  year: CUR_YEAR,
  month: CUR_MONTH,
  week: 0,
  quarter: quarterOf(CUR_MONTH),
  scenario: false,
  cmp: { period: "mes", year: 2025, month: CUR_MONTH, week: 0, quarter: quarterOf(CUR_MONTH) },
  adsMetric: "receita",
  adsPlat: "todos",
  canaisView: "lista",
  concProd: "geral",
  igProfile: "seahub",
  ufFeriado: "RN",
  ind: { seguidores: true, atividades: true, splitFollowers: true, organico: true },
  redes: { instagram: true, tiktok: false, linkedin: false, youtube: false },
  contas: { instagram: true, tiktok: false, linkedin: false, youtube: false },
  paineis: {},
  cfgOpen: {},
  impOpen: false,
  agentOpen: false,
  agentMsgs: {},
  metasEdit: false,
  personaIdx: 0,
  personaPhotos: {},
  compIcons: {},
  compEdit: null,
  calCanal: "todos",
  calPerfil: "todos",
  calCV: "todos",
  postModal: null,

  set: (patch) => set(patch),
  setPeriod: (p) => set({ period: p }),
  setYear: (y) => set({ year: y }),
  setMonth: (m) => set({ month: m, quarter: quarterOf(m) }),
  setWeek: (w) => set({ week: w }),
  setQuarter: (q) => set({ quarter: q }),
  toggleScenario: () => set((s) => ({ scenario: !s.scenario })),
  toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),
}));
