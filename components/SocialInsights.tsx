"use client";
// Dashboard de analytics social por workspace. Serve Instagram e os painéis de rede
// (canal/[rede]). Dado real quando a conta está conectada; estado vazio quando não.
// Renderiza TUDO dirigido pelo catálogo de indicadores (socialCatalog + indShown):
// KPIs (seguidores, métricas, derivados, inbox), gráficos (evolução de seguidores,
// séries diárias, volume de conversas), seções (top conteúdos, fontes de inbox,
// audiência/demografia) e COMPARAÇÃO de períodos.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageHead, KpiCard, DeltaChip, BarRow } from "@/components/ui";
import { Chart } from "@/components/Chart";
import { Spinner } from "@/components/Spinner";
import { lineChart, type LineSeries } from "@/lib/charts";
import { fmt, kfmt } from "@/lib/format";
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
          {/* Indicadores (KPI) conforme a configuração do painel */}
          <div className="grid kpis">
            {kpiCat.map((it) => {
              if (it.bind.src === "follower") {
                return (
                  <KpiCard key={it.id} lbl="Seguidores" val={acct.followersCount != null ? fmt(acct.followersCount) : "—"} foot={acct.followersCount == null ? "sem dado" : undefined}>
                    {comparando && cmpFollLast != null && curFollLast != null ? (
                      <DeltaChip delta={computeDelta(curFollLast, cmpFollLast, true)} scn />
                    ) : null}
                  </KpiCard>
                );
              }
              if (it.bind.src === "metric") {
                const k = it.bind.key;
                const m = metrics[k];
                return (
                  <KpiCard key={it.id} lbl={it.label} val={m ? kfmt(m.total) : "—"} foot={m ? m.unit || undefined : "sem dado"}>
                    {comparando && m && cmpIns?.metrics?.[k] ? (
                      <DeltaChip delta={computeDelta(m.total, cmpIns.metrics[k].total, true)} scn />
                    ) : null}
                  </KpiCard>
                );
              }
              if (it.bind.src === "derived") {
                const cur = derived(it.bind.key, metrics, acct.followersCount);
                const cmpV = comparando ? derived(it.bind.key, cmpIns?.metrics || {}, acct.followersCount) : null;
                return (
                  <KpiCard key={it.id} lbl={it.label} val={cur == null ? "—" : pctFmt(cur)} foot={cur == null ? "sem dado" : undefined}>
                    {cmpV != null && cur != null ? <DeltaChip delta={computeDelta(cur, cmpV, true)} scn /> : null}
                  </KpiCard>
                );
              }
              if (it.bind.src === "inbox") {
                if (it.bind.key === "volume") {
                  const v = inbox?.volume;
                  return (
                    <KpiCard
                      key={it.id}
                      lbl="Conversas"
                      val={v ? fmt(v.summary.uniqueConversations) : "—"}
                      foot={v ? `${fmt(v.summary.received)} recebidas · ${fmt(v.summary.sent)} enviadas` : "sem dado"}
                    />
                  );
                }
                if (it.bind.key === "response") {
                  const rt = inbox?.responseTime;
                  const has = rt != null && rt.summary.sampleSize > 0;
                  return (
                    <KpiCard key={it.id} lbl="Tempo de resposta" val={has ? humanDur(rt!.summary.medianSeconds) : "—"} foot={has ? "mediana" : "sem dado"} />
                  );
                }
                if (it.bind.key === "leads") {
                  // leads orgânicos = conversas iniciadas pelo cliente (fonte "contact")
                  const src = inbox?.sources?.sources?.find((x) => x.source === "contact");
                  const leads = src ? src.received : inbox?.volume?.summary.received ?? null;
                  return <KpiCard key={it.id} lbl={it.label} val={leads != null ? fmt(leads) : "—"} foot={leads != null ? "DMs recebidas" : "sem dado"} />;
                }
                return null;
              }
              if (it.bind.src === "content") {
                // rendimento orgânico = share de alcance de posts orgânicos
                const cur = content?.organicShare ?? null;
                const cmpV = comparando ? cmpContent?.organicShare ?? null : null;
                return (
                  <KpiCard key={it.id} lbl={it.label} val={cur == null ? "—" : pctFmt(cur)} foot={cur == null ? "sem dado" : `${fmt(content!.organic.count)} orgânicos · ${fmt(content!.paid.count)} impulsionados`}>
                    {cmpV != null && cur != null ? <DeltaChip delta={computeDelta(cur, cmpV, true)} scn /> : null}
                  </KpiCard>
                );
              }
              if (it.bind.src === "linkTaps") {
                const v = linkTaps ? linkTaps[it.bind.key] ?? 0 : null;
                return <KpiCard key={it.id} lbl={it.label} val={v != null ? fmt(v) : "—"} foot={v == null ? "sem dado" : undefined} />;
              }
              if (it.bind.src === "stories") {
                return <KpiCard key={it.id} lbl={it.label} val={stories != null ? fmt(stories) : "—"} foot={stories != null ? "últimas 24h" : "sem dado"} />;
              }
              // lacuna (doc) — sem dado
              return <KpiCard key={it.id} lbl={it.label} val="—" foot="sem dado" />;
            })}
            {customKpis.map((c) => {
              const m = c.metric ? metrics[c.metric] : undefined;
              return <KpiCard key={c.id} lbl={c.label} val={m ? kfmt(m.total) : "—"} foot={m ? undefined : c.metric ? "sem dado" : "manual"} />;
            })}
          </div>

          {!anyData && (
            <div className="card">
              Sem métricas no período (verifique o add-on Analytics do plano), ou ainda não há dados.
            </div>
          )}

          {/* Mix de conteúdo (por tipo de mídia no período) */}
          {showMix && content && content.total > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="t">Mix de conteúdo</div>
                <span className="badge">{fmt(content.total)} posts</span>
              </div>
              {Object.entries(content.byType)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([t, v]) => (
                  <BarRow key={t} k={TYPE_PT[t] || t} v={v} max={content.total} color={cor} formatted={fmt(v)} />
                ))}
            </div>
          )}

          {/* Evolução de seguidores */}
          {showFollowerChart && follVals.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="t">Evolução de seguidores</div>
                <span className="badge">{comparando ? "atual · comparação" : "no período"}</span>
              </div>
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
            </div>
          )}

          {/* Séries diárias (daily-metrics) — variam por período; só as ligadas */}
          {daily && daily.length > 0 && dailyCharts.map((it) => {
            if (it.bind.src !== "dailyChart") return null;
            const k = it.bind.key;
            const series: LineSeries[] = [
              { name: pt(k), color: cor, data: daily.map((r) => (r.metrics as Record<string, number>)[k] ?? 0), fill: true },
            ];
            if (comparando && cmpDaily && cmpDaily.length) {
              series.push({ name: "Comparação", color: cor, data: cmpDaily.slice(0, daily.length).map((r) => (r.metrics as Record<string, number>)[k] ?? 0), dash: true });
            }
            return (
              <div className="card" key={it.id}>
                <div className="card-head">
                  <div className="t">{it.label}</div>
                  <span className="badge">{comparando ? "atual · comparação" : "no período"}</span>
                </div>
                <Chart svg={lineChart(daily.map((r) => r.date.slice(5)), series, { sel: daily.length - 1 })} />
              </div>
            );
          })}

          {/* Um gráfico por indicador com série temporal (account-insights; só os ligados) */}
          {serieKeys.map((k) => {
            const vals = metrics[k].values;
            const cmpVals = cmpIns?.metrics?.[k]?.values || [];
            const series: LineSeries[] = [
              { name: pt(k), color: cor, data: vals.map((v) => v.value), fill: true },
            ];
            if (comparando && cmpVals.length) {
              series.push({ name: "Comparação", color: cor, data: cmpVals.slice(0, vals.length).map((v) => v.value), dash: true });
            }
            return (
              <div className="card" key={k}>
                <div className="card-head">
                  <div className="t">{pt(k)}</div>
                  <span className="badge">{comparando ? "atual · comparação" : "no período"}</span>
                </div>
                <Chart svg={lineChart(vals.map((v) => v.date.slice(5)), series, { sel: vals.length - 1 })} />
              </div>
            );
          })}

          {/* Volume de conversas por dia (inbox) */}
          {showInboxChart && inbox?.volume && inbox.volume.timeseries.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="t">Volume de conversas por dia</div>
                <span className="badge">no período</span>
              </div>
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

          {/* Top conteúdos (posting analytics) — ranking por engajamento */}
          {showTop && top && top.posts && top.posts.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="t">Top conteúdos</div>
                <span className="badge">por engajamento</span>
              </div>
              {top.posts.slice(0, 6).map((p) => {
                const a = p.analytics || {};
                const txt = (p.content || "").replace(/\s+/g, " ").trim();
                const short = txt.length > 90 ? txt.slice(0, 90) + "…" : txt || "(sem legenda)";
                return (
                  <div className="toggle-row" key={p._id}>
                    <div className="tinfo" style={{ minWidth: 0, overflow: "hidden" }}>
                      <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{short}</b>
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                        {a.engagementRate != null && <span className="badge">{erFmt(a.engagementRate)}</span>}
                        {a.reach != null && <span className="badge">{kfmt(a.reach)} alcance</span>}
                        {(a.likes != null || a.comments != null) && (
                          <span className="badge">{fmt(a.likes ?? 0)} curt. · {fmt(a.comments ?? 0)} coment.</span>
                        )}
                      </span>
                    </div>
                    {p.platformPostUrl && (
                      <a className="btn-link" href={p.platformPostUrl} target="_blank" rel="noopener" style={{ padding: "6px 10px" }}>
                        abrir ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Fontes das conversas (inbox) */}
          {showInboxSrc && inbox?.sources && inbox.sources.sources.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="t">Fontes das conversas</div>
                <span className="badge">no período</span>
              </div>
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

          {/* Audiência (demografia — só IG, quando ligado e disponível) */}
          {showDemographics && demoDims.length > 0 && (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
              {demoDims.map(({ dim, items }) => {
                const top = [...items].sort((a, b) => b.value - a.value).slice(0, 8);
                const max = Math.max(1, ...top.map((t) => t.value));
                return (
                  <div className="card" key={dim}>
                    <div className="card-head">
                      <div className="t">Audiência · {DIM_PT[dim] || dim}</div>
                      <span className="badge">seguidores</span>
                    </div>
                    {top.map((t, i) => (
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
        </div>
      )}
    </>
  );
}
