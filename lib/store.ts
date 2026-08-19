"use client";
// Store de estado de UI — espelha o objeto `state` do blueprint (linhas 681-690).
// `view` NÃO fica aqui: é derivado da rota (ver lib/nav.ts). Persistência (Bloco 4)
// hidratará estas fatias a partir do banco (hoje semeadas de lib/seed-data).
import { create } from "zustand";
import { CUR_YEAR, CUR_MONTH, quarterOf, type Period } from "./scope";
import { type SeedPost } from "./seed-data";

export interface Cmp {
  period: Period; year: number; month: number; week: number; quarter: number;
}

// ── OKR editável ──
export interface KrItem { id: string; kr: string; alvo: string; un: string; tag: string; resp: string }
export interface AreaItem { id: string; nome: string; krs: KrItem[] }
export interface Okr { objetivo: string; areas: AreaItem[] }

// ── Post do calendário (mesma forma do blueprint; y/m/d) ──
// mídia enviada via presign da Zernio (imagem/vídeo/gif/pdf)
export interface PostMedia { type: "image" | "video" | "gif" | "document"; url: string; filename?: string; mimeType?: string; size?: number }
export interface PostItem extends SeedPost { media?: PostMedia[] }

// ── Persona editável (persistida por workspace) ──
// `detalhes` trata a persona como pessoa real (consumo, gostos, atividades).
export interface PersonaDetalhes {
  nomeProprio?: string; consome?: string[]; gosta?: string[]; naoGosta?: string[]; atividades?: string[];
}
export interface PersonaItem {
  id: string; tag: string; handle: string; emoji: string; cover: string; nome: string;
  representa: string; comunica: string; dores: string[]; canais: string; gatilho: string;
  stats: [string, string][]; foto?: string; detalhes?: PersonaDetalhes; ordem: number;
}

// ── Concorrente editável (persistido por workspace) ──
export interface ConcItem {
  id: string; nome: string; ig: string; linkedin: boolean; youtube: boolean;
  dominio?: string; categoria: "espaco" | "marca" | "certificado" | "cobranca";
  iconOverride?: string; ordem: number;
}

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
  ramo: string; telefone: string; emailContato: string; estado: string;
  canais: string[]; produtos: string[]; relacao: Record<string, boolean>;
}

// ── Mídia paga MANUAL (canal pago informado à mão) ──
export interface ManualAd {
  id: string; nome: string; plataforma: string; ano: number; mes: number; // 0-11
  gasto: number; impressoes: number; cliques: number;
  ctr: number; cpc: number; cpm: number; conversoes: number; campanha: string;
}
// ── Dados MANUAIS por campanha (o que o Meta não entrega: vendas, receita, etc.) ──
// vinculados a uma campanha real por (adAccountId, campaignName) + competência (ano/mês)
export interface ManualCampaign {
  id: string; adAccountId: string; campaignName: string; ano: number; mes: number; // 0-11
  vendas: number; receita: number; leadsQualificados: number; obs: string;
}
// ── Indicador customizado criado pelo perfil (por painel) ──
export interface CustomInd {
  id: string; label: string; desc?: string;
  metric?: string; // chave de métrica Zernio a vincular (opcional)
  kind: "kpi" | "chart";
}

let __id = 0;
const uid = (p: string) => `${p}_${++__id}`;

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
  // snapshot do que o painel atual exibe (números na tela) — enviado aos agentes p/ ancorar
  panelSnapshot: { view: string; label?: string; data: unknown } | null;
  // metas / persona / concorrência
  metasEdit: boolean; personaIdx: number; personaPhotos: Record<number, string>;
  compIcons: Record<string, string>; compEdit: string | null;
  // calendário
  calCanal: string; calPerfil: string; calCV: string; calMonth: number; calYear: number;
  postModal: { mode: "new" | "edit"; id?: string; y: number; m: number; d: number } | null;
  // dados editáveis (persistidos no Bloco 4)
  okr: Okr; posts: PostItem[]; fontes: FonteItem[]; fonteMap: FonteMap | null; perfil: Perfil;
  personas: PersonaItem[]; concorrentes: ConcItem[];
  hydrated: boolean;
  // contas conectadas na Zernio (do profile do workspace)
  zernioAccounts: { _id: string; platform: string; followersCount?: number; displayName?: string;
    enabled?: boolean; adsStatus?: string; profilePicture?: string; username?: string }[];
  // conta selecionada por painel/rede (rede → accountId). Suporta multi-conta na mesma
  // plataforma (ex. Instagram SeaHub + Seabox). Default = primeira conta da rede.
  selectedAccount: Record<string, string>;
  // mídia paga manual + indicadores customizados (persistidos no config)
  manualAds: ManualAd[];
  manualCampaigns: ManualCampaign[];
  customInd: Record<string, CustomInd[]>;
  // ordem dos cards reordenáveis dos painéis sociais, por painel (= rede). Persistido no config.
  cardOrder: Record<string, string[]>;
  // canais MANUAIS do calendário (só registro de conteúdo, sem publicação síncrona). Persistido no config.
  calManuais: string[];
  // personalização dos agentes por workspace: { agentKey: {enabled, panels, promptExtra} }. Persistido no config.
  agentsConfig: Record<string, { enabled: boolean; panels: string[] | null; promptExtra: string; name?: string }>;
  // layout dos widgets por painel. grid = coordenadas livres {x,y,w,h} por widget (tipo ClickUp);
  // order/size/height mantidos por compat. hidden = ocultos. Persistido no config.
  widgetLayout: Record<string, { order?: string[]; size?: Record<string, number>; height?: Record<string, number>; hidden: string[]; grid?: Record<string, { x: number; y: number; w: number; h: number }> }>;
  // qual painel de widgets está em modo "Organizar" (o botão fica no topo da página). Só UI.
  widgetEdit: string | null;

  // setters genéricos
  set: (patch: Partial<UIState>) => void;
  hydrate: (d: {
    config: { redes: Record<string, boolean>; paineis: Record<string, Record<string, boolean>>; contas: Record<string, boolean>; cfgOpen: Record<string, boolean>; impOpen: boolean; adConfig?: { manualChannels?: ManualAd[]; manualCampaigns?: ManualCampaign[]; cardOrder?: Record<string, string[]> }; customInd?: Record<string, CustomInd[]>; calManuais?: string[]; agentsConfig?: Record<string, { enabled: boolean; panels: string[] | null; promptExtra: string; name?: string }>; widgetLayout?: Record<string, unknown> } | null;
    perfil: Perfil | null;
    okr: Okr | null;
    posts: { posts: PostItem[] } | null;
    personas: { personas: PersonaItem[] } | null;
    concorrentes: { concorrentes: ConcItem[] } | null;
  }) => void;
  // escopo
  setPeriod: (p: Period) => void; setYear: (y: number) => void; setMonth: (m: number) => void;
  setWeek: (w: number) => void; setQuarter: (q: number) => void;
  toggleScenario: () => void; toggleAgent: () => void;
  // zernio: seta contas conectadas e ATIVA o painel da rede automaticamente
  setZernioAccounts: (accounts: UIState["zernioAccounts"]) => void;
  // multi-conta: escolhe qual conta daquela rede o painel exibe
  setSelectedAccount: (rede: string, accountId: string) => void;
  // mídia paga manual
  addManualAd: (a: ManualAd) => void; updateManualAd: (id: string, patch: Partial<ManualAd>) => void;
  removeManualAd: (id: string) => void;
  // dados manuais por campanha
  addManualCampaign: (c: ManualCampaign) => void; updateManualCampaign: (id: string, patch: Partial<ManualCampaign>) => void;
  removeManualCampaign: (id: string) => void;
  // indicadores customizados
  addCustomInd: (panel: string, c: CustomInd) => void; removeCustomInd: (panel: string, id: string) => void;
  // ordem dos cards reordenáveis (drag) por painel social
  setCardOrder: (panel: string, ids: string[]) => void;
  addCalManual: (nome: string) => void;
  removeCalManual: (nome: string) => void;
  setAgentConfig: (key: string, patch: Partial<{ enabled: boolean; panels: string[] | null; promptExtra: string; name?: string }>) => void;
  setWidgetLayout: (panel: string, layout: UIState["widgetLayout"][string]) => void;
  toggleWidgetEdit: (panel: string) => void;
  // config
  toggleRede: (id: string) => void; toggleConta: (id: string) => void;
  setPainelInd: (panel: string, id: string, val: boolean) => void;
  setInd: (id: string, val: boolean) => void; toggleCfgOpen: (panel: string) => void;
  // agente (LLM real): empilha mensagem e atualiza a última (streaming)
  agentPush: (agentKey: string, msg: { role: "user" | "bot"; text: string }) => void;
  agentSetLast: (agentKey: string, text: string) => void;
  setPanelSnapshot: (snap: { view: string; label?: string; data: unknown } | null) => void;
  // OKR
  setObjetivo: (t: string) => void; setAreaNome: (areaId: string, nome: string) => void;
  addArea: () => void; removeArea: (areaId: string) => void;
  addKr: (areaId: string) => void; removeKr: (areaId: string, krId: string) => void;
  setKr: (areaId: string, krId: string, patch: Partial<KrItem>) => void;
  // posts
  addPost: (p: PostItem) => void; updatePost: (id: string, patch: Partial<PostItem>) => void;
  deletePost: (id: string) => void;
  // personas
  addPersona: (p: PersonaItem) => void; updatePersona: (id: string, patch: Partial<PersonaItem>) => void;
  removePersona: (id: string) => void;
  // concorrentes
  addConc: (c: ConcItem) => void; updateConc: (id: string, patch: Partial<ConcItem>) => void;
  removeConc: (id: string) => void;
  // perfil
  setPerfil: (patch: Partial<Perfil>) => void; toggleRelacao: (key: string) => void;
  addChip: (field: "canais" | "produtos", v: string) => void;
  removeChip: (field: "canais" | "produtos", v: string) => void;
  // fontes
  addFonte: (f: FonteItem) => void; setFonteMap: (m: FonteMap | null) => void;
}

export const useStore = create<UIState>((set) => ({
  period: "mes", year: CUR_YEAR, month: CUR_MONTH, week: 0, quarter: quarterOf(CUR_MONTH),
  // comparação padrão = mês anterior (tem dado real); ajusta o ano na virada de janeiro
  scenario: false, cmp: {
    period: "mes",
    year: CUR_MONTH === 0 ? CUR_YEAR - 1 : CUR_YEAR,
    month: (CUR_MONTH + 11) % 12,
    week: 0,
    quarter: quarterOf((CUR_MONTH + 11) % 12),
  },
  adsMetric: "receita", adsPlat: "todos", canaisView: "lista", concProd: "geral",
  igProfile: "seahub", ufFeriado: "RN",
  ind: { seguidores: true, atividades: true, splitFollowers: true, organico: true },
  redes: {},
  contas: {},
  paineis: {}, cfgOpen: {}, impOpen: false,
  agentOpen: false, agentMsgs: {}, panelSnapshot: null,
  metasEdit: false, personaIdx: 0, personaPhotos: {}, compIcons: {}, compEdit: null,
  calCanal: "todos", calPerfil: "todos", calCV: "todos", calMonth: CUR_MONTH, calYear: CUR_YEAR,
  postModal: null,
  okr: { objetivo: "", areas: [] },
  posts: [],
  personas: [], concorrentes: [],
  fontes: [], fonteMap: null,
  perfil: { empresa: "", segmento: "", cidade: "", site: "", ramo: "", telefone: "", emailContato: "", estado: "", canais: [], produtos: [], relacao: {} },
  hydrated: false,
  zernioAccounts: [],
  selectedAccount: {},
  manualAds: [],
  manualCampaigns: [],
  customInd: {},
  cardOrder: {},
  calManuais: [],
  agentsConfig: {},
  widgetLayout: {},
  widgetEdit: null,

  set: (patch) => set(patch),
  addManualAd: (a) => set((s) => ({ manualAds: [...s.manualAds, a] })),
  updateManualAd: (id, patch) =>
    set((s) => ({ manualAds: s.manualAds.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  removeManualAd: (id) => set((s) => ({ manualAds: s.manualAds.filter((m) => m.id !== id) })),
  addManualCampaign: (c) => set((s) => ({ manualCampaigns: [...s.manualCampaigns, c] })),
  updateManualCampaign: (id, patch) =>
    set((s) => ({ manualCampaigns: s.manualCampaigns.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  removeManualCampaign: (id) => set((s) => ({ manualCampaigns: s.manualCampaigns.filter((m) => m.id !== id) })),
  addCustomInd: (panel, c) =>
    set((s) => ({ customInd: { ...s.customInd, [panel]: [...(s.customInd[panel] || []), c] } })),
  removeCustomInd: (panel, id) =>
    set((s) => ({ customInd: { ...s.customInd, [panel]: (s.customInd[panel] || []).filter((c) => c.id !== id) } })),
  setCardOrder: (panel, ids) =>
    set((s) => ({ cardOrder: { ...s.cardOrder, [panel]: ids } })),
  addCalManual: (nome) =>
    set((s) => {
      const v = nome.trim();
      if (!v || s.calManuais.some((c) => c.toLowerCase() === v.toLowerCase())) return {};
      return { calManuais: [...s.calManuais, v] };
    }),
  removeCalManual: (nome) => set((s) => ({ calManuais: s.calManuais.filter((c) => c !== nome) })),
  setAgentConfig: (key, patch) =>
    set((s) => {
      const cur = s.agentsConfig[key] ?? { enabled: true, panels: null, promptExtra: "" };
      return { agentsConfig: { ...s.agentsConfig, [key]: { ...cur, ...patch } } };
    }),
  setWidgetLayout: (panel, layout) =>
    set((s) => ({ widgetLayout: { ...s.widgetLayout, [panel]: layout } })),
  toggleWidgetEdit: (panel) => set((s) => ({ widgetEdit: s.widgetEdit === panel ? null : panel })),
  setZernioAccounts: (accounts) =>
    set((s) => {
      // ativa no sidebar só as redes com conta SOCIAL habilitada (posting).
      // contas ads-only (enabled:false, adsStatus:connected) NÃO viram rede social.
      const rev: Record<string, string> = { twitter: "x" };
      const redes = { ...s.redes };
      const byRede: Record<string, boolean> = {};
      for (const a of accounts) {
        const id = rev[a.platform] || a.platform;
        byRede[id] = (byRede[id] ?? false) || a.enabled === true;
      }
      // só mexe nas redes que têm conta; toggles manuais de redes sem conta ficam intactos
      for (const [id, on] of Object.entries(byRede)) redes[id] = on;
      // limpa seleções apontando para contas que já não existem
      const ids = new Set(accounts.map((a) => a._id));
      const selectedAccount = Object.fromEntries(
        Object.entries(s.selectedAccount).filter(([, accId]) => ids.has(accId))
      );
      return { zernioAccounts: accounts, redes, selectedAccount };
    }),
  setSelectedAccount: (rede, accountId) =>
    set((s) => ({ selectedAccount: { ...s.selectedAccount, [rede]: accountId } })),
  hydrate: (d) =>
    set((s) => {
      const patch: Partial<UIState> = { hydrated: true };
      if (d.config) {
        patch.redes = d.config.redes ?? s.redes;
        patch.paineis = d.config.paineis ?? s.paineis;
        patch.contas = d.config.contas ?? s.contas;
        patch.cfgOpen = d.config.cfgOpen ?? s.cfgOpen;
        patch.impOpen = !!d.config.impOpen;
        if (Array.isArray(d.config.adConfig?.manualChannels)) patch.manualAds = d.config.adConfig!.manualChannels!;
        if (Array.isArray(d.config.adConfig?.manualCampaigns)) patch.manualCampaigns = d.config.adConfig!.manualCampaigns!;
        if (d.config.adConfig?.cardOrder) patch.cardOrder = d.config.adConfig.cardOrder;
        if (d.config.customInd) patch.customInd = d.config.customInd;
        if (Array.isArray(d.config.calManuais)) patch.calManuais = d.config.calManuais;
        if (d.config.agentsConfig && typeof d.config.agentsConfig === "object") patch.agentsConfig = d.config.agentsConfig;
        if (d.config.widgetLayout && typeof d.config.widgetLayout === "object") patch.widgetLayout = d.config.widgetLayout as UIState["widgetLayout"];
      }
      if (d.perfil) patch.perfil = d.perfil;
      if (d.okr && d.okr.areas) patch.okr = d.okr;
      if (d.posts && Array.isArray(d.posts.posts)) patch.posts = d.posts.posts;
      if (d.personas && Array.isArray(d.personas.personas)) patch.personas = d.personas.personas;
      if (d.concorrentes && Array.isArray(d.concorrentes.concorrentes)) patch.concorrentes = d.concorrentes.concorrentes;
      return patch;
    }),
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

  agentPush: (agentKey, msg) =>
    set((s) => ({ agentMsgs: { ...s.agentMsgs, [agentKey]: [...(s.agentMsgs[agentKey] || []), msg] } })),
  agentSetLast: (agentKey, text) =>
    set((s) => {
      const arr = s.agentMsgs[agentKey] || [];
      if (!arr.length) return {};
      const next = arr.slice(0, -1).concat({ ...arr[arr.length - 1], text });
      return { agentMsgs: { ...s.agentMsgs, [agentKey]: next } };
    }),
  setPanelSnapshot: (snap) => set({ panelSnapshot: snap }),

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

  addPersona: (p) => set((s) => ({ personas: [...s.personas, p] })),
  updatePersona: (id, patch) => set((s) => ({ personas: s.personas.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  removePersona: (id) => set((s) => ({ personas: s.personas.filter((p) => p.id !== id) })),

  addConc: (c) => set((s) => ({ concorrentes: [...s.concorrentes, c] })),
  updateConc: (id, patch) => set((s) => ({ concorrentes: s.concorrentes.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  removeConc: (id) => set((s) => ({ concorrentes: s.concorrentes.filter((c) => c.id !== id) })),

  setPerfil: (patch) => set((s) => ({ perfil: { ...s.perfil, ...patch } })),
  toggleRelacao: (key) => set((s) => ({ perfil: { ...s.perfil, relacao: { ...s.perfil.relacao, [key]: !s.perfil.relacao[key] } } })),
  addChip: (field, v) =>
    set((s) => (s.perfil[field].includes(v) ? {} : { perfil: { ...s.perfil, [field]: [...s.perfil[field], v] } })),
  removeChip: (field, v) => set((s) => ({ perfil: { ...s.perfil, [field]: s.perfil[field].filter((x) => x !== v) } })),

  addFonte: (f) => set((s) => ({ fontes: [...s.fontes, f] })),
  setFonteMap: (m) => set({ fonteMap: m }),
}));

export const newId = uid;
