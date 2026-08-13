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

// métricas reais por plataforma — o catálogo "estudo por canal": só os indicadores que a rede
// REALMENTE entrega (verificado ao vivo). youtube/tiktok/linkedin corrigidos; threads sem métricas.
const PLATFORM_METRICS: Record<string, string[]> = {
  instagram: ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments",
    "shares", "saves", "replies", "reposts", "follows_and_unfollows", "profile_links_taps"],
  facebook: ["reach", "views", "total_interactions", "likes", "comments", "shares", "post_engagements"],
  // tiktok: 6 contadores lifetime (account-insights) — sem série
  tiktok: ["follower_count", "following_count", "likes_count", "video_count", "followers_gained", "followers_lost"],
  // youtube: channel-insights (totais no período) — sem série de canal
  youtube: ["views", "estimatedMinutesWatched", "subscribersGained", "subscribersLost"],
  // linkedin (pessoal): linkedin-aggregate (lifetime)
  linkedin: ["impressions", "reach", "reactions", "comments", "shares", "saves", "sends"],
  // threads: sem endpoint de analytics — só seguidores (KPI base)
  twitter: ["impressions", "likes", "replies", "reposts", "profile_visits", "engagements"],
};

// plataformas com caixa de entrada (inbox analytics)
const INBOX_PLATFORMS = new Set(["instagram", "facebook"]);
// plataformas com posting/série (daily-metrics, top conteúdos, best-time)
const POSTING_PLATFORMS = new Set(["instagram", "facebook", "tiktok"]);
// plataformas com "rendimento orgânico" / visitas ao site / taxas de marketing (base rica IG/FB)
const ORGANIC_PLATFORMS = new Set(["instagram", "facebook"]);
// plataformas com demografia de audiência
const DEMO_PLATFORMS = new Set(["instagram", "youtube"]);
// plataformas com série diária de seguidores (follower-history)
const FOLLOWER_CHART_PLATFORMS = new Set(["instagram", "facebook", "tiktok"]);
// métricas diárias uniformes (daily-metrics, derivadas dos posts)
const DAILY_METRICS = ["reach", "impressions", "views", "likes", "comments", "shares", "saves"];

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
  follower_count: "Seguidores", following_count: "Seguindo", likes_count: "Curtidas (total)",
  video_count: "Vídeos", followers_gained: "Seguidores ganhos", followers_lost: "Seguidores perdidos",
  // youtube (channel-insights)
  estimatedMinutesWatched: "Tempo de exibição (min)", subscribersGained: "Inscritos ganhos",
  subscribersLost: "Inscritos perdidos",
  // linkedin (aggregate)
  reactions: "Reações", sends: "Envios",
};
export const metricLabel = (k: string) => METRIC_LABEL[k] || k.replace(/_/g, " ");

// binding de um indicador → fonte de dado
export type IndBind =
  | { src: "follower" }        // KPI de seguidores (acct.followersCount / série)
  | { src: "followerChart" }   // gráfico de evolução de seguidores
  | { src: "metric"; key: string } // insights.metrics[key]
  | { src: "derived"; key: "eng_rate" | "reach_rate" | "save_rate" } // razão calculada
  | { src: "dailyChart"; key: string } // gráfico diário (daily-metrics)
  | { src: "posts" }           // seção "top conteúdos" (posting analytics)
  | { src: "content"; key: "organicShare" | "mix" } // orgânico vs impulsionado / mix por tipo
  | { src: "linkTaps"; key: string } // toques em links do perfil por tipo (WEBSITE/CALL/…)
  | { src: "stories" }         // stories ativos (IG)
  | { src: "inbox"; key: "volume" | "response" | "sources" | "chart" | "leads" } // conversas/DMs
  | { src: "demographics" }    // seção de audiência (idade/gênero/país/cidade)
  | { src: "none" };           // lacuna: dado não disponível

export interface CatItem {
  id: string; label: string; desc?: string;
  kind: "kpi" | "chart" | "section";
  bind: IndBind; def: boolean; group: string;
}

// lacunas nomeadas pela doc (mostradas como "sem dado" — não disponível na API)
const DOC_GAPS: Record<string, CatItem[]> = {
  instagram: [
    // origem das views por status de seguidor foi descontinuada pelo Meta (2024) — só manual
    { id: "splitFollowers", label: "Seguidores vs. não-seguidores", desc: "origem das views — indisponível (Meta descontinuou)", kind: "kpi", bind: { src: "none" }, def: true, group: "Alcance & mix" },
  ],
  youtube: [
    { id: "ctr_thumb", label: "CTR da miniatura", desc: "em breve (nível de vídeo)", kind: "kpi", bind: { src: "none" }, def: true, group: "Visualização" },
  ],
};

// catálogo COMPLETO de um painel social (default ON = base rica; tudo toggleável)
export function socialCatalog(panel: string): CatItem[] {
  const plat = PANEL_PLATFORM[panel];
  if (!plat) return [];
  const hasPosting = POSTING_PLATFORMS.has(plat);
  const items: CatItem[] = [
    { id: "seguidores", label: "Seguidores", desc: "base total + evolução", kind: "kpi", bind: { src: "follower" }, def: true, group: "Crescimento" },
  ];
  // evolução de seguidores (série) só onde a rede entrega follower-history
  if (FOLLOWER_CHART_PLATFORMS.has(plat)) {
    items.push({ id: "ch_followers", label: "Evolução de seguidores", desc: "série diária", kind: "chart", bind: { src: "followerChart" }, def: true, group: "Crescimento" });
  }
  // série diária (métrica-chave por dia) só onde há daily-metrics
  if (hasPosting) {
    items.push({ id: "ch_key", label: "Série diária", desc: "métrica-chave por dia (varia por período)", kind: "chart", bind: { src: "none" }, def: true, group: "Crescimento" });
  }
  for (const key of PLATFORM_METRICS[plat] || []) {
    items.push({
      id: "m_" + key, label: metricLabel(key), kind: "kpi",
      bind: { src: "metric", key }, def: true, group: "Indicadores",
    });
  }
  // razões calculadas (marketing) — dependem de alcance/interações/salvos (base IG/FB)
  if (ORGANIC_PLATFORMS.has(plat)) {
    items.push(
      { id: "der_eng_rate", label: "Taxa de engajamento", desc: "interações ÷ alcance", kind: "kpi", bind: { src: "derived", key: "eng_rate" }, def: true, group: "Taxas" },
      { id: "der_reach_rate", label: "Alcance sobre a base", desc: "alcance ÷ seguidores", kind: "kpi", bind: { src: "derived", key: "reach_rate" }, def: true, group: "Taxas" },
      { id: "der_save_rate", label: "Taxa de salvamento", desc: "salvos ÷ alcance", kind: "kpi", bind: { src: "derived", key: "save_rate" }, def: false, group: "Taxas" },
    );
  }
  // conteúdo: rendimento orgânico (IG/FB) + mix por tipo (qualquer rede com posting)
  if (ORGANIC_PLATFORMS.has(plat)) {
    items.push({ id: "organico", label: "Rendimento orgânico", desc: "alcance de posts orgânicos vs impulsionados", kind: "kpi", bind: { src: "content", key: "organicShare" }, def: true, group: "Alcance & mix" });
  }
  if (hasPosting) {
    items.push({ id: "content_mix", label: "Mix de conteúdo", desc: "reels/vídeos, carrosséis e imagens no período", kind: "section", bind: { src: "content", key: "mix" }, def: true, group: "Conteúdo" });
  }
  if (plat === "instagram") {
    // visitas ao site: dimensão WEBSITE de profile_links_taps (breakdown por tipo)
    items.push(
      { id: "link_website", label: "Visitas ao site", desc: "toques no link do site do perfil", kind: "kpi", bind: { src: "linkTaps", key: "WEBSITE" }, def: true, group: "Perfil" },
      { id: "link_call", label: "Toques em ligar", kind: "kpi", bind: { src: "linkTaps", key: "CALL" }, def: false, group: "Perfil" },
      { id: "link_email", label: "Toques em e-mail", kind: "kpi", bind: { src: "linkTaps", key: "EMAIL" }, def: false, group: "Perfil" },
      { id: "stories_count", label: "Stories ativos", desc: "stories publicados nas últimas 24h", kind: "kpi", bind: { src: "stories" }, def: true, group: "Conteúdo" },
    );
  }
  // gráficos diários (série que muda por período) — daily-metrics (só onde há posting)
  if (hasPosting) {
    items.push(
      { id: "d_reach", label: "Alcance por dia", desc: "série diária", kind: "chart", bind: { src: "dailyChart", key: "reach" }, def: true, group: "Séries diárias" },
      { id: "d_impressions", label: "Impressões por dia", kind: "chart", bind: { src: "dailyChart", key: "impressions" }, def: false, group: "Séries diárias" },
      { id: "d_likes", label: "Curtidas por dia", kind: "chart", bind: { src: "dailyChart", key: "likes" }, def: false, group: "Séries diárias" },
    );
    // top conteúdos (posting analytics) — REAL
    items.push({ id: "posts", label: "Top conteúdos", desc: "ranking por engajamento", kind: "section", bind: { src: "posts" }, def: true, group: "Conteúdo" });
  }
  // inbox (conversas/DMs)
  if (INBOX_PLATFORMS.has(plat)) {
    items.push(
      { id: "inbox_leads", label: "Leads orgânicos (DM)", desc: "conversas iniciadas pelo cliente", kind: "kpi", bind: { src: "inbox", key: "leads" }, def: true, group: "Conversas" },
      { id: "inbox_vol", label: "Conversas", desc: "recebidas, enviadas, únicas", kind: "kpi", bind: { src: "inbox", key: "volume" }, def: true, group: "Conversas" },
      { id: "inbox_rt", label: "Tempo de resposta", desc: "mediana das respostas", kind: "kpi", bind: { src: "inbox", key: "response" }, def: true, group: "Conversas" },
      { id: "inbox_chart", label: "Volume de conversas por dia", kind: "chart", bind: { src: "inbox", key: "chart" }, def: false, group: "Conversas" },
      { id: "inbox_src", label: "Fontes das conversas", kind: "section", bind: { src: "inbox", key: "sources" }, def: false, group: "Conversas" },
    );
  }
  if (DEMO_PLATFORMS.has(plat)) {
    items.push({ id: "audiencia", label: "Audiência (demografia)", desc: "idade, gênero, país, cidade", kind: "section", bind: { src: "demographics" }, def: true, group: "Audiência" });
  }
  for (const g of DOC_GAPS[panel] || []) items.push(g);
  return items;
}
void DAILY_METRICS;

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
