"use client";
// Store de estado de UI — espelha o objeto `state` do blueprint (linhas 681-690).
// `view` NÃO fica aqui: é derivado da rota (ver lib/nav.ts). Persistência (Bloco 4)
// hidratará estas fatias a partir do banco (hoje semeadas de lib/seed-data).
import { create } from "zustand";
import { CUR_YEAR, CUR_MONTH, quarterOf, type Period } from "./scope";
import { OKR2026, POSTS_SEED, PERFIL_DEFAULT, type SeedPost } from "./seed-data";

export interface Cmp {
  period: Period; year: number; month: number; week: number; quarter: number;
}

// ── OKR editável ──
export interface KrItem { id: string; kr: string; alvo: string; un: string; tag: string; resp: string }
export interface AreaItem { id: string; nome: string; krs: KrItem[] }
export interface Okr { objetivo: string; areas: AreaItem[] }

// ── Post do calendário (mesma forma do blueprint; y/m/d) ──
export interface PostItem extends SeedPost {}

// ── Fonte de dados importada ──
export interface FonteItem { id: string; nome: string; tipo: "csv" | "xlsx" | "pdf"; campos: number; usados: number; linhas: number; pendente: boolean }
export interface FonteMap {
  nome: string; tipo: "csv" | "xlsx" | "pdf"; linhas: number;
  campos: { nome: string; tipo: string; usar: boolean }[];
  preview: string[][];
}

// ── Perfil / Ambiente ──
export interface Perfil {
  empresa: string; segmento: string; cidade: string; site: string;
  canais: string[]; produtos: string[]; relacao: Record<string, boolean>;
}

let __id = 0;
const uid = (p: string) => `${p}_${++__id}`;

function seedOkr(): Okr {
  return {
    objetivo: OKR2026.objetivo,
    areas: OKR2026.areas.map((a) => ({
      id: uid("area"),
      nome: a.area,
      krs: a.krs.map((k) => ({ id: uid("kr"), kr: k.kr, alvo: k.alvo, un: k.un, tag: k.tag, resp: k.resp })),
    })),
  };
}

export interface UIState {
  // escopo temporal
  period: Period; year: number; month: number; week: number; quarter: number;
  scenario: boolean; cmp: Cmp;
  // filtros por painel
  adsMetric: string; adsPlat: string; canaisView: string; concProd: string;
  igProfile: string; ufFeriado: string; ind: Record<string, boolean>;
  // config / conexões
  redes: Record<string, boolean>; contas: Record<string, boolean>;
  paineis: Record<string, Record<string, boolean>>; cfgOpen: Record<string, boolean>; impOpen: boolean;
  // agente
  agentOpen: boolean; agentMsgs: Record<string, { role: "user" | "bot"; text: string }[]>;
  // metas / persona / concorrência
  metasEdit: boolean; personaIdx: number; personaPhotos: Record<number, string>;
  compIcons: Record<string, string>; compEdit: string | null;
  // calendário
  calCanal: string; calPerfil: string; calCV: string; calMonth: number; calYear: number;
  postModal: { mode: "new" | "edit"; id?: string; y: number; m: number; d: number } | null;
  // dados editáveis (in-memory até Bloco 4)
  okr: Okr; posts: PostItem[]; fontes: FonteItem[]; fonteMap: FonteMap | null; perfil: Perfil;

  // setters genéricos
  set: (patch: Partial<UIState>) => void;
  // escopo
  setPeriod: (p: Period) => void; setYear: (y: number) => void; setMonth: (m: number) => void;
  setWeek: (w: number) => void; setQuarter: (q: number) => void;
  toggleScenario: () => void; toggleAgent: () => void;
  // config
  toggleRede: (id: string) => void; toggleConta: (id: string) => void;
  setPainelInd: (panel: string, id: string, val: boolean) => void;
  setInd: (id: string, val: boolean) => void; toggleCfgOpen: (panel: string) => void;
  // agente
  agentSend: (agentKey: string, text: string, secao: string) => void;
  // OKR
  setObjetivo: (t: string) => void; setAreaNome: (areaId: string, nome: string) => void;
  addArea: () => void; removeArea: (areaId: string) => void;
  addKr: (areaId: string) => void; removeKr: (areaId: string, krId: string) => void;
  setKr: (areaId: string, krId: string, patch: Partial<KrItem>) => void;
  // posts
  addPost: (p: PostItem) => void; updatePost: (id: string, patch: Partial<PostItem>) => void;
  deletePost: (id: string) => void;
  // perfil
  setPerfil: (patch: Partial<Perfil>) => void; toggleRelacao: (key: string) => void;
  addChip: (field: "canais" | "produtos", v: string) => void;
  removeChip: (field: "canais" | "produtos", v: string) => void;
  // fontes
  addFonte: (f: FonteItem) => void; setFonteMap: (m: FonteMap | null) => void;
}

export const useStore = create<UIState>((set) => ({
  period: "mes", year: CUR_YEAR, month: CUR_MONTH, week: 0, quarter: quarterOf(CUR_MONTH),
  scenario: false, cmp: { period: "mes", year: 2025, month: CUR_MONTH, week: 0, quarter: quarterOf(CUR_MONTH) },
  adsMetric: "receita", adsPlat: "todos", canaisView: "lista", concProd: "geral",
  igProfile: "seahub", ufFeriado: "RN",
  ind: { seguidores: true, atividades: true, splitFollowers: true, organico: true },
  redes: { instagram: true, tiktok: false, linkedin: false, youtube: false },
  contas: { instagram: true, tiktok: false, linkedin: false, youtube: false },
  paineis: {}, cfgOpen: {}, impOpen: false,
  agentOpen: false, agentMsgs: {},
  metasEdit: false, personaIdx: 0, personaPhotos: {}, compIcons: {}, compEdit: null,
  calCanal: "todos", calPerfil: "todos", calCV: "todos", calMonth: CUR_MONTH, calYear: CUR_YEAR,
  postModal: null,
  okr: seedOkr(),
  posts: POSTS_SEED.map((p) => ({ ...p })),
  fontes: [], fonteMap: null,
  perfil: {
    empresa: PERFIL_DEFAULT.empresa, segmento: PERFIL_DEFAULT.segmento, cidade: PERFIL_DEFAULT.cidade,
    site: PERFIL_DEFAULT.site, canais: [...PERFIL_DEFAULT.canais], produtos: [...PERFIL_DEFAULT.produtos], relacao: {},
  },

  set: (patch) => set(patch),
  setPeriod: (p) => set({ period: p }),
  setYear: (y) => set({ year: y }),
  setMonth: (m) => set({ month: m, quarter: quarterOf(m) }),
  setWeek: (w) => set({ week: w }),
  setQuarter: (q) => set({ quarter: q }),
  toggleScenario: () => set((s) => ({ scenario: !s.scenario })),
  toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),

  toggleRede: (id) => set((s) => ({ redes: { ...s.redes, [id]: !s.redes[id] } })),
  toggleConta: (id) => set((s) => ({ contas: { ...s.contas, [id]: !s.contas[id] } })),
  setPainelInd: (panel, id, val) =>
    set((s) => ({ paineis: { ...s.paineis, [panel]: { ...(s.paineis[panel] || {}), [id]: val } } })),
  setInd: (id, val) => set((s) => ({ ind: { ...s.ind, [id]: val } })),
  toggleCfgOpen: (panel) => set((s) => ({ cfgOpen: { ...s.cfgOpen, [panel]: !s.cfgOpen[panel] } })),

  agentSend: (agentKey, text, secao) =>
    set((s) => {
      const prev = s.agentMsgs[agentKey] || [];
      const bot = {
        role: "bot" as const,
        text: `Anotado: "${text}". Quando eu estiver conectado ao OpenClaw, respondo com os dados reais de ${secao}. Por enquanto isto é um preview da conversa.`,
      };
      return { agentMsgs: { ...s.agentMsgs, [agentKey]: [...prev, { role: "user" as const, text }, bot] } };
    }),

  setObjetivo: (t) => set((s) => ({ okr: { ...s.okr, objetivo: t } })),
  setAreaNome: (areaId, nome) =>
    set((s) => ({ okr: { ...s.okr, areas: s.okr.areas.map((a) => (a.id === areaId ? { ...a, nome } : a)) } })),
  addArea: () =>
    set((s) => ({ okr: { ...s.okr, areas: [...s.okr.areas, { id: uid("area"), nome: "Nova área", krs: [] }] } })),
  removeArea: (areaId) => set((s) => ({ okr: { ...s.okr, areas: s.okr.areas.filter((a) => a.id !== areaId) } })),
  addKr: (areaId) =>
    set((s) => ({
      okr: {
        ...s.okr,
        areas: s.okr.areas.map((a) =>
          a.id === areaId ? { ...a, krs: [...a.krs, { id: uid("kr"), kr: "Novo KR", alvo: "", un: "", tag: "", resp: "" }] } : a
        ),
      },
    })),
  removeKr: (areaId, krId) =>
    set((s) => ({
      okr: { ...s.okr, areas: s.okr.areas.map((a) => (a.id === areaId ? { ...a, krs: a.krs.filter((k) => k.id !== krId) } : a)) },
    })),
  setKr: (areaId, krId, patch) =>
    set((s) => ({
      okr: {
        ...s.okr,
        areas: s.okr.areas.map((a) =>
          a.id === areaId ? { ...a, krs: a.krs.map((k) => (k.id === krId ? { ...k, ...patch } : k)) } : a
        ),
      },
    })),

  addPost: (p) => set((s) => ({ posts: [...s.posts, p] })),
  updatePost: (id, patch) => set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  deletePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),

  setPerfil: (patch) => set((s) => ({ perfil: { ...s.perfil, ...patch } })),
  toggleRelacao: (key) => set((s) => ({ perfil: { ...s.perfil, relacao: { ...s.perfil.relacao, [key]: !s.perfil.relacao[key] } } })),
  addChip: (field, v) =>
    set((s) => (s.perfil[field].includes(v) ? {} : { perfil: { ...s.perfil, [field]: [...s.perfil[field], v] } })),
  removeChip: (field, v) => set((s) => ({ perfil: { ...s.perfil, [field]: s.perfil[field].filter((x) => x !== v) } })),

  addFonte: (f) => set((s) => ({ fontes: [...s.fontes, f] })),
  setFonteMap: (m) => set({ fonteMap: m }),
}));

export const newId = uid;
