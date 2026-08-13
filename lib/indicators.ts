// Catálogo de indicadores dos painéis sociais + bindings pra dado real (Zernio).
// Fonte única: Personalização (toggles) e os dashboards leem daqui, então "ligar/desligar"
// e "adicionar" refletem de verdade. Base = indicadores da doc (default ON), com lacunas
// marcadas onde a Zernio não entrega; métricas reais extras entram como adicionáveis.
import type { IndGroup } from "@/lib/seed-data";

// id do painel (Casinha) → plataforma Zernio
const PANEL_PLATFORM: Record<string, string> = {
  instagram: "instagram", facebook: "facebook", tiktok: "tiktok",
  youtube: "youtube", linkedin: "linkedin", x: "twitter",
};

// métricas reais por plataforma (espelha ACCOUNT_METRICS do lib/zernio; instagram verificado ao vivo)
const PLATFORM_METRICS: Record<string, string[]> = {
  instagram: ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments",
    "shares", "saves", "replies", "reposts", "follows_and_unfollows", "profile_links_taps"],
  facebook: ["reach", "views", "total_interactions", "likes", "comments", "shares", "post_engagements"],
  tiktok: ["views", "likes", "comments", "shares", "reach", "engaged_audience", "profile_views"],
  youtube: ["views", "likes", "comments", "shares", "subscribers_gained", "subscribers_lost", "watch_time", "average_view_duration"],
  linkedin: ["impressions", "clicks", "likes", "comments", "shares", "engagement", "unique_impressions"],
  twitter: ["impressions", "likes", "replies", "reposts", "profile_visits", "engagements"],
};

// rótulos PT das métricas
export const METRIC_LABEL: Record<string, string> = {
  reach: "Alcance", views: "Visualizações", accounts_engaged: "Contas engajadas",
  total_interactions: "Interações", likes: "Curtidas", comments: "Comentários",
  shares: "Compart.", saves: "Salvos", replies: "Respostas", reposts: "Reposts",
  follows_and_unfollows: "Follows/unfollows", profile_links_taps: "Toques em links",
  impressions: "Impressões", clicks: "Cliques", engagement: "Engajamento",
  unique_impressions: "Impressões únicas", profile_visits: "Visitas ao perfil",
  engagements: "Engajamentos", subscribers_gained: "Inscritos ganhos",
  subscribers_lost: "Inscritos perdidos", watch_time: "Tempo de exibição",
  average_view_duration: "Duração média", engaged_audience: "Audiência engajada",
  profile_views: "Visitas ao perfil", post_engagements: "Engajamento de posts",
};
export const metricLabel = (k: string) => METRIC_LABEL[k] || k.replace(/_/g, " ");

// binding de um indicador → fonte de dado
export type IndBind =
  | { src: "follower" }        // KPI de seguidores (acct.followersCount / série)
  | { src: "followerChart" }   // gráfico de evolução de seguidores
  | { src: "metric"; key: string } // insights.metrics[key]
  | { src: "derived"; key: "eng_rate" | "reach_rate" | "save_rate" } // razão calculada
  | { src: "demographics" }    // seção de audiência (idade/gênero/país/cidade)
  | { src: "none" };           // lacuna: a Zernio não entrega esse indicador

export interface CatItem {
  id: string; label: string; desc?: string;
  kind: "kpi" | "chart" | "section";
  bind: IndBind; def: boolean; group: string;
}

// lacunas nomeadas pela doc (mostradas como "sem dado" — manual/em breve)
const DOC_GAPS: Record<string, CatItem[]> = {
  instagram: [
    { id: "organico", label: "Rendimento orgânico", desc: "share não-impulsionado — em breve", kind: "kpi", bind: { src: "none" }, def: true, group: "Alcance & mix" },
    { id: "splitFollowers", label: "Seguidores vs. não-seguidores", desc: "origem das views — em breve", kind: "kpi", bind: { src: "none" }, def: true, group: "Alcance & mix" },
  ],
  youtube: [
    { id: "ctr_thumb", label: "CTR da miniatura", desc: "em breve (nível de vídeo)", kind: "kpi", bind: { src: "none" }, def: true, group: "Visualização" },
  ],
};
const TOP_GAP = (group = "Conteúdo"): CatItem => ({
  id: "top", label: "Top conteúdos", desc: "ranking por desempenho — em breve (nível de post)",
  kind: "section", bind: { src: "none" }, def: false, group,
});

// catálogo COMPLETO de um painel social (default ON = base rica; tudo toggleável)
export function socialCatalog(panel: string): CatItem[] {
  const plat = PANEL_PLATFORM[panel];
  if (!plat) return [];
  const items: CatItem[] = [
    { id: "seguidores", label: "Seguidores", desc: "base total + evolução", kind: "kpi", bind: { src: "follower" }, def: true, group: "Crescimento" },
    { id: "ch_followers", label: "Evolução de seguidores", desc: "série diária", kind: "chart", bind: { src: "followerChart" }, def: true, group: "Crescimento" },
    { id: "ch_key", label: "Série diária", desc: "métrica-chave por dia (varia por período)", kind: "chart", bind: { src: "none" }, def: true, group: "Crescimento" },
  ];
  for (const key of PLATFORM_METRICS[plat] || []) {
    items.push({
      id: "m_" + key, label: metricLabel(key), kind: "kpi",
      bind: { src: "metric", key }, def: true, group: "Indicadores",
    });
  }
  // razões calculadas (marketing) — sem novo dado, mas muito úteis
  items.push(
    { id: "der_eng_rate", label: "Taxa de engajamento", desc: "interações ÷ alcance", kind: "kpi", bind: { src: "derived", key: "eng_rate" }, def: true, group: "Taxas" },
    { id: "der_reach_rate", label: "Alcance sobre a base", desc: "alcance ÷ seguidores", kind: "kpi", bind: { src: "derived", key: "reach_rate" }, def: true, group: "Taxas" },
    { id: "der_save_rate", label: "Taxa de salvamento", desc: "salvos ÷ alcance", kind: "kpi", bind: { src: "derived", key: "save_rate" }, def: false, group: "Taxas" },
  );
  if (plat === "instagram") {
    items.push({ id: "audiencia", label: "Audiência (demografia)", desc: "idade, gênero, país, cidade", kind: "section", bind: { src: "demographics" }, def: true, group: "Audiência" });
  }
  for (const g of DOC_GAPS[panel] || []) items.push(g);
  items.push(TOP_GAP());
  return items;
}

export const isSocialPanel = (panel: string) => !!PANEL_PLATFORM[panel];

// grupos no formato do accordion de Personalização (PANEL_INDICATORS-compatível)
export function socialIndGroups(panel: string): IndGroup[] {
  const cat = socialCatalog(panel);
  const order: string[] = [];
  const byGroup = new Map<string, { id: string; label: string; desc: string }[]>();
  for (const it of cat) {
    if (!byGroup.has(it.group)) { byGroup.set(it.group, []); order.push(it.group); }
    byGroup.get(it.group)!.push({ id: it.id, label: it.label, desc: it.desc || "" });
  }
  return order.map((g) => ({ g, i: byGroup.get(g)! }));
}

// default ON de um indicador (respeita a base da doc)
export function indDefaultOn(panel: string, id: string): boolean {
  const it = socialCatalog(panel).find((c) => c.id === id);
  return it ? it.def : true;
}

// indicador visível? config do workspace (paineis) sobrepõe o default da doc.
export function indShown(
  paineis: Record<string, Record<string, boolean>>,
  panel: string,
  id: string,
  custom = false
): boolean {
  const p = paineis[panel];
  if (p && id in p) return p[id] !== false;
  return custom ? true : indDefaultOn(panel, id);
}
