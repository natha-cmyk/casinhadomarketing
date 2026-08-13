"use client";
// Dashboard de analytics social por workspace (via Zernio). Serve Instagram e os
// painéis de rede (canal/[rede]). Dado real quando a conta está conectada; estado
// vazio quando não. KPIs de todos os indicadores, evolução de seguidores, um gráfico
// por métrica com série, audiência (demografia, só IG) e COMPARAÇÃO de períodos.
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
import type { AnalyticsResponse, DemographicsResponse } from "@/lib/zernio";

// id da rede (Casinha) → plataforma da Zernio
const ZP: Record<string, string> = { x: "twitter" };
const zplat = (id: string) => ZP[id] || id;
// plataformas que têm analytics no Zernio
const COM_ANALYTICS = new Set(["instagram", "facebook", "tiktok", "youtube", "linkedin", "twitter"]);

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

// resposta da rota combinada
interface KeySeries { metric: string; label: string; total: number; values: { date: string; value: number }[] }
interface Combined {
  insights: AnalyticsResponse | null;
  followers: AnalyticsResponse | null;
  keySeries: KeySeries | null;
  demographics: DemographicsResponse | null;
}

// cache de módulo (stale-while-revalidate): re-visitas abrem na hora, revalida em background.
// keyed por platform|accountId|since|until (o mesmo formato serve atual e comparação).
const INS_CACHE = new Map<string, Combined>();

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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  if (!acct) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={label} desc="Métricas reais unificadas pela Zernio." />
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
    `${acct.displayName || "conta conectada"} · dados reais (Zernio) · ${range.since} → ${range.until}` +
    (cmpRange ? ` · comparando ${range.since}→${range.until} vs ${cmpRange.since}→${cmpRange.until}` : "");

  // ── indicadores por CONFIG (base da doc + extras + custom); Personalização liga/desliga ──
  const cat = socialCatalog(rede);
  const shown = (id: string, custom = false) => indShown(s.paineis, rede, id, custom);
  const kpiCat = cat.filter((c) => c.kind === "kpi" && shown(c.id));
  const customList = s.customInd[rede] || [];
  const customKpis = customList.filter((c) => c.kind === "kpi");
  const showFollowerChart = shown("ch_followers");
  const showKeyChart = shown("ch_key");
  const showDemographics = shown("audiencia");
  const showTop = shown("top");
  const keySeries = data?.keySeries || null;
  const cmpKeySeries = cmpData?.keySeries || null;
  // gráficos por métrica: só métricas com série E ligadas na config
  const serieKeys = comSerie.filter((k) => shown("m_" + k));
  const anyData = ins != null || acct.followersCount != null || keySeries != null;

  return (
    <>
      <PageHead eyebrow={eyebrow} title={label} desc={desc} />
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
              // lacuna (doc) — sem dado da Zernio
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

          {/* Série diária da métrica-chave (muda por período) */}
          {showKeyChart && keySeries && keySeries.values.length > 0 && (
            <div className="card">
              <div className="card-head">
                <div className="t">{pt(keySeries.metric)} por dia</div>
                <span className="badge">{comparando ? "atual · comparação" : "no período"}</span>
              </div>
              <Chart
                svg={lineChart(
                  keySeries.values.map((v) => v.date.slice(5)),
                  [
                    { name: pt(keySeries.metric), color: cor, data: keySeries.values.map((v) => v.value), fill: true },
                    ...(comparando && cmpKeySeries?.values.length
                      ? [{ name: "Comparação", color: cor, data: cmpKeySeries.values.slice(0, keySeries.values.length).map((v) => v.value), dash: true } as LineSeries]
                      : []),
                  ],
                  { sel: keySeries.values.length - 1 }
                )}
              />
            </div>
          )}

          {/* Um gráfico por indicador com série temporal (só os ligados) */}
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

          {/* Top conteúdos — lacuna (nível de post, em breve) */}
          {showTop && (
            <div className="card">
              <div className="card-head"><div className="t">Top conteúdos</div><span className="badge">em breve</span></div>
              <div className="pm-hint">Ranking por desempenho de post chega com o analytics em nível de publicação.</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
