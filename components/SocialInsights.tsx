"use client";
// Dashboard de analytics social por workspace. Serve Instagram e os painéis de rede
// (canal/[rede]). Dado real quando a conta está conectada; estado vazio quando não.
// Layout portado 1:1 do painel Instagram do blueprint (viewInstagram): 4 KPIs, um card
// "Desempenho no tempo" com SELETOR de métrica (série diária cronológica), mix de
// conteúdo, seguidores, engajamento por tipo, rendimento orgânico, atividade & audiência,
// conversas, top conteúdos e heatmap de melhores horários. COMPARAÇÃO de períodos preservada.
import {
  Fragment, useEffect, useState,
  type CSSProperties, type ReactElement, type HTMLAttributes,
} from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageHead, KpiCard, DeltaChip, BarRow, MiniStat } from "@/components/ui";
import { Ic } from "@/components/Ic";
import { Chart } from "@/components/Chart";
import { Spinner } from "@/components/Spinner";
import { WidgetBoard, WidgetEditButton } from "@/components/WidgetBoard";
import { lineChart, barChart, type LineSeries } from "@/lib/charts";
import { fmt, kfmt, sum } from "@/lib/format";
import { daysInMonth, computeDelta, type Period } from "@/lib/scope";
import { REDES } from "@/lib/seed-data";
import { indShown } from "@/lib/indicators";
import type {
  AnalyticsResponse, DemographicsResponse, DailyMetricRow, PostAnalyticsResp,
  InboxVolume, InboxResponseTime, InboxSourceBreakdown, BestTimeSlot,
} from "@/lib/zernio";

// id da rede (Casinha) → plataforma da integração
const ZP: Record<string, string> = { x: "twitter" };
const zplat = (id: string) => ZP[id] || id;
// plataformas que têm analytics
const COM_ANALYTICS = new Set(["instagram", "facebook", "tiktok", "youtube", "linkedin", "twitter"]);
// plataformas com caixa de entrada (inbox)
const COM_INBOX = new Set(["instagram", "facebook"]);
// plataformas com posting/série diária (daily-metrics, top conteúdos, melhores horários)
const COM_POSTING = new Set(["instagram", "facebook", "tiktok"]);
// plataformas com "rendimento orgânico" (orgânico vs impulsionado) — base IG/FB
const COM_ORGANIC = new Set(["instagram", "facebook"]);

// URL do perfil público por plataforma (a partir de acct.username)
const PROFILE_URL: Record<string, (u: string) => string> = {
  instagram: (u) => `https://instagram.com/${u}`,
  tiktok: (u) => `https://tiktok.com/@${u}`,
  facebook: (u) => `https://facebook.com/${u}`,
  youtube: (u) => `https://youtube.com/@${u}`,
  twitter: (u) => `https://x.com/${u}`,
  linkedin: (u) => `https://linkedin.com/company/${u}`,
};

const METRIC_PT: Record<string, string> = {
  reach: "Alcance", reach_unique: "Alcance", impressions: "Impressões", views: "Visualizações",
  profile_views: "Visitas ao perfil", follower_count: "Seguidores", followers: "Seguidores",
  accounts_engaged: "Contas engajadas", total_interactions: "Interações", likes: "Curtidas",
  comments: "Comentários", shares: "Compart.", saves: "Salvos", subscribers: "Inscritos",
  watch_time: "Tempo de exibição", clicks: "Cliques", video_count: "Vídeos",
};
const pt = (k: string) => METRIC_PT[k] || k.replace(/_/g, " ");

// dimensões da audiência (demografia IG) → título PT
const DIM_PT: Record<string, string> = { age: "Idade", gender: "Gênero", country: "País", city: "Cidade" };
const DIM_ORDER = ["age", "gender", "country", "city"];
const GENDER_PT: Record<string, string> = {
  M: "Masculino", F: "Feminino", U: "Não informado",
  male: "Masculino", female: "Feminino", unknown: "Não informado",
};

// fontes das conversas (inbox) → PT
const SOURCE_PT: Record<string, string> = { contact: "Cliente", platform: "Nós", recipient: "Lidas" };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// razões calculadas (retornam fração; null se falta base)
type MetricMap = Record<string, { total: number }>;
function derived(key: string, m: MetricMap, followers?: number): number | null {
  const g = (k: string) => m[k]?.total ?? null;
  if (key === "eng_rate") { const i = g("total_interactions"), r = g("reach"); return i != null && r ? i / r : null; }
  if (key === "reach_rate") { const r = g("reach"); return r != null && followers ? r / followers : null; }
  if (key === "save_rate") { const s = g("saves"), r = g("reach"); return s != null && r ? s / r : null; }
  return null;
}
const pctFmt = (frac: number) => (frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
// engagementRate de post: pode vir como fração (0.05) ou já como percentual (5,0)
const erFmt = (v: number) => (v <= 1 ? v * 100 : v).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
// segundos → humano ("6s" / "26min" / "2h")
function humanDur(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}min`;
  return `${Math.round(sec / 3600)}h`;
}

// resposta da rota combinada
interface KeySeries { metric: string; label: string; total: number; values: { date: string; value: number }[] }
interface ContentSummary {
  total: number;
  organic: { count: number; reach: number; engagement: number };
  paid: { count: number; reach: number; engagement: number };
  byType: Record<string, number>;
  organicShare: number | null;
}
// item da grade "Últimas publicações" (posts mais recentes por data)
interface RecentPost {
  _id: string;
  url: string | null;
  publishedAt: string;
  thumbnail: string | null;
  isVideo: boolean;
  mediaType?: string;
  content?: string;
  isCollab?: boolean;
  // métricas de desempenho (só as que a API devolveu)
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
}
// selo de formato para a grade "Últimas publicações"
function recentFmtLabel(p: RecentPost): string {
  const mt = (p.mediaType || "").toLowerCase();
  if (mt.includes("carousel")) return "Carrossel";
  if (p.isVideo || mt.includes("reel") || mt.includes("video")) return "Reels";
  return "Post";
}
interface Combined {
  insights: AnalyticsResponse | null;          // metrics{key:{total,values?}}
  followers: AnalyticsResponse | null;          // metrics.follower_count.values
  keySeries: KeySeries | null;
  daily: DailyMetricRow[] | null;               // daily-metrics
  top: PostAnalyticsResp | null;                // posting analytics (top conteúdos)
  content: ContentSummary | null;               // orgânico vs impulsionado + mix por tipo
  recent: RecentPost[] | null;                  // últimas publicações (por data desc)
  linkTaps: Record<string, number> | null;      // toques em links do perfil por tipo (IG)
  stories: number | null;                       // stories ativos (IG)
  bestTime: BestTimeSlot[] | null;              // engajamento médio por dia da semana × hora
  demographics: DemographicsResponse | null;
}
const TYPE_PT: Record<string, string> = { video: "Reels / vídeos", image: "Imagens", carousel: "Carrosséis", other: "Outros" };
// resposta da rota de inbox (conversas/DMs)
interface InboxData {
  volume: InboxVolume | null;
  responseTime: InboxResponseTime | null;
  sources: InboxSourceBreakdown | null;
}

// caches de módulo (stale-while-revalidate): re-visitas abrem na hora, revalida em background.
// keyed por platform|accountId|since|until (o mesmo formato serve atual e comparação).
const INS_CACHE = new Map<string, Combined>();
const INBOX_CACHE = new Map<string, InboxData>();

function dateRange(scope: { period: Period; year: number; month: number; quarter: number; week: number }) {
  const { period, year, month, quarter, week } = scope;
  let since: Date, until: Date;
  if (period === "semana") {
    // janela = os 7 dias da semana selecionada dentro do mês (W1=1–7, W2=8–14, W3=15–21, W4=22–fim)
    const last = daysInMonth(year, month);
    const startDay = week * 7 + 1;
    const endDay = Math.min(startDay + 6, last);
    since = new Date(year, month, startDay);
    until = new Date(year, month, endDay);
  } else if (period === "trimestre") {
    since = new Date(year, quarter * 3, 1);
    until = new Date(year, quarter * 3 + 2, daysInMonth(year, quarter * 3 + 2));
  } else if (period === "ano") {
    until = new Date(year, 11, 31);
    since = new Date(year, 9, 2);
  } else {
    since = new Date(year, month, 1);
    until = new Date(year, month, daysInMonth(year, month));
  }
  const cap = 90 * 864e5;
  if (until.getTime() - since.getTime() > cap) since = new Date(until.getTime() - cap);
  return { since: iso(since), until: iso(until) };
}

const keyOf = (platform: string, accountId: string, since: string, until: string) =>
  `${platform}|${accountId}|${since}|${until}`;

// extrai os itens de uma dimensão da demografia, tolerante ao shape (breakdowns[dim] ou metrics[dim].breakdowns)
function demoItems(demo: DemographicsResponse | null, dim: string): { dimension: string; value: number }[] {
  if (!demo) return [];
  const fromReal = demo.demographics?.[dim];
  if (fromReal && fromReal.length) return fromReal;
  const fromTop = demo.breakdowns?.[dim];
  if (fromTop && fromTop.length) return fromTop;
  const fromMetric = demo.metrics?.[dim]?.breakdowns;
  if (fromMetric && fromMetric.length) return fromMetric;
  return [];
}

// sparkline minimalista (sem eixos) → string SVG normalizada, ~120x34, esticada via CSS
function sparkline(values: number[], color: string): string {
  const vals = values.filter((v) => v != null && isFinite(v));
  if (vals.length < 2) return "";
  const W = 120, H = 34, p = 3;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1, n = vals.length;
  const x = (i: number) => p + (i * (W - 2 * p)) / (n - 1);
  const y = (v: number) => p + (H - 2 * p) * (1 - (v - min) / span);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = "M" + pts.join(" L");
  const area = `${line} L${x(n - 1).toFixed(1)},${H - p} L${x(0).toFixed(1)},${H - p} Z`;
  const lx = x(n - 1).toFixed(1), ly = y(vals[n - 1]).toFixed(1);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="${area}" fill="${color}" opacity="0.10"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${lx}" cy="${ly}" r="2.4" fill="${color}"/></svg>`;
}

// aplica uma ordem salva a uma lista de cards: os ids salvos (presentes) primeiro, na ordem
// gravada; ids novos/desconhecidos vão pro fim, mantendo a ordem padrão (ordem de construção).
// rótulos amigáveis dos cards (usados na barra "Organizar" do WidgetBoard)
const SI_CARD_LABELS: Record<string, string> = {
  producao: "Produção de conteúdo", mix: "Mix de conteúdo", seguidores: "Seguidores", engajamento: "Engajamento",
  organico: "Orgânico vs impulsionado", atividade: "Atividade", conversas: "Conversas",
  top: "Top conteúdos", recentes: "Últimas publicações", horarios: "Melhores horários", audiencia: "Audiência",
};

export function SocialInsights({ rede }: { rede: string }) {
  const s = useStore();
  const platform = zplat(rede);
  const meta = REDES.find((r) => r.id === rede);
  const label = meta?.label || rede;
  const cor = meta?.cor || "#FF001E";
  const eyebrow = `CANAIS · ${label.toUpperCase()}`;
  // multi-conta: pode haver 2+ contas da MESMA plataforma no profile (ex. Instagram
  // SeaHub + Seabox). A conta exibida é a selecionada no store; default = primeira.
  const accts = s.zernioAccounts.filter((a) => a.platform === platform);
  const acct = accts.find((a) => a._id === s.selectedAccount[rede]) || accts[0] || null;
  const acctLabel = (a: (typeof accts)[number]) => a.username || a.displayName || "conta";

  const [data, setData] = useState<Combined | null>(null);
  const [cmpData, setCmpData] = useState<Combined | null>(null);
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // leads do CRM atribuídos a ESTE canal (match por nome do canal na saúde do CRM)
  const [crmCanal, setCrmCanal] = useState<{ total: number; ganho: number } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/crm/leads", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const ch: { canal?: string; total?: number; ganho?: number }[] = Array.isArray(d?.channelHealth) ? d.channelHealth : [];
        const ll = label.toLowerCase();
        const row = ch.find((c) => { const cn = String(c.canal || "").toLowerCase(); return cn && (cn.includes(ll) || ll.includes(cn)); });
        setCrmCanal(row ? { total: row.total || 0, ganho: row.ganho || 0 } : null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [label]);
  // ASSINATURA: métricas selecionadas do card "Desempenho no tempo" (multi-seleção, cruza indicadores)
  const [perfMetrics, setPerfMetrics] = useState<string[]>(["reach"]);
  // ENTREGA 2: tipo de visualização do card "Desempenho no tempo" (linha / barras)
  const [perfChart, setPerfChart] = useState<"line" | "bar">("line");
  // modo "organizar" (drag-and-drop dos cards reordenáveis) + card em arraste

  // fetch combinado (métricas + seguidores + série + daily + top + demografia) + comparação
  useEffect(() => {
    if (!acct || !COM_ANALYTICS.has(platform)) return;
    const cur = dateRange(s);
    const doCmp = s.scenario;
    const cmpR = doCmp ? dateRange(s.cmp) : null;
    const curKey = keyOf(platform, acct._id, cur.since, cur.until);
    const cmpKey = cmpR ? keyOf(platform, acct._id, cmpR.since, cmpR.until) : "";
    let alive = true;

    // stale-while-revalidate: mostra o cache na hora, revalida em background
    const cachedCur = INS_CACHE.get(curKey);
    const cachedCmp = cmpKey ? INS_CACHE.get(cmpKey) : null;
    if (cachedCur) {
      setData(cachedCur);
      setLoading(false);
    } else {
      setData(null);
      setLoading(true);
    }
    setCmpData(cachedCmp ?? null);
    setErr(null);

    const fetchOne = (since: string, until: string): Promise<Combined & { error?: string }> =>
      fetch(`/api/zernio/insights?platform=${platform}&accountId=${acct._id}&since=${since}&until=${until}`, { cache: "no-store" }).then((r) => r.json());

    Promise.all([
      fetchOne(cur.since, cur.until),
      cmpR ? fetchOne(cmpR.since, cmpR.until) : Promise.resolve(null),
    ])
      .then(([d, c]) => {
        if (!alive) return;
        if (d?.error) {
          if (!cachedCur) setErr(String(d.error));
        } else if (d) {
          INS_CACHE.set(curKey, d);
          setData(d);
        }
        if (c && !c.error && cmpKey) {
          INS_CACHE.set(cmpKey, c);
          setCmpData(c);
        }
      })
      .catch((e) => alive && !cachedCur && setErr(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    acct?._id, platform, s.period, s.year, s.month, s.quarter, s.week, s.scenario,
    s.cmp.period, s.cmp.year, s.cmp.month, s.cmp.quarter, s.cmp.week,
  ]);

  // fetch de inbox (conversas/DMs) — só onde a plataforma tem caixa de entrada. Estado
  // e cache próprios; período atual (sem comparação).
  useEffect(() => {
    if (!acct || !COM_INBOX.has(platform)) { setInbox(null); return; }
    const cur = dateRange(s);
    const key = keyOf(platform, acct._id, cur.since, cur.until);
    let alive = true;
    const cached = INBOX_CACHE.get(key);
    if (cached) setInbox(cached);
    fetch(`/api/zernio/inbox?accountId=${acct._id}&platform=${platform}&since=${cur.since}&until=${cur.until}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: InboxData & { error?: string }) => {
        if (!alive || d?.error) return;
        INBOX_CACHE.set(key, d);
        setInbox(d);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acct?._id, platform, s.period, s.year, s.month, s.quarter, s.week]);

  if (!acct) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={label} desc="Métricas reais unificadas das contas conectadas." />
        <div className="empty">
          <div className="e-ico" style={{ fontSize: 22 }}>🔌</div>
          <h3>{label} não conectado</h3>
          <p>
            Conecte a conta em{" "}
            <Link href="/personalizacao" style={{ color: "var(--cyan)", fontWeight: 650 }}>
              Personalização → Conexões
            </Link>{" "}
            para ver as métricas reais aqui.
          </p>
        </div>
      </>
    );
  }

  const comparando = s.scenario;
  const range = dateRange(s);
  const cmpRange = comparando ? dateRange(s.cmp) : null;

  const ins = data?.insights || null;
  const foll = data?.followers || null;
  const daily = data?.daily || null;
  const cmpDaily = cmpData?.daily || null;
  const top = data?.top || null;
  const content = data?.content || null;
  const recent = data?.recent || null;
  const linkTaps = data?.linkTaps || null;
  const demo = data?.demographics || null;
  const stories = data?.stories ?? null;
  const cmpIns = cmpData?.insights || null;
  const cmpFoll = cmpData?.followers || null;
  const bestTime = data?.bestTime || null;

  const metrics = ins?.metrics || {};

  // série de seguidores (atual + comparação tracejada)
  const follVals = foll?.metrics?.follower_count?.values || [];
  const cmpFollVals = cmpFoll?.metrics?.follower_count?.values || [];
  const curFollLast = follVals.length ? follVals[follVals.length - 1].value : acct.followersCount ?? null;
  const cmpFollLast = cmpFollVals.length ? cmpFollVals[cmpFollVals.length - 1].value : null;

  // legenda enxuta: o período já está explícito na toolbar e o perfil no seletor/título —
  // então só mostramos a nota de comparação quando há comparação ativa (evita redundância).
  const desc = cmpRange
    ? `Comparando ${range.since}→${range.until} vs ${cmpRange.since}→${cmpRange.until}`
    : "";

  // ── indicadores por CONFIG (Personalização liga/desliga); cada card opcional respeita shown(id) ──
  const shown = (id: string, custom = false) => indShown(s.paineis, rede, id, custom);

  const profileUrl = acct.username && PROFILE_URL[platform] ? PROFILE_URL[platform](acct.username) : null;
  const anyData =
    ins != null || acct.followersCount != null ||
    (daily?.length ?? 0) > 0 || (top?.posts?.length ?? 0) > 0;

  // ── números compilados (só o que tem dado) ──
  const reachDaily = daily && daily.length ? sum(daily.map((r) => r.metrics.reach || 0)) : null;
  const reachTotal = reachDaily != null ? reachDaily : metrics.reach?.total ?? null;
  const cmpReachDaily = cmpDaily && cmpDaily.length ? sum(cmpDaily.map((r) => r.metrics.reach || 0)) : null;
  const cmpReachTotal = comparando ? (cmpReachDaily != null ? cmpReachDaily : cmpIns?.metrics?.reach?.total ?? null) : null;

  const followersCount = acct.followersCount ?? null;
  const viewsTotal = metrics.views?.total ?? null;
  const interactionsTotal = metrics.total_interactions?.total ?? null;
  const cmpViewsTotal = comparando ? cmpIns?.metrics?.views?.total ?? null : null;
  const cmpInterTotal = comparando ? cmpIns?.metrics?.total_interactions?.total ?? null : null;

  const fGained = metrics.followers_gained?.total ?? null;
  const fLost = metrics.followers_lost?.total ?? null;
  const fUnf = metrics.follows_and_unfollows?.total ?? null;
  const net = fUnf != null ? fUnf : (fGained != null && fLost != null ? fGained - fLost : null);
  const novos = fGained ?? (fUnf != null && fUnf >= 0 ? fUnf : null);
  const saida = fLost ?? (fUnf != null && fUnf < 0 ? -fUnf : null);

  const hasInbox = COM_INBOX.has(platform);
  const accountsEngaged = metrics.accounts_engaged?.total ?? null;

  // ── KPIs-herói POR PLATAFORMA (estudo por canal): cada rede mostra os indicadores reais dela ──
  const mtot = (k: string) => metrics[k]?.total ?? null;
  const cmpMtot = (k: string) => (comparando ? cmpIns?.metrics?.[k]?.total ?? null : null);
  const viewsDaily = daily && daily.length ? sum(daily.map((r) => r.metrics.views || 0)) : null;
  interface Hero { lbl: string; val: string; foot?: string; cur?: number | null; cmp?: number | null }
  let heroes: Hero[];
  if (platform === "youtube") {
    const netSub =
      mtot("subscribersGained") != null || mtot("subscribersLost") != null
        ? (mtot("subscribersGained") ?? 0) - (mtot("subscribersLost") ?? 0)
        : null;
    heroes = [
      { lbl: "Inscritos", val: followersCount != null ? fmt(followersCount) : "—", foot: netSub != null ? `líquido ${netSub >= 0 ? "+" : ""}${fmt(netSub)} no período` : undefined, cur: followersCount, cmp: cmpFollLast },
      { lbl: "Visualizações", val: mtot("views") != null ? kfmt(mtot("views")!) : "—", foot: "no período", cur: mtot("views"), cmp: cmpMtot("views") },
      { lbl: "Tempo de exibição", val: mtot("estimatedMinutesWatched") != null ? `${kfmt(mtot("estimatedMinutesWatched")!)} min` : "—", foot: "estimado", cur: mtot("estimatedMinutesWatched"), cmp: cmpMtot("estimatedMinutesWatched") },
      { lbl: "Inscritos líquidos", val: netSub != null ? `${netSub >= 0 ? "+" : ""}${fmt(netSub)}` : "—", foot: "ganhos − perdidos" },
    ];
  } else if (platform === "tiktok") {
    heroes = [
      { lbl: "Seguidores", val: followersCount != null ? fmt(followersCount) : "—", foot: net != null ? `líquido ${net >= 0 ? "+" : ""}${fmt(net)} no período` : undefined, cur: followersCount, cmp: cmpFollLast },
      { lbl: "Curtidas (total)", val: mtot("likes_count") != null ? kfmt(mtot("likes_count")!) : "—", foot: "acumulado", cur: mtot("likes_count"), cmp: cmpMtot("likes_count") },
      { lbl: "Vídeos", val: mtot("video_count") != null ? fmt(mtot("video_count")!) : "—", foot: "publicados", cur: mtot("video_count"), cmp: cmpMtot("video_count") },
      { lbl: "Visualizações", val: viewsDaily != null ? kfmt(viewsDaily) : "—", foot: "no período" },
    ];
  } else if (platform === "linkedin") {
    const liInter =
      mtot("reactions") != null || mtot("comments") != null || mtot("shares") != null
        ? (mtot("reactions") ?? 0) + (mtot("comments") ?? 0) + (mtot("shares") ?? 0)
        : null;
    heroes = [
      { lbl: "Seguidores", val: followersCount != null ? fmt(followersCount) : "—", foot: "base atual", cur: followersCount, cmp: cmpFollLast },
      { lbl: "Impressões", val: mtot("impressions") != null ? kfmt(mtot("impressions")!) : "—", foot: "acumulado", cur: mtot("impressions"), cmp: cmpMtot("impressions") },
      { lbl: "Alcance", val: mtot("reach") != null ? kfmt(mtot("reach")!) : "—", foot: "acumulado", cur: mtot("reach"), cmp: cmpMtot("reach") },
      { lbl: "Interações", val: liInter != null ? fmt(liInter) : "—", foot: "reações + coment. + compart." },
    ];
  } else if (platform === "threads") {
    heroes = [
      { lbl: "Seguidores", val: followersCount != null ? fmt(followersCount) : "—", foot: "base atual", cur: followersCount, cmp: cmpFollLast },
    ];
  } else {
    // instagram / facebook (base rica original)
    heroes = [
      { lbl: "Seguidores", val: followersCount != null ? fmt(followersCount) : "—", foot: net != null ? `líquido ${net >= 0 ? "+" : ""}${fmt(net)} no período` : undefined, cur: followersCount, cmp: cmpFollLast },
      { lbl: "Contas alcançadas", val: reachTotal != null ? kfmt(reachTotal) : "—", foot: "alcance", cur: reachTotal, cmp: cmpReachTotal },
      { lbl: "Visualizações", val: viewsTotal != null ? kfmt(viewsTotal) : "—", foot: "impressões", cur: viewsTotal, cmp: cmpViewsTotal },
      { lbl: "Interações", val: interactionsTotal != null ? kfmt(interactionsTotal) : "—", foot: "engajamento bruto", cur: interactionsTotal, cmp: cmpInterTotal },
    ];
  }
  const isLimited = platform === "threads";

  // ── card "Desempenho no tempo" (assinatura): MULTI-seleção → cruza indicadores na mesma série ──
  const PERF_OPTS: { v: string; l: string }[] = [
    { v: "reach", l: "Alcance" }, { v: "impressions", l: "Impressões" }, { v: "views", l: "Visualizações" },
    { v: "likes", l: "Curtidas" }, { v: "comments", l: "Comentários" }, { v: "shares", l: "Compart." }, { v: "saves", l: "Salvos" },
  ];
  // cor distinta por métrica (paleta pequena, mapeada por chave)
  const PERF_COLORS: Record<string, string> = {
    reach: "#FF001E", views: "#00BBC5", impressions: "#8E5BE0",
    likes: "#FF9F0A", comments: "#2FB457", shares: "#111111", saves: "#E6689C",
  };
  const perfLbl = (v: string) => PERF_OPTS.find((o) => o.v === v)?.l || v;
  const perfColor = (v: string) => PERF_COLORS[v] || cor;
  // clicar adiciona/remove; sempre mantém ≥1 métrica ativa
  const togglePerf = (v: string) =>
    setPerfMetrics((prev) =>
      prev.includes(v) ? (prev.length > 1 ? prev.filter((x) => x !== v) : prev) : [...prev, v]
    );
  const dget = (r: DailyMetricRow, k: string) => (r.metrics as Record<string, number>)[k] ?? 0;
  const showPerf = !!daily && daily.length > 0;
  const CHART_TYPES: { v: "line" | "bar"; l: string }[] = [
    { v: "line", l: "Linha" }, { v: "bar", l: "Barras" },
  ];
  // svg do card "Desempenho no tempo" conforme o tipo escolhido — MESMA informação, visual diferente
  function perfSvg(): string {
    if (!daily || !daily.length) return "";
    const metricTotal = (m: string) => sum(daily.map((r) => dget(r, m)));
    if (perfChart === "bar") {
      // 1 métrica → barras por dia; várias → barra do total de cada métrica
      if (perfMetrics.length === 1) {
        const m = perfMetrics[0];
        return barChart(daily.map((r) => r.date.slice(5)), daily.map((r) => dget(r, m)), perfColor(m), { h: 250, name: perfLbl(m) });
      }
      return barChart(perfMetrics.map(perfLbl), perfMetrics.map(metricTotal), perfMetrics.map(perfColor), { h: 250 });
    }
    // linha (default) — multi-série + comparação tracejada
    return lineChart(
      daily.map((r) => r.date.slice(5)),
      [
        ...perfMetrics.map((m) => ({
          name: perfLbl(m), color: perfColor(m), data: daily.map((r) => dget(r, m)),
          fill: perfMetrics.length === 1,
        } as LineSeries)),
        ...(comparando && cmpDaily && cmpDaily.length
          ? [{
              name: `Comparação · ${perfLbl(perfMetrics[0])}`, color: perfColor(perfMetrics[0]),
              data: cmpDaily.slice(0, daily.length).map((r) => dget(r, perfMetrics[0])), dash: true,
            } as LineSeries]
          : []),
      ],
      { h: 250, sel: daily.length - 1 }
    );
  }

  // ── Mix de conteúdo (por tipo de mídia) ──
  const mixRows = content ? Object.entries(content.byType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  const mixTop = mixRows.length ? (TYPE_PT[mixRows[0][0]] || mixRows[0][0]) : null;
  const showMix = !!content && content.total > 0 && mixRows.length > 0;

  // ── Engajamento por tipo ──
  const engTypeRows = ([
    { k: "Curtidas", key: "likes" }, { k: "Reações", key: "reactions" }, { k: "Compartilhamentos", key: "shares" },
    { k: "Salvos", key: "saves" }, { k: "Comentários", key: "comments" }, { k: "Reposts", key: "reposts" },
  ] as const).filter((r) => metrics[r.key] != null);
  const engTypeMax = Math.max(1, ...engTypeRows.map((r) => metrics[r.key].total));
  const engTypeSum = sum(engTypeRows.map((r) => metrics[r.key].total));

  // ── Rendimento orgânico (só IG/FB) ──
  const showOrganic = COM_ORGANIC.has(platform) && shown("organico") && !!content;
  // ── Melhores horários / posting-derived (só redes com posting) ──
  const showHorarios = COM_POSTING.has(platform);

  // ── Seguidores ──
  const showSeg = shown("seguidores") && (novos != null || saida != null || followersCount != null);
  const showFollChart = shown("ch_followers") && follVals.length > 0;

  // ── Atividade & audiência ──
  const showActivity = (shown("link_website") || accountsEngaged != null) && (accountsEngaged != null || linkTaps != null);

  // ── Conversas ──
  const inboxLeads = (() => {
    const src = inbox?.sources?.sources?.find((x) => x.source === "contact");
    return src ? src.received : inbox?.volume?.summary.received ?? null;
  })();
  const showConv = hasInbox && !!inbox && (inbox.volume != null || inbox.responseTime != null || inbox.sources != null);
  const showConvChart = shown("inbox_chart") && !!inbox?.volume && inbox.volume.timeseries.length > 0;

  // ── Top conteúdos ──
  const showTop = shown("posts") && !!top?.posts && top.posts.length > 0;

  // ── Melhores horários: heatmap dia (Seg..Dom) × turno (Manhã/Tarde/Noite) a partir de bestTime ──
  const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const TURNOS: { nome: string; from: number; to: number }[] = [
    { nome: "Manhã", from: 6, to: 12 }, { nome: "Tarde", from: 12, to: 18 }, { nome: "Noite", from: 18, to: 24 },
  ];
  const heatGrid = TURNOS.map(() => new Array<number>(7).fill(0));
  if (bestTime) {
    for (const slot of bestTime) {
      const ti = TURNOS.findIndex((t) => slot.hour >= t.from && slot.hour < t.to);
      if (ti < 0) continue;
      const col = (slot.day_of_week + 6) % 7; // 0=Dom..6=Sáb → coluna Seg..Dom
      heatGrid[ti][col] += slot.avg_engagement || 0;
    }
  }
  const heatMax = Math.max(0, ...heatGrid.flat());
  const hasHeat = !!bestTime && bestTime.length > 0 && heatMax > 0;

  // ── Audiência (demografia IG): idade/gênero/país/cidade ──
  const demoDims = demo ? DIM_ORDER.map((dim) => ({ dim, items: demoItems(demo, dim) })).filter((d) => d.items.length) : [];
  const showDemo = shown("audiencia") && demoDims.length > 0;

  // ── Cards REORDENÁVEIS (drag) ──
  // Cada card renderizável ganha um id estável e entra numa lista única, construída na ordem
  // padrão (só os visíveis). A ordem salva por workspace é aplicada; ids novos vão pro fim.
  type CardDef = { id: string; node: ReactElement<HTMLAttributes<HTMLDivElement>>; full?: boolean };
  const cards: CardDef[] = [];

  // Produção de conteúdo & leads deste canal (calendário + CRM + DMs)
  {
    const cur = dateRange(s);
    const dSince = new Date(cur.since), dUntil = new Date(cur.until);
    const canalPosts = s.posts.filter((p) => p.canal === label && (() => { const d = new Date(p.y, p.m, p.d); return d >= dSince && d <= dUntil; })());
    const porFormato: Record<string, number> = {};
    for (const p of canalPosts) { const f = (p.formato || "—").trim() || "—"; porFormato[f] = (porFormato[f] || 0) + 1; }
    const fmts = Object.entries(porFormato).sort((a, b) => b[1] - a[1]);
    const mxF = Math.max(1, ...fmts.map(([, n]) => n));
    const dmLeads = inbox?.volume ? inbox.volume.summary.uniqueConversations : null;
    cards.push({ id: "producao", node: (
      <div className="card pad-lg">
        <div className="card-head"><div><div className="t">Produção de conteúdo</div><div className="sub">no período · {label}</div></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10, marginTop: 6 }}>
          <MiniStat l="Conteúdos" n={String(canalPosts.length)} />
          <MiniStat l="Leads (CRM)" n={crmCanal ? fmt(crmCanal.total) : "—"} />
          <MiniStat l="Leads via DM" n={dmLeads != null ? fmt(dmLeads) : "—"} />
        </div>
        {fmts.length > 0 && (
          <div className="si-dim" style={{ marginTop: 12 }}>
            <h5>Por formato</h5>
            {fmts.map(([f, n]) => <BarRow key={f} k={f} v={n} max={mxF} color={cor} formatted={String(n)} />)}
          </div>
        )}
      </div>
    ) });
  }

  if (showMix && content) cards.push({ id: "mix", node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "var(--ink)" } as CSSProperties}>
      <div className="card-head">
        <div className="t">Mix de conteúdo</div>
        {mixTop && <span className="badge">Vencedor: {mixTop}</span>}
      </div>
      {mixRows.map(([t, v]) => (
        <BarRow key={t} k={TYPE_PT[t] || t} v={v} max={content.total} color={cor} formatted={fmt(v)} />
      ))}
      {mixTop && (
        <div className="insight" style={{ marginTop: 14 }}>
          <div className="ib" style={{ background: cor }}><Ic name="overview" /></div>
          <p><b>{mixTop}</b> lidera o alcance no período.</p>
        </div>
      )}
      {stories != null && stories > 0 && (
        <div style={{ fontSize: 12, color: "var(--label-3)", marginTop: 10 }}>Stories ativos: {fmt(stories)}</div>
      )}
    </div>
  ) });

  if (showSeg) cards.push({ id: "seguidores", node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "var(--cyan)" } as CSSProperties}>
      <div className="card-head"><div className="t">Seguidores</div></div>
      <div className="mini">
        <MiniStat l="Novos seguidores" n={novos != null ? fmt(novos) : "—"} />
        <MiniStat l="Deixaram de seguir" n={saida != null ? fmt(saida) : "—"} />
        <MiniStat l="Crescimento líquido" n={net != null ? `${net >= 0 ? "+" : ""}${fmt(net)}` : "—"} />
        <MiniStat l="Total atual" n={followersCount != null ? fmt(followersCount) : "—"} />
      </div>
      {showFollChart && (
        <div style={{ marginTop: 14 }}>
          <Chart svg={lineChart(
            follVals.map((v) => v.date.slice(5)),
            [
              { name: "Seguidores", color: cor, data: follVals.map((v) => v.value), fill: true },
              ...(comparando && cmpFollVals.length
                ? [{ name: "Comparação", color: cor, data: cmpFollVals.slice(0, follVals.length).map((v) => v.value), dash: true } as LineSeries]
                : []),
            ],
            { h: 200, sel: follVals.length - 1 }
          )} />
        </div>
      )}
    </div>
  ) });

  if (engTypeRows.length > 0) cards.push({ id: "engajamento", node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "var(--red)" } as CSSProperties}>
      <div className="card-head">
        <div>
          <div className="t">Engajamento por tipo</div>
          <div className="sub tnum">{fmt(engTypeSum)} interações</div>
        </div>
      </div>
      {engTypeRows.map((r) => (
        <BarRow key={r.key} k={r.k} v={metrics[r.key].total} max={engTypeMax} color="var(--cyan)" formatted={fmt(metrics[r.key].total)} />
      ))}
    </div>
  ) });

  if (showOrganic && content) cards.push({ id: "organico", node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "var(--red)" } as CSSProperties}>
      <div className="card-head">
        <div>
          <div className="t">Rendimento orgânico</div>
          <div className="sub">{content.organicShare != null ? `${pctFmt(content.organicShare)} orgânico` : "sem dado no período"}</div>
        </div>
      </div>
      {(() => {
        const orMax = Math.max(1, content.organic.reach, content.paid.reach);
        return (
          <>
            <BarRow k="Orgânico" v={content.organic.reach} max={orMax} color={cor} formatted={kfmt(content.organic.reach)} />
            <BarRow k="Impulsionado" v={content.paid.reach} max={orMax} color="#8E8E93" formatted={kfmt(content.paid.reach)} />
          </>
        );
      })()}
      <div className="insight" style={{ marginTop: 12 }}>
        <div className="ib" style={{ background: "var(--cyan)" }}><Ic name="ads" /></div>
        <p>{content.organicShare != null
          ? <><b>{pctFmt(content.organicShare)}</b> do alcance veio de conteúdo orgânico (não-impulsionado).</>
          : "Sem alcance orgânico registrado neste período."}</p>
      </div>
    </div>
  ) });

  if (showActivity) cards.push({ id: "atividade", node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "var(--atencao)" } as CSSProperties}>
      <div className="card-head"><div className="t">Atividade &amp; audiência</div></div>
      <div className="mini">
        {accountsEngaged != null && <MiniStat l="Atividades no perfil" n={fmt(accountsEngaged)} />}
        <MiniStat l="Visitas ao site" n={linkTaps?.WEBSITE != null ? fmt(linkTaps.WEBSITE) : "—"} />
        {shown("link_call") && <MiniStat l="Toques em ligar" n={linkTaps?.CALL != null ? fmt(linkTaps.CALL) : "—"} />}
        {shown("link_email") && <MiniStat l="Toques em e-mail" n={linkTaps?.EMAIL != null ? fmt(linkTaps.EMAIL) : "—"} />}
      </div>
    </div>
  ) });

  if (showConv) cards.push({ id: "conversas", node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "var(--excelente)" } as CSSProperties}>
      <div className="card-head"><div className="t">Conversas</div></div>
      <div className="mini">
        <MiniStat l="Leads (DM)" n={inboxLeads != null ? fmt(inboxLeads) : "—"} />
        <MiniStat l="Conversas" n={inbox?.volume ? fmt(inbox.volume.summary.uniqueConversations) : "—"} />
        <MiniStat l="Tempo de resposta" n={inbox?.responseTime && inbox.responseTime.summary.sampleSize > 0 ? humanDur(inbox.responseTime.summary.medianSeconds) : "—"} />
      </div>
      {showConvChart && inbox?.volume && (
        <div style={{ marginTop: 14 }}>
          <Chart svg={lineChart(
            inbox.volume.timeseries.map((t) => t.date.slice(5)),
            [
              { name: "recebidas", color: cor, data: inbox.volume.timeseries.map((t) => t.received), fill: true },
              { name: "enviadas", color: "#8E8E93", data: inbox.volume.timeseries.map((t) => t.sent) },
            ],
            { h: 200, sel: inbox.volume.timeseries.length - 1 }
          )} />
        </div>
      )}
    </div>
  ) });

  if (showTop && top?.posts) cards.push({ id: "top", node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "var(--ink)" } as CSSProperties}>
      <div className="card-head">
        <div>
          <div className="t">{platform === "tiktok" || platform === "youtube" ? "Top vídeos do período" : "Top conteúdos do período"}</div>
          <div className="sub">por engajamento · com o porquê de cada destaque</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {top.posts.slice(0, 6).map((p, i) => {
          const a = p.analytics || {};
          const txt = (p.content || "").replace(/\s+/g, " ").trim();
          const short = txt.length > 80 ? txt.slice(0, 80) + "…" : txt || "(sem legenda)";
          const mt = (p as { mediaType?: string }).mediaType;
          const fmtLabel = mt ? (TYPE_PT[String(mt).toLowerCase()] || String(mt)) : null;
          const data = p.publishedAt ? p.publishedAt.slice(0, 10).split("-").reverse().join("/") : null;
          const hora = p.publishedAt && p.publishedAt.length >= 16 ? p.publishedAt.slice(11, 16) : null;

          // métricas que a API devolveu (sem invenção)
          const met: { v: number; t: string }[] = [];
          if (a.likes != null) met.push({ v: a.likes, t: "❤" });
          if (a.comments != null) met.push({ v: a.comments, t: "💬" });
          if (a.shares != null) met.push({ v: a.shares, t: "↗" });
          if (a.saves != null) met.push({ v: a.saves, t: "🔖" });
          if (a.reach != null) met.push({ v: a.reach, t: "alcance" });
          if (a.views != null) met.push({ v: a.views, t: "views" });

          // "por que se destacou": qual métrica puxou + formato/horário (interpretação factual)
          const driver = a.engagementRate != null ? `engajamento de ${erFmt(a.engagementRate)}`
            : a.reach != null ? `alcance de ${kfmt(a.reach)}`
            : a.views != null ? `${kfmt(a.views)} visualizações`
            : a.likes != null ? `${fmt(a.likes)} curtidas` : null;
          const why = [
            driver ? `Puxado por ${driver}` : null,
            fmtLabel ? `formato ${fmtLabel}` : null,
            hora ? `publicado ${data} às ${hora}` : data ? `publicado ${data}` : null,
          ].filter(Boolean).join(" · ");

          return (
            <div key={p._id} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 12, borderBottom: i < Math.min(6, top.posts!.length) - 1 ? "1px solid var(--hairline)" : "none" }}>
              <span className="rank" style={{ flex: "0 0 auto" }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tt" style={{ fontWeight: 600 }}>{short}</div>
                {/* linha de formato/data/hora + link */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, fontSize: 11.5, color: "var(--label-3)" }}>
                  {fmtLabel && <span style={{ padding: "1px 7px", borderRadius: 999, background: "var(--cream)", fontWeight: 600 }}>{fmtLabel}</span>}
                  {data && <span className="tnum">{data}{hora ? ` · ${hora}` : ""}</span>}
                  {p.platformPostUrl && <a href={p.platformPostUrl} target="_blank" rel="noopener" style={{ color: "var(--cyan)" }}>abrir ↗</a>}
                </div>
                {/* métricas de desempenho */}
                {met.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6, fontSize: 12, color: "var(--label-2)" }} className="tnum">
                    {met.map((m, k) => (
                      <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <span aria-hidden="true" style={{ fontSize: 11 }}>{m.t}</span>{fmt(m.v)}
                      </span>
                    ))}
                  </div>
                )}
                {/* por que se destacou */}
                {why && <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--label-2)", fontStyle: "italic" }}>{why}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  ) });

  // ── Últimas publicações (grade recente do perfil, por DATA — distinto do "top" por engajamento) ──
  if (recent && recent.length > 0) cards.push({ id: "recentes", full: true, node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "var(--cyan)" } as CSSProperties}>
      <div className="card-head">
        <div>
          <div className="t">Últimas publicações</div>
          <div className="sub">grade recente do perfil · por data</div>
        </div>
      </div>
      {/* grade 3-em-3 (2 no tablet, 1 no mobile) — cada card mostra mídia, legenda e desempenho */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16, marginTop: 6 }} className="si-recent-grid">
        {recent.map((p) => {
          const dt = p.publishedAt ? p.publishedAt.slice(0, 10).split("-").reverse().join("/") : "";
          const badge = recentFmtLabel(p);
          const legenda = (p.content || "").trim();
          // linha de desempenho — só as métricas que a API devolveu
          const met: { ic: string; v: number; t: string }[] = [];
          if (p.likes != null) met.push({ ic: "❤", v: p.likes, t: "curtidas" });
          if (p.comments != null) met.push({ ic: "💬", v: p.comments, t: "comentários" });
          if (p.shares != null) met.push({ ic: "↗", v: p.shares, t: "compartilhamentos" });
          if (p.saves != null) met.push({ ic: "🔖", v: p.saves, t: "salvos" });
          const inner = (
            <>
              <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", background: "var(--cream)", border: "1px solid var(--hairline, rgba(0,0,0,0.06))" }}>
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", fontSize: 34, opacity: 0.4 }}>🖼️</div>
                )}
                <span style={{ position: "absolute", top: 8, left: 8, padding: "3px 9px", borderRadius: 999, background: "rgba(0,0,0,0.66)", color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}>{badge}</span>
                {p.isCollab && (
                  <span aria-label="colaborativo" style={{ position: "absolute", top: 8, right: 8, padding: "3px 9px", borderRadius: 999, background: "var(--cyan)", color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}>Colab</span>
                )}
              </div>
              {/* legenda — 2 linhas de contexto do conteúdo */}
              {legenda ? (
                <div style={{ fontSize: 12.5, color: "var(--label)", marginTop: 9, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as CSSProperties}>
                  {legenda}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--label-3)", marginTop: 9, fontStyle: "italic" }}>sem legenda</div>
              )}
              <div style={{ fontSize: 11.5, color: "var(--label-3)", marginTop: 6 }} className="tnum">{dt}</div>
              {met.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 5, fontSize: 12.5, color: "var(--label-2)" }} className="tnum">
                  {met.map((m, i) => (
                    <span key={i} title={m.t} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <span aria-hidden="true" style={{ fontSize: 12 }}>{m.ic}</span>{fmt(m.v)}
                    </span>
                  ))}
                </div>
              )}
            </>
          );
          return p.url ? (
            <a key={p._id} href={p.url} target="_blank" rel="noopener" title="Abrir publicação ↗" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              {inner}
            </a>
          ) : (
            <div key={p._id}>{inner}</div>
          );
        })}
      </div>
    </div>
  ) });

  if (showHorarios) cards.push({ id: "horarios", node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "#8E5BE0" } as CSSProperties}>
      <div className="card-head">
        <div>
          <div className="t">Melhores horários</div>
          <div className="sub">engajamento médio por dia × turno (0–100)</div>
        </div>
      </div>
      {hasHeat ? (
        <div className="heat">
          <div />
          {DIAS.map((d) => <div key={d} className="hh">{d}</div>)}
          {TURNOS.map((t, ti) => (
            <Fragment key={t.nome}>
              <div className="hh" style={{ justifyContent: "flex-end", paddingRight: 4 }}>{t.nome}</div>
              {heatGrid[ti].map((val, ci) => {
                const nv = heatMax > 0 ? val / heatMax : 0;
                return <div key={ci} className="hc" style={{ background: `rgba(0,187,197,${(0.14 + nv * 0.86).toFixed(2)})` }}>{Math.round(nv * 100)}</div>;
              })}
            </Fragment>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--label-3)" }}>sem dados de horário no período</div>
      )}
    </div>
  ) });

  if (showDemo) cards.push({ id: "audiencia", full: true, node: (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": "var(--atencao)" } as CSSProperties}>
      <div className="card-head">
        <div><div className="t">Audiência</div><div className="sub">{platform === "youtube" ? "quem assiste · espectadores (%)" : "quem segue o perfil · por seguidores"}</div></div>
      </div>
      <div className="si-demo">
        {demoDims.map(({ dim, items }) => {
          // GÊNERO: tira "não informado" (U/unknown) — os não declarados distorcem o % de M/F
          const base = dim === "gender" ? items.filter((t) => !["u", "unknown", "não informado", "nao informado"].includes(String(t.dimension).toLowerCase())) : items;
          const tops = [...base].sort((a, b) => b.value - a.value).slice(0, 6);
          const mx = Math.max(1, ...tops.map((t) => t.value));
          return (
            <div key={dim} className="si-dim">
              <h5>{DIM_PT[dim] || dim}</h5>
              {tops.map((t, i) => (
                <BarRow
                  key={i}
                  k={dim === "gender" ? GENDER_PT[t.dimension] || t.dimension : t.dimension}
                  v={t.value}
                  max={mx}
                  color={cor}
                  formatted={fmt(t.value)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  ) });

  // organização dos cards agora é via WidgetBoard (mode flow). cards[] é mapeado direto pra ele.

  return (
    <>
      <PageHead
        eyebrow={eyebrow}
        title={label}
        desc={desc}
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {cards.length > 0 && <WidgetEditButton panel={`rede:${rede}`} />}
            {profileUrl && (
              <a className="btn-link" href={profileUrl} target="_blank" rel="noopener">Abrir perfil ↗</a>
            )}
          </div>
        }
      />
      {/* Seletor de conta: SÓ aparece em multi-conta (2+ contas da mesma rede). Com 1 conta,
          fica oculto — o título do painel já identifica a conta (menos ruído visual). */}
      {accts.length >= 2 && (
        <div
          role="group"
          aria-label="Selecionar conta"
          style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            margin: "0 0 16px", padding: "10px 12px", background: "var(--cream)",
            borderRadius: 12, border: "1px solid var(--hairline, rgba(0,0,0,0.06))",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--label-2)" }}>Conta:</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {accts.map((a) => {
              const on = acct?._id === a._id;
              const nm = a.username ? "@" + a.username : acctLabel(a);
              return (
                <button
                  key={a._id}
                  type="button"
                  aria-pressed={on}
                  title={a.displayName || a.username || "conta"}
                  onClick={() => s.setSelectedAccount(rede, a._id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                    border: on ? `1.5px solid ${cor}` : "1.5px solid transparent",
                    background: on ? "#fff" : "rgba(0,0,0,0.04)",
                    color: on ? "var(--label)" : "var(--label-2)",
                    fontWeight: on ? 700 : 500, fontSize: 13,
                    boxShadow: on ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                  }}
                >
                  {a.profilePicture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.profilePicture} alt="" style={{ width: 22, height: 22, borderRadius: 999, objectFit: "cover", display: "block" }} />
                  ) : null}
                  <span>{nm}</span>
                  {on && <span aria-hidden="true" style={{ fontSize: 10, color: cor }}>●</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {loading && <Spinner texto="Carregando métricas…" />}
      {err && <div className="auth-err">{err}</div>}
      {!loading && !err && (
        <>
          {!anyData && (
            <div className="card" style={{ marginBottom: 16 }}>
              Sem métricas no período (verifique o add-on Analytics do plano), ou ainda não há dados.
            </div>
          )}

          {/* KPIs-herói por plataforma (estudo por canal) */}
          <div className="grid kpis" style={{ marginBottom: 16 }}>
            {heroes.map((h, i) => (
              <KpiCard key={i} lbl={h.lbl} val={h.val} foot={h.foot}>
                {comparando && h.cmp != null && h.cur != null
                  ? <DeltaChip delta={computeDelta(h.cur, h.cmp, true)} scn />
                  : null}
              </KpiCard>
            ))}
          </div>

          {isLimited && (
            <div className="card" style={{ marginBottom: 16, fontSize: 13, color: "var(--label-2)" }}>
              Métricas limitadas nesta rede: o Threads expõe apenas a base de seguidores. Alcance,
              interações e série diária não estão disponíveis na API pública.
            </div>
          )}

          {/* Desempenho no tempo (assinatura) — largura total, MULTI-métrica (cruza indicadores) */}
          {showPerf && (
            <div className="card pad-lg tcard" style={{ marginBottom: 16, "--tcard-accent": "var(--cyan)" } as CSSProperties}>
              <div className="card-head">
                <div>
                  <div className="t">Desempenho no tempo</div>
                  <div className="sub">Série diária · {perfMetrics.map(perfLbl).join(" + ")}</div>
                </div>
                <div className="perf-controls">
                  <div className="seg small" role="group" aria-label="Tipo de gráfico">
                    {CHART_TYPES.map((c) => (
                      <button
                        key={c.v}
                        type="button"
                        className={perfChart === c.v ? "on" : ""}
                        aria-pressed={perfChart === c.v}
                        onClick={() => setPerfChart(c.v)}
                      >
                        {c.l}
                      </button>
                    ))}
                  </div>
                  <div className="seg small perf-seg" role="group" aria-label="Métricas (cruze indicadores)" style={{ flexWrap: "wrap" }}>
                    {PERF_OPTS.map((o) => {
                      const on = perfMetrics.includes(o.v);
                      return (
                        <button
                          key={o.v}
                          type="button"
                          className={on ? "on" : ""}
                          aria-pressed={on}
                          onClick={() => togglePerf(o.v)}
                          style={on ? ({ "--chip-accent": perfColor(o.v) } as CSSProperties) : undefined}
                        >
                          {o.l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <Chart svg={perfSvg()} />
              <div className="legend">
                {perfMetrics.map((m) => (
                  <span key={m}><i style={{ background: perfColor(m) }} />{perfLbl(m)}</span>
                ))}
                {perfChart === "line" && comparando && cmpDaily && cmpDaily.length
                  ? <span><i className="dash" style={{ borderTopColor: perfColor(perfMetrics[0]) }} />Comparação · {perfLbl(perfMetrics[0])}</span>
                  : null}
              </div>
            </div>
          )}

          {/* Cards organizáveis via WidgetBoard (arrasta/reposiciona + largura; altura automática). */}
          {cards.length > 0 && (
            <WidgetBoard
              panel={`rede:${rede}`}
              mode="flow"
              widgets={cards.map((c) => ({ id: c.id, label: SI_CARD_LABELS[c.id] || c.id, defaultSpan: c.full ? 6 : 3, node: c.node }))}
            />
          )}
        </>
      )}
    </>
  );
}
