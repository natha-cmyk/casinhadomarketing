"use client";
// Dashboard de analytics social por workspace. Serve Instagram e os painéis de rede
// (canal/[rede]). Dado real quando a conta está conectada; estado vazio quando não.
// Renderiza TUDO dirigido pelo catálogo de indicadores (socialCatalog + indShown):
// KPIs (seguidores, métricas, derivados, inbox), gráficos (evolução de seguidores,
// séries diárias, volume de conversas), seções (top conteúdos, fontes de inbox,
// audiência/demografia) e COMPARAÇÃO de períodos.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageHead, KpiCard, DeltaChip, BarRow, MiniStat } from "@/components/ui";
import { Ic } from "@/components/Ic";
import { Chart } from "@/components/Chart";
import { Spinner } from "@/components/Spinner";
import { lineChart, type LineSeries } from "@/lib/charts";
import { fmt, kfmt, sum } from "@/lib/format";
import { daysInMonth, computeDelta, type Period } from "@/lib/scope";
import { REDES } from "@/lib/seed-data";
import { socialCatalog, indShown } from "@/lib/indicators";
import type {
  AnalyticsResponse, DemographicsResponse, DailyMetricRow, PostAnalyticsResp,
  InboxVolume, InboxResponseTime, InboxSourceBreakdown,
} from "@/lib/zernio";

// id da rede (Casinha) → plataforma da integração
const ZP: Record<string, string> = { x: "twitter" };
const zplat = (id: string) => ZP[id] || id;
// plataformas que têm analytics
const COM_ANALYTICS = new Set(["instagram", "facebook", "tiktok", "youtube", "linkedin", "twitter"]);
// plataformas com caixa de entrada (inbox)
const COM_INBOX = new Set(["instagram", "facebook"]);

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
const GENDER_PT: Record<string, string> = { M: "Masculino", F: "Feminino", U: "Não informado" };

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
interface Combined {
  insights: AnalyticsResponse | null;          // metrics{key:{total,values?}}
  followers: AnalyticsResponse | null;          // metrics.follower_count.values
  keySeries: KeySeries | null;
  daily: DailyMetricRow[] | null;               // daily-metrics
  top: PostAnalyticsResp | null;                // posting analytics (top conteúdos)
  content: ContentSummary | null;               // orgânico vs impulsionado + mix por tipo
  linkTaps: Record<string, number> | null;      // toques em links do perfil por tipo (IG)
  stories: number | null;                       // stories ativos (IG)
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

function dateRange(scope: { period: Period; year: number; month: number; quarter: number }) {
  const { period, year, month, quarter } = scope;
  let since: Date, until: Date;
  if (period === "trimestre") {
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

// número-herói: rótulo + valor grande + delta + rodapé + sparkline embutido
function HeroStat({ label, value, foot, delta, spark }: { label: string; value: string; foot?: string; delta?: ReactNode; spark?: string }) {
  return (
    <div className="hero-stat">
      <div className="hero-lbl">{label}</div>
      <div className="hero-val">{value}</div>
      {delta ? <div style={{ marginTop: 2 }}>{delta}</div> : null}
      {foot ? <div className="hero-foot">{foot}</div> : null}
      {spark ? <div className="hero-spark" dangerouslySetInnerHTML={{ __html: spark }} /> : null}
    </div>
  );
}

export function SocialInsights({ rede }: { rede: string }) {
  const s = useStore();
  const platform = zplat(rede);
  const meta = REDES.find((r) => r.id === rede);
  const label = meta?.label || rede;
  const cor = meta?.cor || "#FF001E";
  const eyebrow = `CANAIS · ${label.toUpperCase()}`;
  const acct = s.zernioAccounts.find((a) => a.platform === platform);

  const [data, setData] = useState<Combined | null>(null);
  const [cmpData, setCmpData] = useState<Combined | null>(null);
  const [inbox, setInbox] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
  const demo = data?.demographics || null;
  const daily = data?.daily || null;
  const cmpDaily = cmpData?.daily || null;
  const top = data?.top || null;
  const content = data?.content || null;
  const cmpContent = cmpData?.content || null;
  const linkTaps = data?.linkTaps || null;
  const stories = data?.stories ?? null;
  const cmpIns = cmpData?.insights || null;
  const cmpFoll = cmpData?.followers || null;

  const metrics = ins?.metrics || {};
  const keys = Object.keys(metrics);
  const comSerie = keys.filter((k) => metrics[k].values?.length);

  // série de seguidores (atual + comparação tracejada)
  const follVals = foll?.metrics?.follower_count?.values || [];
  const cmpFollVals = cmpFoll?.metrics?.follower_count?.values || [];
  const curFollLast = follVals.length ? follVals[follVals.length - 1].value : acct.followersCount ?? null;
  const cmpFollLast = cmpFollVals.length ? cmpFollVals[cmpFollVals.length - 1].value : null;

  // dimensões da audiência com dados
  const demoDims = demo ? DIM_ORDER.map((dim) => ({ dim, items: demoItems(demo, dim) })).filter((d) => d.items.length) : [];

  const desc =
    `${acct.displayName || "conta conectada"} · dados reais das contas conectadas · ${range.since} → ${range.until}` +
    (cmpRange ? ` · comparando ${range.since}→${range.until} vs ${cmpRange.since}→${cmpRange.until}` : "");

  // ── indicadores por CONFIG (base da doc + extras + custom); Personalização liga/desliga ──
  const cat = socialCatalog(rede);
  const shown = (id: string, custom = false) => indShown(s.paineis, rede, id, custom);
  const kpiCat = cat.filter((c) => c.kind === "kpi" && shown(c.id));
  const customList = s.customInd[rede] || [];
  const customKpis = customList.filter((c) => c.kind === "kpi");
  const showFollowerChart = shown("ch_followers");
  const showDemographics = shown("audiencia");
  const showTop = shown("posts");
  const showMix = shown("content_mix");
  const showInboxChart = shown("inbox_chart");
  const showInboxSrc = shown("inbox_src");
  // gráficos por métrica: só métricas com série E ligadas na config
  const serieKeys = comSerie.filter((k) => shown("m_" + k));
  // gráficos diários (daily-metrics) ligados
  const dailyCharts = cat.filter((c) => c.kind === "chart" && c.bind.src === "dailyChart" && shown(c.id));
  const anyData =
    ins != null || acct.followersCount != null ||
    (daily?.length ?? 0) > 0 || (top?.posts?.length ?? 0) > 0;

  const profileUrl = acct.username && PROFILE_URL[platform] ? PROFILE_URL[platform](acct.username) : null;

  // ── AMBIENTE DE LEITURA: números compilados (só o que tem dado) ──
  const reachDaily = daily && daily.length ? sum(daily.map((r) => r.metrics.reach || 0)) : null;
  const reachTotal = reachDaily != null ? reachDaily : metrics.reach?.total ?? null;
  const cmpReachDaily = cmpDaily && cmpDaily.length ? sum(cmpDaily.map((r) => r.metrics.reach || 0)) : null;
  const cmpReachTotal = comparando ? (cmpReachDaily != null ? cmpReachDaily : cmpIns?.metrics?.reach?.total ?? null) : null;
  const engRate = derived("eng_rate", metrics, acct.followersCount);
  const cmpEngRate = comparando ? derived("eng_rate", cmpIns?.metrics || {}, acct.followersCount) : null;
  const interactionsTotal = metrics.total_interactions?.total ?? null;
  const engSpark = daily && daily.length
    ? daily.map((r) => (r.metrics.likes || 0) + (r.metrics.comments || 0) + (r.metrics.shares || 0) + (r.metrics.saves || 0))
    : [];
  const isIG = platform === "instagram";
  const hasInbox = COM_INBOX.has(platform);

  // dd/mm a partir de ISO (yyyy-mm-dd)
  const br = (isoStr: string) => `${isoStr.slice(8, 10)}/${isoStr.slice(5, 7)}`;
  const pctDelta = (cur: number, prev: number | null | undefined): string | null => {
    if (prev == null || prev === 0) return null;
    const d = ((cur - prev) / prev) * 100;
    return (d >= 0 ? "+" : "−") + Math.abs(Math.round(d)) + "%";
  };

  // frase-resumo automática (só orações com dado)
  const buildNarrative = (): string => {
    const b = (s: string) => `<b>${s}</b>`;
    const s1: string[] = [];
    s1.push(`No período ${b(br(range.since) + "→" + br(range.until))}`);
    let s1tail = "";
    if (reachTotal != null) {
      const dl = comparando ? pctDelta(reachTotal, cmpReachTotal) : null;
      s1tail = `, o perfil alcançou ${b(kfmt(reachTotal) + " contas")}` + (dl ? ` (${dl} vs o período anterior)` : "");
      if (engRate != null) s1tail += ` com ${b(pctFmt(engRate))} de engajamento`;
    } else if (engRate != null) {
      s1tail = ` com ${b(pctFmt(engRate))} de engajamento`;
    }
    const sentence1 = (s1.join("") + s1tail).trim();

    const parts: string[] = [];
    if (sentence1) parts.push(sentence1 + ".");

    // conteúdo dominante + share orgânico
    if (content) {
      const s2: string[] = [];
      const types = Object.entries(content.byType).filter(([, v]) => v > 0).sort((a, b2) => b2[1] - a[1]);
      if (types.length && content.total > 0) {
        const [t, v] = types[0];
        s2.push(`${b(TYPE_PT[t] || t)} dominaram (${b(fmt(v) + " de " + fmt(content.total) + " posts")})`);
      }
      if (content.organicShare != null) {
        s2.push(`${b(pctFmt(content.organicShare))} do alcance veio de conteúdo orgânico`);
      }
      if (s2.length) parts.push(s2.join(" e ") + ".");
    }

    // saldo de seguidores no período (comparação)
    if (comparando && curFollLast != null && cmpFollLast != null && cmpFollLast !== curFollLast) {
      const diff = curFollLast - cmpFollLast;
      parts.push(`${b((diff >= 0 ? "+" : "−") + fmt(Math.abs(diff)))} seguidores frente ao período anterior.`);
    }

    // conversas
    const conv = hasInbox ? inbox?.volume?.summary.uniqueConversations ?? null : null;
    if (conv != null && conv > 0) {
      parts.push(`${b(fmt(conv))} conversas iniciadas por clientes.`);
    }
    return parts.join(" ");
  };
  const narrative = buildNarrative();

  // ── HERÓIS (3-4 números grandes com sparkline) ──
  type Hero = { key: string; label: string; value: string; foot?: string; delta?: ReactNode; spark?: string };
  const heroes: Hero[] = [];
  if (shown("seguidores") && acct.followersCount != null) {
    heroes.push({
      key: "foll", label: "Seguidores", value: fmt(acct.followersCount), foot: "base total",
      delta: comparando && cmpFollLast != null && curFollLast != null ? <DeltaChip delta={computeDelta(curFollLast, cmpFollLast, true)} scn /> : undefined,
      spark: sparkline(follVals.map((v) => v.value), cor),
    });
  }
  if ((shown("m_reach") || shown("d_reach")) && reachTotal != null) {
    heroes.push({
      key: "reach", label: "Alcance", value: kfmt(reachTotal), foot: "no período",
      delta: comparando && cmpReachTotal != null ? <DeltaChip delta={computeDelta(reachTotal, cmpReachTotal, true)} scn /> : undefined,
      spark: daily && daily.length ? sparkline(daily.map((r) => r.metrics.reach || 0), cor) : "",
    });
  }
  if (shown("der_eng_rate") && engRate != null) {
    heroes.push({
      key: "eng", label: "Engajamento", value: pctFmt(engRate), foot: "interações ÷ alcance",
      delta: comparando && cmpEngRate != null ? <DeltaChip delta={computeDelta(engRate, cmpEngRate, true)} scn /> : undefined,
      spark: sparkline(engSpark, cor),
    });
  }
  if (hasInbox && shown("inbox_leads") && inbox?.volume) {
    heroes.push({
      key: "conv", label: "Conversas", value: fmt(inbox.volume.summary.uniqueConversations),
      foot: `${fmt(inbox.volume.summary.received)} recebidas`,
      spark: sparkline(inbox.volume.timeseries.map((t) => t.received), cor),
    });
  }
  // garante 3-4 heróis quando há dado: cai pra Interações totais
  if (heroes.length < 3 && shown("m_total_interactions") && interactionsTotal != null) {
    heroes.push({
      key: "inter", label: "Interações", value: kfmt(interactionsTotal), foot: "no período",
      delta: comparando && cmpIns?.metrics?.total_interactions ? <DeltaChip delta={computeDelta(interactionsTotal, cmpIns.metrics.total_interactions.total, true)} scn /> : undefined,
      spark: sparkline(engSpark, cor),
    });
  }

  // ── BLOCO CRESCIMENTO ──
  const growSeg = shown("seguidores");
  const growChart = shown("ch_followers") && follVals.length > 0;
  const showGrowth = (growSeg || growChart) && (follVals.length > 0 || acct.followersCount != null);
  const fGained = metrics.followers_gained?.total ?? null;
  const fLost = metrics.followers_lost?.total ?? null;
  const fUnf = metrics.follows_and_unfollows?.total ?? null;

  // ── BLOCO ALCANCE & DESEMPENHO ──
  const showReachChart = shown("d_reach") && !!daily && daily.length > 0;
  const showImprChart = shown("d_impressions") && !!daily && daily.length > 0;
  const showOrganic = shown("organico") && !!content;
  const reachBigShown = shown("m_reach") || shown("d_reach");
  const showReachBlock = (reachBigShown || showReachChart || showImprChart || showOrganic) && (reachTotal != null || content != null);

  // ── BLOCO ENGAJAMENTO ──
  const engRows = ([
    { id: "m_likes", k: "Curtidas", key: "likes" },
    { id: "m_comments", k: "Comentários", key: "comments" },
    { id: "m_shares", k: "Compart.", key: "shares" },
    { id: "m_saves", k: "Salvos", key: "saves" },
    { id: "m_reposts", k: "Reposts", key: "reposts" },
    { id: "m_replies", k: "Respostas", key: "replies" },
  ] as const).filter((r) => shown(r.id) && metrics[r.key] != null);
  const engMax = Math.max(1, ...engRows.map((r) => metrics[r.key].total));
  const engBigInter = shown("m_total_interactions") && interactionsTotal != null;
  const engBigRate = shown("der_eng_rate") && engRate != null;
  const saveRate = shown("der_save_rate") ? derived("save_rate", metrics, acct.followersCount) : null;
  const showEngBlock = engBigInter || engBigRate || engRows.length > 0 || saveRate != null;

  // ── BLOCO CONTEÚDO (mix + top) ──
  const showMixIn = shown("content_mix") && !!content && content.total > 0;
  const showTopIn = shown("posts") && !!top && !!top.posts && top.posts.length > 0;
  const showContentBlock = showMixIn || showTopIn;
  const mixRows = content ? Object.entries(content.byType).filter(([, v]) => v > 0).sort((a, b2) => b2[1] - a[1]) : [];

  // ── BLOCO PERFIL & SITE (IG) ──
  const profileStats = isIG ? ([
    shown("link_website") ? { l: "Visitas ao site", n: linkTaps?.WEBSITE != null ? fmt(linkTaps.WEBSITE) : "—" } : null,
    shown("link_call") ? { l: "Toques em ligar", n: linkTaps?.CALL != null ? fmt(linkTaps.CALL) : "—" } : null,
    shown("link_email") ? { l: "Toques em e-mail", n: linkTaps?.EMAIL != null ? fmt(linkTaps.EMAIL) : "—" } : null,
    shown("m_profile_links_taps") && metrics.profile_links_taps ? { l: "Toques em links", n: kfmt(metrics.profile_links_taps.total) } : null,
    shown("stories_count") ? { l: "Stories ativos", n: stories != null ? fmt(stories) : "—" } : null,
  ].filter(Boolean) as { l: string; n: string }[]) : [];
  const showProfileBlock = profileStats.length > 0 && (linkTaps != null || stories != null || metrics.profile_links_taps != null);

  // ── BLOCO CONVERSAS ──
  const convStats = hasInbox ? ([
    shown("inbox_leads") ? { l: "Leads orgânicos (DM)", n: (() => { const src = inbox?.sources?.sources?.find((x) => x.source === "contact"); const leads = src ? src.received : inbox?.volume?.summary.received ?? null; return leads != null ? fmt(leads) : "—"; })() } : null,
    shown("inbox_vol") && inbox?.volume ? { l: "Conversas", n: fmt(inbox.volume.summary.uniqueConversations) } : null,
    shown("inbox_rt") ? { l: "Tempo de resposta", n: inbox?.responseTime && inbox.responseTime.summary.sampleSize > 0 ? humanDur(inbox.responseTime.summary.medianSeconds) : "—" } : null,
  ].filter(Boolean) as { l: string; n: string }[]) : [];
  const showConvChart = shown("inbox_chart") && !!inbox?.volume && inbox.volume.timeseries.length > 0;
  const showConvSrc = shown("inbox_src") && !!inbox?.sources && inbox.sources.sources.length > 0;
  const showConvBlock = hasInbox && (convStats.length > 0 || showConvChart || showConvSrc);

  // ── BLOCO OUTROS: séries diárias que não couberam + séries por métrica + custom + lacunas ──
  const otherDaily = dailyCharts.filter((it) => it.bind.src === "dailyChart" && it.bind.key !== "reach" && it.bind.key !== "impressions");
  const gapKpis = kpiCat.filter((it) => it.bind.src === "none");
  const showOther = (daily && daily.length > 0 && otherDaily.length > 0) || serieKeys.length > 0 || customKpis.length > 0 || gapKpis.length > 0;

  return (
    <>
      <PageHead
        eyebrow={eyebrow}
        title={label}
        desc={desc}
        right={profileUrl ? (
          <a className="btn-link" href={profileUrl} target="_blank" rel="noopener">Abrir perfil ↗</a>
        ) : undefined}
      />
      {loading && <Spinner texto="Carregando métricas…" />}
      {err && <div className="auth-err">{err}</div>}
      {!loading && !err && (
        <div className="grid" style={{ gap: 16 }}>
          {/* 1) NARRATIVA — frase-resumo automática do período */}
          {narrative && (
            <div className="narr">
              <div className="narr-ic" style={{ background: cor }}><Ic name="overview" /></div>
              <p dangerouslySetInnerHTML={{ __html: narrative }} />
            </div>
          )}

          {/* 2) HERÓIS — 3-4 números grandes com sparkline + delta */}
          {heroes.length > 0 && (
            <div className="hero-grid">
              {heroes.map((h) => (
                <HeroStat key={h.key} label={h.label} value={h.value} foot={h.foot} delta={h.delta} spark={h.spark} />
              ))}
            </div>
          )}

          {!anyData && (
            <div className="card">
              Sem métricas no período (verifique o add-on Analytics do plano), ou ainda não há dados.
            </div>
          )}

          {/* 3) CRESCIMENTO — seguidores + evolução (ids: seguidores, ch_followers) */}
          {showGrowth && (
            <div className="card">
              <div className="card-head">
                <div className="t">Crescimento</div>
                <span className="badge">{comparando ? "atual · comparação" : "no período"}</span>
              </div>
              {growSeg && acct.followersCount != null && (
                <>
                  <div className="bignum">{fmt(acct.followersCount)}</div>
                  <div className="tblock-sub">seguidores</div>
                </>
              )}
              {(fGained != null || fLost != null) ? (
                <div className="tblock-sub">+{fmt(fGained || 0)} ganhos · −{fmt(fLost || 0)} perdidos</div>
              ) : fUnf != null ? (
                <div className="tblock-sub">Saldo de follows/unfollows: {fmt(fUnf)}</div>
              ) : null}
              {growChart && (
                <Chart
                  svg={lineChart(
                    follVals.map((v) => v.date.slice(5)),
                    [
                      { name: "Seguidores", color: cor, data: follVals.map((v) => v.value), fill: true },
                      ...(comparando && cmpFollVals.length
                        ? [{ name: "Comparação", color: cor, data: cmpFollVals.slice(0, follVals.length).map((v) => v.value), dash: true } as LineSeries]
                        : []),
                    ],
                    { sel: follVals.length - 1 }
                  )}
                />
              )}
            </div>
          )}

          {/* 4) ALCANCE & DESEMPENHO — alcance + série diária + orgânico vs impulsionado */}
          {showReachBlock && (
            <div className="card">
              <div className="card-head">
                <div className="t">Alcance &amp; desempenho</div>
                <span className="badge">{comparando ? "atual · comparação" : "no período"}</span>
              </div>
              {reachBigShown && reachTotal != null && (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                    <div className="bignum">{kfmt(reachTotal)}</div>
                    {comparando && cmpReachTotal != null && <DeltaChip delta={computeDelta(reachTotal, cmpReachTotal, true)} scn />}
                  </div>
                  <div className="tblock-sub">contas alcançadas no período</div>
                </>
              )}
              {showReachChart && (
                <Chart
                  svg={lineChart(
                    daily!.map((r) => r.date.slice(5)),
                    [
                      { name: "Alcance", color: cor, data: daily!.map((r) => r.metrics.reach || 0), fill: true },
                      ...(comparando && cmpDaily && cmpDaily.length
                        ? [{ name: "Comparação", color: cor, data: cmpDaily.slice(0, daily!.length).map((r) => r.metrics.reach || 0), dash: true } as LineSeries]
                        : []),
                    ],
                    { sel: daily!.length - 1 }
                  )}
                />
              )}
              {showImprChart && (
                <Chart
                  svg={lineChart(
                    daily!.map((r) => r.date.slice(5)),
                    [{ name: "Impressões", color: cor, data: daily!.map((r) => r.metrics.impressions || 0), fill: true }],
                    { sel: daily!.length - 1 }
                  )}
                />
              )}
              {showOrganic && content && (
                <div style={{ marginTop: 12 }}>
                  <div className="tblock-sub" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span>Orgânico vs impulsionado{content.organicShare != null && <> · {pctFmt(content.organicShare)} orgânico</>}</span>
                    {comparando && content.organicShare != null && cmpContent?.organicShare != null && (
                      <DeltaChip delta={computeDelta(content.organicShare, cmpContent.organicShare, true)} scn />
                    )}
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
                </div>
              )}
            </div>
          )}

          {/* 5) ENGAJAMENTO — total + taxa + breakdown horizontal */}
          {showEngBlock && (
            <div className="card">
              <div className="card-head">
                <div className="t">Engajamento</div>
                <span className="badge">no período</span>
              </div>
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end", marginBottom: engRows.length ? 12 : 0 }}>
                {engBigInter && (
                  <div>
                    <div className="bignum">{kfmt(interactionsTotal!)}</div>
                    <div className="tblock-sub" style={{ margin: "4px 0 0" }}>interações totais</div>
                  </div>
                )}
                {engBigRate && (
                  <div>
                    <div className="bignum">{pctFmt(engRate!)}</div>
                    <div className="tblock-sub" style={{ margin: "4px 0 0" }}>taxa de engajamento</div>
                  </div>
                )}
                {saveRate != null && (
                  <div>
                    <div className="bignum">{pctFmt(saveRate)}</div>
                    <div className="tblock-sub" style={{ margin: "4px 0 0" }}>taxa de salvamento</div>
                  </div>
                )}
              </div>
              {engRows.map((r) => (
                <BarRow key={r.id} k={r.k} v={metrics[r.key].total} max={engMax} color={cor} formatted={fmt(metrics[r.key].total)} />
              ))}
            </div>
          )}

          {/* 6) CONTEÚDO — mix por tipo + top conteúdos (ids: content_mix, posts) */}
          {showContentBlock && (
            <div className="card">
              <div className="card-head">
                <div className="t">Conteúdo</div>
                {content && content.total > 0 && <span className="badge">{fmt(content.total)} posts</span>}
              </div>
              {showMixIn && content && (
                <div style={{ marginBottom: showTopIn ? 14 : 0 }}>
                  <div className="tblock-sub">Mix por tipo de mídia</div>
                  {mixRows.map(([t, v]) => (
                    <BarRow key={t} k={TYPE_PT[t] || t} v={v} max={content.total} color={cor} formatted={fmt(v)} />
                  ))}
                </div>
              )}
              {showTopIn && top && top.posts && (
                <div>
                  <div className="tblock-sub">Top conteúdos · por engajamento</div>
                  {top.posts.slice(0, 6).map((p) => {
                    const a = p.analytics || {};
                    const txt = (p.content || "").replace(/\s+/g, " ").trim();
                    const short = txt.length > 80 ? txt.slice(0, 80) + "…" : txt || "(sem legenda)";
                    return (
                      <div className="toppost" key={p._id}>
                        <div className="tp-txt">{short}</div>
                        <div className="tp-badges">
                          {a.engagementRate != null && <span>{erFmt(a.engagementRate)}</span>}
                          {a.reach != null && <span>{kfmt(a.reach)}</span>}
                          {a.likes != null && <span>{fmt(a.likes)} ♥</span>}
                        </div>
                        {p.platformPostUrl && (
                          <a href={p.platformPostUrl} target="_blank" rel="noopener">abrir ↗</a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 7) PERFIL & SITE (IG) — visitas ao site, toques, stories */}
          {showProfileBlock && (
            <div className="card">
              <div className="card-head">
                <div className="t">Perfil &amp; site</div>
                <span className="badge">no período</span>
              </div>
              <div className="mini">
                {profileStats.map((st, i) => <MiniStat key={i} l={st.l} n={st.n} />)}
              </div>
            </div>
          )}

          {/* 8) CONVERSAS — leads, conversas, tempo de resposta + volume + fontes */}
          {showConvBlock && (
            <div className="card">
              <div className="card-head">
                <div className="t">Conversas</div>
                <span className="badge">no período</span>
              </div>
              {convStats.length > 0 && (
                <div className="mini" style={{ marginBottom: showConvChart || showConvSrc ? 14 : 0 }}>
                  {convStats.map((st, i) => <MiniStat key={i} l={st.l} n={st.n} />)}
                </div>
              )}
              {showConvChart && inbox?.volume && (
                <div style={{ marginBottom: showConvSrc ? 12 : 0 }}>
                  <div className="tblock-sub">Volume por dia</div>
                  <Chart
                    svg={lineChart(
                      inbox.volume.timeseries.map((t) => t.date.slice(5)),
                      [
                        { name: "recebidas", color: cor, data: inbox.volume.timeseries.map((t) => t.received), fill: true },
                        { name: "enviadas", color: "#8E8E93", data: inbox.volume.timeseries.map((t) => t.sent) },
                      ],
                      { sel: inbox.volume.timeseries.length - 1 }
                    )}
                  />
                </div>
              )}
              {showConvSrc && inbox?.sources && (
                <div>
                  <div className="tblock-sub">Fontes das conversas</div>
                  {(() => {
                    const rows = inbox.sources.sources.map((sr) => ({
                      label: SOURCE_PT[sr.source] || sr.source,
                      val: sr.received || sr.sent || sr.read,
                    }));
                    const max = Math.max(1, ...rows.map((r) => r.val));
                    return rows.map((r, i) => (
                      <BarRow key={i} k={r.label} v={r.val} max={max} color={cor} formatted={fmt(r.val)} />
                    ));
                  })()}
                </div>
              )}
            </div>
          )}

          {/* 9) AUDIÊNCIA (IG) — demografia por dimensão (id: audiencia) */}
          {showDemographics && demoDims.length > 0 && (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
              {demoDims.map(({ dim, items }) => {
                const topD = [...items].sort((a, b) => b.value - a.value).slice(0, 8);
                const max = Math.max(1, ...topD.map((t) => t.value));
                return (
                  <div className="card" key={dim}>
                    <div className="card-head">
                      <div className="t">Audiência · {DIM_PT[dim] || dim}</div>
                      <span className="badge">seguidores</span>
                    </div>
                    {topD.map((t, i) => (
                      <BarRow
                        key={i}
                        k={dim === "gender" ? GENDER_PT[t.dimension] || t.dimension : t.dimension}
                        v={t.value}
                        max={max}
                        color={cor}
                        formatted={fmt(t.value)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* 10) OUTROS INDICADORES — séries diárias/por métrica extras + custom + lacunas */}
          {showOther && (
            <div className="card">
              <div className="card-head">
                <div className="t">Outros indicadores</div>
                <span className="badge">{comparando ? "atual · comparação" : "no período"}</span>
              </div>
              {daily && daily.length > 0 && otherDaily.map((it) => {
                if (it.bind.src !== "dailyChart") return null;
                const k = it.bind.key;
                const series: LineSeries[] = [
                  { name: pt(k), color: cor, data: daily.map((r) => (r.metrics as Record<string, number>)[k] ?? 0), fill: true },
                ];
                if (comparando && cmpDaily && cmpDaily.length) {
                  series.push({ name: "Comparação", color: cor, data: cmpDaily.slice(0, daily.length).map((r) => (r.metrics as Record<string, number>)[k] ?? 0), dash: true });
                }
                return (
                  <div key={it.id} style={{ marginBottom: 12 }}>
                    <div className="tblock-sub">{it.label}</div>
                    <Chart svg={lineChart(daily.map((r) => r.date.slice(5)), series, { sel: daily.length - 1 })} />
                  </div>
                );
              })}
              {serieKeys.map((k) => {
                const vals = metrics[k].values!;
                const cmpVals = cmpIns?.metrics?.[k]?.values || [];
                const series: LineSeries[] = [
                  { name: pt(k), color: cor, data: vals.map((v) => v.value), fill: true },
                ];
                if (comparando && cmpVals.length) {
                  series.push({ name: "Comparação", color: cor, data: cmpVals.slice(0, vals.length).map((v) => v.value), dash: true });
                }
                return (
                  <div key={k} style={{ marginBottom: 12 }}>
                    <div className="tblock-sub">{pt(k)}</div>
                    <Chart svg={lineChart(vals.map((v) => v.date.slice(5)), series, { sel: vals.length - 1 })} />
                  </div>
                );
              })}
              {(customKpis.length > 0 || gapKpis.length > 0) && (
                <div className="grid kpis">
                  {customKpis.map((c) => {
                    const m = c.metric ? metrics[c.metric] : undefined;
                    return <KpiCard key={c.id} lbl={c.label} val={m ? kfmt(m.total) : "—"} foot={m ? undefined : c.metric ? "sem dado" : "manual"} />;
                  })}
                  {gapKpis.map((it) => (
                    <KpiCard key={it.id} lbl={it.label} val="—" foot="sem dado" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
