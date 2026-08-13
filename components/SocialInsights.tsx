"use client";
// Dashboard de analytics social por workspace. Serve Instagram e os painéis de rede
// (canal/[rede]). Dado real quando a conta está conectada; estado vazio quando não.
// Layout portado 1:1 do painel Instagram do blueprint (viewInstagram): 4 KPIs, um card
// "Desempenho no tempo" com SELETOR de métrica (série diária cronológica), mix de
// conteúdo, seguidores, engajamento por tipo, rendimento orgânico, atividade & audiência,
// conversas, top conteúdos e heatmap de melhores horários. COMPARAÇÃO de períodos preservada.
import { Fragment, useEffect, useState } from "react";
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
  // ASSINATURA: métrica selecionada do card "Desempenho no tempo" (série diária cronológica)
  const [perfMetric, setPerfMetric] = useState<string>("reach");

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

  const desc =
    `${acct.displayName || "conta conectada"} · dados reais das contas conectadas · ${range.since} → ${range.until}` +
    (cmpRange ? ` · comparando ${range.since}→${range.until} vs ${cmpRange.since}→${cmpRange.until}` : "");

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

  // ── card "Desempenho no tempo" (assinatura): seletor de métrica → série diária cronológica ──
  const PERF_OPTS: { v: string; l: string }[] = [
    { v: "reach", l: "Alcance" }, { v: "impressions", l: "Impressões" }, { v: "views", l: "Visualizações" },
    { v: "likes", l: "Curtidas" }, { v: "comments", l: "Comentários" }, { v: "shares", l: "Compart." }, { v: "saves", l: "Salvos" },
  ];
  const perfLabel = PERF_OPTS.find((o) => o.v === perfMetric)?.l || "Alcance";
  const dget = (r: DailyMetricRow, k: string) => (r.metrics as Record<string, number>)[k] ?? 0;
  const showPerf = !!daily && daily.length > 0;

  // ── Mix de conteúdo (por tipo de mídia) ──
  const mixRows = content ? Object.entries(content.byType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  const mixTop = mixRows.length ? (TYPE_PT[mixRows[0][0]] || mixRows[0][0]) : null;
  const showMix = !!content && content.total > 0 && mixRows.length > 0;

  // ── Engajamento por tipo ──
  const engTypeRows = ([
    { k: "Curtidas", key: "likes" }, { k: "Compartilhamentos", key: "shares" },
    { k: "Salvos", key: "saves" }, { k: "Comentários", key: "comments" }, { k: "Reposts", key: "reposts" },
  ] as const).filter((r) => metrics[r.key] != null);
  const engTypeMax = Math.max(1, ...engTypeRows.map((r) => metrics[r.key].total));
  const engTypeSum = sum(engTypeRows.map((r) => metrics[r.key].total));

  // ── Rendimento orgânico ──
  const showOrganic = shown("organico") && !!content;

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
        <>
          {!anyData && (
            <div className="card" style={{ marginBottom: 16 }}>
              Sem métricas no período (verifique o add-on Analytics do plano), ou ainda não há dados.
            </div>
          )}

          {/* 4 KPIs */}
          <div className="grid kpis" style={{ marginBottom: 16 }}>
            <KpiCard
              lbl="Seguidores"
              val={followersCount != null ? fmt(followersCount) : "—"}
              foot={net != null ? `líquido ${net >= 0 ? "+" : ""}${fmt(net)} no período` : undefined}
            >
              {comparando && cmpFollLast != null && followersCount != null
                ? <DeltaChip delta={computeDelta(followersCount, cmpFollLast, true)} scn />
                : null}
            </KpiCard>
            <KpiCard lbl="Contas alcançadas" val={reachTotal != null ? kfmt(reachTotal) : "—"} foot="alcance">
              {comparando && cmpReachTotal != null && reachTotal != null
                ? <DeltaChip delta={computeDelta(reachTotal, cmpReachTotal, true)} scn />
                : null}
            </KpiCard>
            <KpiCard lbl="Visualizações" val={viewsTotal != null ? kfmt(viewsTotal) : "—"} foot="impressões">
              {comparando && cmpViewsTotal != null && viewsTotal != null
                ? <DeltaChip delta={computeDelta(viewsTotal, cmpViewsTotal, true)} scn />
                : null}
            </KpiCard>
            <KpiCard lbl="Interações" val={interactionsTotal != null ? kfmt(interactionsTotal) : "—"} foot="engajamento bruto">
              {comparando && cmpInterTotal != null && interactionsTotal != null
                ? <DeltaChip delta={computeDelta(interactionsTotal, cmpInterTotal, true)} scn />
                : null}
            </KpiCard>
          </div>

          {/* Desempenho no tempo (assinatura) + Mix de conteúdo */}
          <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 16, marginBottom: 16 }}>
            {showPerf ? (
              <div className="card pad-lg">
                <div className="card-head">
                  <div>
                    <div className="t">Desempenho no tempo</div>
                    <div className="sub">Série diária · {perfLabel}</div>
                  </div>
                  <div className="seg small" role="group" aria-label="Métrica" style={{ flexWrap: "wrap" }}>
                    {PERF_OPTS.map((o) => (
                      <button key={o.v} type="button" className={perfMetric === o.v ? "on" : ""} onClick={() => setPerfMetric(o.v)}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
                <Chart
                  svg={lineChart(
                    daily!.map((r) => r.date.slice(5)),
                    [
                      { name: perfLabel, color: cor, data: daily!.map((r) => dget(r, perfMetric)), fill: true },
                      ...(comparando && cmpDaily && cmpDaily.length
                        ? [{ name: "Comparação", color: cor, data: cmpDaily.slice(0, daily!.length).map((r) => dget(r, perfMetric)), dash: true } as LineSeries]
                        : []),
                    ],
                    { h: 250, sel: daily!.length - 1 }
                  )}
                />
                <div className="legend">
                  <span><i style={{ background: cor }} />{perfLabel}</span>
                  {comparando && cmpDaily && cmpDaily.length ? <span><i className="dash" style={{ borderTopColor: cor }} />Comparação</span> : null}
                </div>
              </div>
            ) : <div />}

            {showMix && content ? (
              <div className="card pad-lg">
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
            ) : <div />}
          </div>

          {/* Seguidores */}
          {showSeg && (
            <div className="card pad-lg" style={{ marginBottom: 16 }}>
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
          )}

          {/* Engajamento por tipo + Rendimento orgânico */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {engTypeRows.length > 0 ? (
              <div className="card pad-lg">
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
            ) : <div />}

            {showOrganic && content ? (
              <div className="card pad-lg">
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
            ) : <div />}
          </div>

          {/* Atividade & audiência */}
          {showActivity && (
            <div className="card pad-lg" style={{ marginBottom: 16 }}>
              <div className="card-head"><div className="t">Atividade &amp; audiência</div></div>
              <div className="mini">
                {accountsEngaged != null && <MiniStat l="Atividades no perfil" n={fmt(accountsEngaged)} />}
                <MiniStat l="Visitas ao site" n={linkTaps?.WEBSITE != null ? fmt(linkTaps.WEBSITE) : "—"} />
                {shown("link_call") && <MiniStat l="Toques em ligar" n={linkTaps?.CALL != null ? fmt(linkTaps.CALL) : "—"} />}
                {shown("link_email") && <MiniStat l="Toques em e-mail" n={linkTaps?.EMAIL != null ? fmt(linkTaps.EMAIL) : "—"} />}
              </div>
            </div>
          )}

          {/* Conversas */}
          {showConv && (
            <div className="card pad-lg" style={{ marginBottom: 16 }}>
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
          )}

          {/* Top conteúdos do período + Melhores horários */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
            {showTop && top?.posts ? (
              <div className="card pad-lg">
                <div className="card-head">
                  <div>
                    <div className="t">Top conteúdos do período</div>
                    <div className="sub">por engajamento · via integração</div>
                  </div>
                </div>
                <div className="top-list">
                  {top.posts.slice(0, 6).map((p, i) => {
                    const a = p.analytics || {};
                    const txt = (p.content || "").replace(/\s+/g, " ").trim();
                    const short = txt.length > 60 ? txt.slice(0, 60) + "…" : txt || "(sem legenda)";
                    const mt = (p as { mediaType?: string }).mediaType;
                    const fmtTag = [
                      mt ? (TYPE_PT[String(mt).toLowerCase()] || mt) : null,
                      p.publishedAt ? p.publishedAt.slice(0, 10).split("-").reverse().join("/") : null,
                    ].filter(Boolean).join(" · ");
                    return (
                      <div className="top-item" key={p._id}>
                        <span className="rank">{i + 1}</span>
                        <div>
                          <div className="tt">{short}</div>
                          <div className="fmt">
                            {fmtTag}
                            {p.platformPostUrl ? <> · <a href={p.platformPostUrl} target="_blank" rel="noopener" style={{ color: "var(--cyan)" }}>abrir ↗</a></> : null}
                          </div>
                        </div>
                        <div className="mv">
                          {a.engagementRate != null
                            ? <>{erFmt(a.engagementRate)}<span>engaj.</span></>
                            : a.reach != null
                              ? <>{kfmt(a.reach)}<span>alcance</span></>
                              : <>{fmt(a.views || 0)}<span>views</span></>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : <div />}

            <div className="card pad-lg">
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
          </div>

          {/* Audiência — demografia (idade/gênero/país/cidade) */}
          {showDemo && (
            <div className="card pad-lg">
              <div className="card-head">
                <div><div className="t">Audiência</div><div className="sub">quem segue o perfil · por seguidores</div></div>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 }}>
                {demoDims.map(({ dim, items }) => {
                  const tops = [...items].sort((a, b) => b.value - a.value).slice(0, 6);
                  const mx = Math.max(1, ...tops.map((t) => t.value));
                  return (
                    <div key={dim}>
                      <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>{DIM_PT[dim] || dim}</div>
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
          )}
        </>
      )}
    </>
  );
}
