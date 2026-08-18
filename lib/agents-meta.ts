// Metadados dos agentes SEM o system prompt (seguro pro cliente). Usado por
// PersonalizacaoView (personalização) e AgentDock (visibilidade/seletor).
export type AgentKey = "poseidon" | "apollo" | "athena" | "dionisio";

export interface AgentMeta {
  key: AgentKey;
  nome: string;
  papel: string;
  desc: string;
  icon: string; // nome do ícone em lib/nav ICONS
  cor: string;
}

export const AGENTS_META: AgentMeta[] = [
  { key: "poseidon", nome: "Poseidon", papel: "Performance, tráfego pago & dados", icon: "ag_data", cor: "#00BBC5",
    desc: "Lê funil e métricas, interpreta campanhas (Meta/Google/YouTube), diagnostica onde trava/converte e recomenda otimização com base em dados." },
  { key: "apollo", nome: "Apollo", papel: "Conteúdo, criativos & SEO", icon: "ag_content", cor: "#FF001E",
    desc: "Escreve conteúdo pronto (Reels, Stories, blog, anúncios), planeja pauta por canal e cuida de SEO e visibilidade em buscas." },
  { key: "athena", nome: "Athena", papel: "Estratégia & orquestração", icon: "ag_strategy", cor: "#8E5BE0",
    desc: "Visão macro: diagnóstico + plano, prioriza demandas, conecta conteúdo+performance+CRM e acompanha metas/OKR." },
  { key: "dionisio", nome: "Dionísio", papel: "CRM, WhatsApp & relacionamento", icon: "ag_crm", cor: "#2FB457",
    desc: "Réguas de WhatsApp, mensagens por momento do funil, organização de CRM/pipeline e análise da base (frio/morno/quente)." },
];

export const AGENT_KEYS: AgentKey[] = AGENTS_META.map((a) => a.key);

// Ambientes (painéis) onde um agente pode aparecer. `redes` cobre todos os painéis sociais.
export const AGENT_PANELS: { id: string; label: string }[] = [
  { id: "overview", label: "Painel (visão geral)" },
  { id: "redes", label: "Redes sociais" },
  { id: "ads", label: "Canais Pagos" },
  { id: "geracao", label: "Geração por Canais (CRM)" },
  { id: "calendario", label: "Calendário" },
  { id: "metas", label: "Metas / OKR" },
  { id: "persona", label: "Persona" },
  { id: "concorrencia", label: "Concorrência" },
];
export const AGENT_PANEL_IDS = AGENT_PANELS.map((p) => p.id);

// config de UM agente (persistida em EnvConfig.agentsConfig)
export interface AgentConfig {
  enabled: boolean;
  panels: string[] | null; // null = todos os painéis; [] = nenhum; lista = só esses
  promptExtra: string; // instruções extras APPENDadas ao prompt-base do agente
  name?: string; // nome personalizado (vazio = nome de fábrica)
}
// nome de exibição de um agente: custom (se houver) ou o de fábrica
export function agentDisplayName(factory: string, cfg?: { name?: string }): string {
  return (cfg?.name || "").trim() || factory;
}
export type AgentsConfig = Partial<Record<AgentKey, AgentConfig>>;

// view (rota) → id de painel de agente. Painéis sociais → "redes".
const SOCIAL = new Set(["instagram", "tiktok", "x", "facebook", "linkedin", "youtube", "threads", "reddit", "pinterest", "bluesky", "snapchat", "googlebusiness"]);
export function panelOfView(view: string): string {
  if (SOCIAL.has(view)) return "redes";
  if (view === "config") return "overview"; // Personalização usa o mesmo escopo do painel
  return view;
}

// agente está visível/ativo nesse painel?
export function agentVisibleOn(cfg: AgentConfig | undefined, panelId: string): boolean {
  if (!cfg) return true; // sem config = padrão ligado em tudo
  if (cfg.enabled === false) return false;
  if (cfg.panels == null) return true;
  return cfg.panels.includes(panelId);
}
