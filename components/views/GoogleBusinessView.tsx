"use client";
// Painel do Google Business (Perfil da Empresa) por workspace — dado real via Zernio.
// Mesma linguagem visual dos painéis de rede (PageHead, cards brancos, KPIs-herói,
// "Desempenho no tempo" com lineChart, listas rankeadas). Acento da rede: #4285F4.
//
// Realidade da API (verificada ao vivo): a conta googlebusiness da Zernio sincroniza UMA
// ficha por vez; performance/keywords/media/reviews refletem só ela (o locationId é ignorado).
// O seletor lista todas as fichas — escolher outra TROCA a ficha sincronizada (PUT gmb-locations)
// e re-carrega as métricas dessa ficha. Responder avaliações é escrita (POST .../reply) e a
// resposta fica associada à ficha sincronizada no momento.
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageHead, KpiCard, BarRow, MiniStat } from "@/components/ui";
import { Chart } from "@/components/Chart";
import { Spinner } from "@/components/Spinner";
import { lineChart, type LineSeries } from "@/lib/charts";
import { fmt, kfmt, sum } from "@/lib/format";
import { daysInMonth, type Period } from "@/lib/scope";
import { REDES } from "@/lib/seed-data";
import type {
  GbpPerformance, GbpKeywordsResp, GbpLocationsResp, GbpMediaResp, GbpReviewsResp, GbpDetails, GbpLocation, GbpReview,
} from "@/lib/zernio";

const CY = "#4285F4"; // acento Google Business
const GREEN = "#34A853", YELLOW = "#FBBC05", RED = "#EA4335", PURPLE = "#8E5BE0";

// grupos de impressões (busca × maps · celular × computador)
const IMPRESSION_KEYS = [
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH", "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS", "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
];
const IMPRESSION_PT: Record<string, string> = {
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "Busca · celular",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "Busca · computador",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "Maps · celular",
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "Maps · computador",
};

interface GbpData {
  accountId: string; activeLocationId: string | null;
  performance: GbpPerformance | null; keywords: GbpKeywordsResp | null;
  locations: GbpLocationsResp | null; media: GbpMediaResp | null;
  reviews: GbpReviewsResp | null; details: GbpDetails | null; error?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// janela de datas do escopo (mesma lógica do painel social)
function dateRange(scope: { period: Period; year: number; month: number; quarter: number; week: number }) {
  const { period, year, month, quarter, week } = scope;
  let since: Date, until: Date;
  if (period === "semana") {
    const last = daysInMonth(year, month);
    const startDay = week * 7 + 1;
    since = new Date(year, month, startDay);
    until = new Date(year, month, Math.min(startDay + 6, last));
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

// estrelas (média) — inteiras + meia
function Stars({ rating, size = 15 }: { rating: number; size?: number }) {
  const items = [0, 1, 2, 3, 4].map((i) => {
    const frac = Math.max(0, Math.min(1, rating - i));
    return (
      <span key={i} style={{ position: "relative", display: "inline-block", width: size, height: size, lineHeight: 1 }}>
        <span style={{ color: "rgba(0,0,0,.14)", fontSize: size }}>★</span>
        <span style={{ position: "absolute", left: 0, top: 0, width: `${frac * 100}%`, overflow: "hidden", color: YELLOW, fontSize: size }}>★</span>
      </span>
    );
  });
  return <span style={{ display: "inline-flex", gap: 1 }}>{items}</span>;
}

const CACHE = new Map<string, GbpData>();
const keyOf = (a: string, s: string, u: string) => `${a}|${s}|${u}`;

export function GoogleBusinessView({ rede = "googlebusiness" }: { rede?: string }) {
  const s = useStore();
  const meta = REDES.find((r) => r.id === rede);
  const label = meta?.label || "Google Business";
  const eyebrow = `CANAIS · ${label.toUpperCase()}`;
  const acct = s.zernioAccounts.find((a) => a.platform === "googlebusiness");

  const [data, setData] = useState<GbpData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selLoc, setSelLoc] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchErr, setSwitchErr] = useState<string | null>(null);
  const [perfSel, setPerfSel] = useState<string[]>(["impressions"]);

  const range = useMemo(() => dateRange(s), [s.period, s.year, s.month, s.quarter, s.week]);

  useEffect(() => {
    if (!acct) return;
    const key = keyOf(acct._id, range.since, range.until);
    let alive = true;
    const cached = CACHE.get(key);
    if (cached) { setData(cached); setLoading(false); } else { setData(null); setLoading(true); }
    setErr(null);
    fetch(`/api/zernio/gbp?accountId=${acct._id}&since=${range.since}&until=${range.until}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: GbpData) => {
        if (!alive) return;
        if (d?.error) { if (!cached) setErr(String(d.error)); }
        else { CACHE.set(key, d); setData(d); }
      })
      .catch((e) => alive && !cached && setErr(String(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [acct?._id, range.since, range.until]);

  // ficha selecionada default = ficha ativa
  useEffect(() => {
    if (data?.activeLocationId && selLoc == null) setSelLoc(data.activeLocationId);
  }, [data?.activeLocationId, selLoc]);

  if (!acct) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={label} desc="Métricas reais da ficha do Google via conta conectada." />
        <div className="empty">
          <div className="e-ico" style={{ fontSize: 22 }}>🔌</div>
          <h3>{label} não conectado</h3>
          <p>
            Conecte a conta em{" "}
            <Link href="/personalizacao" style={{ color: "var(--cyan)", fontWeight: 650 }}>Personalização → Conexões</Link>{" "}
            para ver as métricas reais aqui.
          </p>
        </div>
      </>
    );
  }

  const perf = data?.performance || null;
  const metrics = perf?.metrics || {};
  const mtot = (k: string): number | null => (metrics[k]?.total ?? null);
  const impressionsTotal = IMPRESSION_KEYS.some((k) => metrics[k] != null)
    ? sum(IMPRESSION_KEYS.map((k) => mtot(k) ?? 0)) : null;
  const searchImpr = (mtot("BUSINESS_IMPRESSIONS_MOBILE_SEARCH") ?? 0) + (mtot("BUSINESS_IMPRESSIONS_DESKTOP_SEARCH") ?? 0);
  const mapsImpr = (mtot("BUSINESS_IMPRESSIONS_MOBILE_MAPS") ?? 0) + (mtot("BUSINESS_IMPRESSIONS_DESKTOP_MAPS") ?? 0);

  const locations = data?.locations?.locations || [];
  const activeLoc = data?.activeLocationId || null;
  const isActiveSel = selLoc == null || selLoc === activeLoc;
  const selLocObj: GbpLocation | undefined = locations.find((l) => l.id === selLoc);

  // Troca a ficha SINCRONIZADA na Zernio e re-carrega as métricas (que passam a ser dessa ficha).
  async function switchLocation(id: string) {
    if (!acct || switching || id === activeLoc) return;
    setSelLoc(id); // destaque otimista
    setSwitching(true);
    setSwitchErr(null);
    try {
      const res = await fetch("/api/zernio/gbp/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setLocation", accountId: acct._id, locationId: id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) throw new Error(j?.error || "Falha ao trocar a ficha.");
      // re-busca os dados (agora refletem a nova ficha) — invalida o cache do período
      const key = keyOf(acct._id, range.since, range.until);
      CACHE.delete(key);
      const d: GbpData = await fetch(
        `/api/zernio/gbp?accountId=${acct._id}&since=${range.since}&until=${range.until}`,
        { cache: "no-store" }
      ).then((r) => r.json());
      if (d?.error) throw new Error(String(d.error));
      CACHE.set(key, d);
      setData(d);
      setSelLoc(d.activeLocationId ?? id);
    } catch (e) {
      setSwitchErr(e instanceof Error ? e.message : String(e));
      setSelLoc(activeLoc); // volta o destaque para a ficha realmente sincronizada
    } finally {
      setSwitching(false);
    }
  }

  const rev = data?.reviews || null;
  const details = data?.details || null;
  const mediaItems = data?.media?.mediaItems || [];
  const keywords = (data?.keywords?.keywords || []).filter((k) => k.impressions > 0).sort((a, b) => b.impressions - a.impressions);

  const desc =
    `${acct.displayName || "ficha conectada"} · dados reais do Google · ${range.since} → ${range.until}`;

  const mapsUri = details?.location?.mapsUri || null;

  // ── KPIs-herói ──
  interface Hero { lbl: string; val: string; foot?: string }
  const heroes: Hero[] = [
    { lbl: "Impressões", val: impressionsTotal != null ? kfmt(impressionsTotal) : "—", foot: impressionsTotal != null ? `${kfmt(searchImpr)} busca · ${kfmt(mapsImpr)} Maps` : "vistas da ficha" },
    { lbl: "Pedidos de rota", val: mtot("BUSINESS_DIRECTION_REQUESTS") != null ? fmt(mtot("BUSINESS_DIRECTION_REQUESTS")!) : "—", foot: "toques em 'Como chegar'" },
    { lbl: "Cliques no site", val: mtot("WEBSITE_CLICKS") != null ? fmt(mtot("WEBSITE_CLICKS")!) : "—", foot: "para o site" },
    { lbl: "Cliques para ligar", val: mtot("CALL_CLICKS") != null ? fmt(mtot("CALL_CLICKS")!) : "—", foot: "ligações a partir da ficha" },
  ];

  // ── Desempenho no tempo (série diária) ──
  const PERF: { v: string; l: string; color: string; keys: string[] }[] = [
    { v: "impressions", l: "Impressões", color: CY, keys: IMPRESSION_KEYS },
    { v: "BUSINESS_DIRECTION_REQUESTS", l: "Rotas", color: GREEN, keys: ["BUSINESS_DIRECTION_REQUESTS"] },
    { v: "WEBSITE_CLICKS", l: "Cliques no site", color: YELLOW, keys: ["WEBSITE_CLICKS"] },
    { v: "CALL_CLICKS", l: "Cliques para ligar", color: RED, keys: ["CALL_CLICKS"] },
    { v: "BUSINESS_CONVERSATIONS", l: "Conversas", color: PURPLE, keys: ["BUSINESS_CONVERSATIONS"] },
  ].filter((o) => o.keys.some((k) => metrics[k] != null));
  const perfLbl = (v: string) => PERF.find((o) => o.v === v)?.l || v;
  const perfColor = (v: string) => PERF.find((o) => o.v === v)?.color || CY;
  const togglePerf = (v: string) =>
    setPerfSel((prev) => (prev.includes(v) ? (prev.length > 1 ? prev.filter((x) => x !== v) : prev) : [...prev, v]));

  // datas de referência (todas as métricas compartilham o mesmo eixo diário)
  const refVals = PERF.length ? (metrics[PERF[0].keys[0]]?.values || []) : [];
  const dateLabels = refVals.map((p) => p.date.slice(5));
  const seriesForOpt = (v: string): number[] => {
    const o = PERF.find((x) => x.v === v);
    if (!o) return [];
    return refVals.map((_, i) => sum(o.keys.map((k) => metrics[k]?.values?.[i]?.value ?? 0)));
  };
  const showPerf = PERF.length > 0 && dateLabels.length > 1 && isActiveSel;
  const activePerfSel = perfSel.filter((v) => PERF.some((o) => o.v === v));
  const perfMetricsToShow = activePerfSel.length ? activePerfSel : (PERF[0] ? [PERF[0].v] : []);

  function perfSvg(): string {
    return lineChart(
      dateLabels,
      perfMetricsToShow.map((v) => ({
        name: perfLbl(v), color: perfColor(v), data: seriesForOpt(v), fill: perfMetricsToShow.length === 1,
      } as LineSeries)),
      { h: 250, sel: dateLabels.length - 1 }
    );
  }

  // ── "Como te encontram" (impressões por superfície/dispositivo) ──
  const imprRows = IMPRESSION_KEYS.filter((k) => metrics[k] != null).map((k) => ({ k, v: mtot(k) ?? 0 }));
  const imprMax = Math.max(1, ...imprRows.map((r) => r.v));
  const showImpr = imprRows.length > 0 && isActiveSel;

  // ── Ações dos clientes ──
  const actionRows = ([
    { k: "Pedidos de rota", key: "BUSINESS_DIRECTION_REQUESTS" },
    { k: "Cliques no site", key: "WEBSITE_CLICKS" },
    { k: "Cliques para ligar", key: "CALL_CLICKS" },
    { k: "Conversas", key: "BUSINESS_CONVERSATIONS" },
    { k: "Agendamentos", key: "BUSINESS_BOOKINGS" },
  ] as const).filter((r) => metrics[r.key] != null);
  const showActions = actionRows.length > 0 && isActiveSel;

  const showKeywords = keywords.length > 0 && isActiveSel;
  const kwMax = Math.max(1, ...keywords.map((k) => k.impressions));

  const showReviews = !!rev && isActiveSel && (rev.totalReviewCount != null || (rev.reviews?.length ?? 0) > 0);
  const showFicha = isActiveSel && (!!details || mediaItems.length > 0);

  return (
    <>
      <PageHead
        eyebrow={eyebrow}
        title={label}
        desc={desc}
        right={mapsUri ? <a className="btn-link" href={mapsUri} target="_blank" rel="noopener">Abrir no Maps ↗</a> : undefined}
      />

      {loading && <Spinner texto="Carregando métricas do Google…" />}
      {err && <div className="auth-err">{err}</div>}

      {!loading && !err && (
        <>
          {/* Seletor de localização (fichas) — troca a ficha SINCRONIZADA */}
          {locations.length > 1 && (
            <div className="card pad-lg" style={{ marginBottom: 16 }}>
              <div className="card-head" style={{ marginBottom: 10 }}>
                <div>
                  <div className="t">Localização</div>
                  <div className="sub">
                    {locations.length} fichas · uma ficha sincronizada por vez — ao trocar, as métricas passam a ser dessa ficha
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {locations.map((l) => {
                  const on = (selLoc ?? activeLoc) === l.id;
                  const isActive = l.id === activeLoc;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => switchLocation(l.id)}
                      disabled={switching}
                      aria-pressed={on}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                        padding: "8px 12px", borderRadius: 12, cursor: switching ? "default" : "pointer",
                        textAlign: "left", maxWidth: 260, opacity: switching && !on ? 0.55 : 1,
                        border: `1.5px solid ${on ? CY : "rgba(0,0,0,.10)"}`,
                        background: on ? "rgba(66,133,244,.08)" : "var(--white, #fff)",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 650, fontSize: 12.5, color: "var(--ink,#121111)" }}>
                        {isActive && <i style={{ width: 7, height: 7, borderRadius: 99, background: GREEN, display: "inline-block" }} />}
                        {(l.name || "").split("|")[0].replace(/Seahub Coworking\s*-\s*/i, "").trim() || l.name}
                      </span>
                      {l.address && <span style={{ fontSize: 11, color: "var(--label-3,#8E8E93)" }}>{l.address}</span>}
                      {isActive && <span style={{ fontSize: 10.5, color: GREEN, fontWeight: 600 }}>ficha sincronizada · métricas ao vivo</span>}
                    </button>
                  );
                })}
              </div>
              {switchErr && (
                <div className="auth-err" style={{ marginTop: 12, marginBottom: 0 }}>{switchErr}</div>
              )}
            </div>
          )}

          {switching && <Spinner texto="Sincronizando ficha…" />}

          {!switching && isActiveSel && (
            <>
              {/* KPIs-herói */}
              <div className="grid kpis" style={{ marginBottom: 16 }}>
                {heroes.map((h, i) => (
                  <KpiCard key={i} lbl={h.lbl} val={h.val} foot={h.foot} />
                ))}
              </div>

              {/* Desempenho no tempo */}
              {showPerf && (
                <div className="card pad-lg tcard" style={{ marginBottom: 16, "--tcard-accent": CY } as CSSProperties}>
                  <div className="card-head">
                    <div>
                      <div className="t">Desempenho no tempo</div>
                      <div className="sub">Série diária · {perfMetricsToShow.map(perfLbl).join(" + ")}</div>
                    </div>
                    <div className="seg small" role="group" aria-label="Métricas" style={{ flexWrap: "wrap" }}>
                      {PERF.map((o) => {
                        const on = perfMetricsToShow.includes(o.v);
                        return (
                          <button
                            key={o.v}
                            type="button"
                            className={on ? "on" : ""}
                            aria-pressed={on}
                            onClick={() => togglePerf(o.v)}
                            style={on ? ({ "--chip-accent": o.color } as CSSProperties) : undefined}
                          >
                            {o.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Chart svg={perfSvg()} />
                  <div className="legend">
                    {perfMetricsToShow.map((m) => (
                      <span key={m}><i style={{ background: perfColor(m) }} />{perfLbl(m)}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cards secundários */}
              <div className="si-flow">
                {showImpr && (
                  <div className="card pad-lg tcard" style={{ "--tcard-accent": CY } as CSSProperties}>
                    <div className="card-head">
                      <div>
                        <div className="t">Como te encontram</div>
                        <div className="sub">{impressionsTotal != null ? `${kfmt(impressionsTotal)} impressões no período` : "impressões da ficha"}</div>
                      </div>
                    </div>
                    {imprRows.map((r) => (
                      <BarRow key={r.k} k={IMPRESSION_PT[r.k] || r.k} v={r.v} max={imprMax} color={CY} formatted={fmt(r.v)} />
                    ))}
                    <div className="insight" style={{ marginTop: 12 }}>
                      <div className="ib" style={{ background: searchImpr >= mapsImpr ? CY : GREEN }} />
                      <p>{searchImpr >= mapsImpr
                        ? <>A maioria das impressões vem da <b>Busca</b> do Google.</>
                        : <>A maioria das impressões vem do <b>Google Maps</b>.</>}</p>
                    </div>
                  </div>
                )}

                {showActions && (
                  <div className="card pad-lg tcard" style={{ "--tcard-accent": GREEN } as CSSProperties}>
                    <div className="card-head"><div className="t">Ações dos clientes</div></div>
                    <div className="mini">
                      {actionRows.map((r) => (
                        <MiniStat key={r.key} l={r.k} n={fmt(mtot(r.key) ?? 0)} />
                      ))}
                    </div>
                  </div>
                )}

                {showReviews && rev && (
                  <div className="card pad-lg tcard" style={{ "--tcard-accent": YELLOW } as CSSProperties}>
                    <div className="card-head">
                      <div>
                        <div className="t">Avaliações</div>
                        <div className="sub">{rev.totalReviewCount != null ? `${fmt(rev.totalReviewCount)} avaliações no total` : "avaliações recentes"}</div>
                      </div>
                    </div>
                    {rev.averageRating != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0 12px" }}>
                        <span className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.5px" }}>
                          {rev.averageRating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <Stars rating={rev.averageRating} />
                          <span style={{ fontSize: 11, color: "var(--label-3,#8E8E93)" }}>média geral</span>
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {(rev.reviews || []).slice(0, 4).map((r) => (
                        <ReviewItem key={r.id} review={r} accountId={acct._id} />
                      ))}
                    </div>
                    {details?.location?.reviewUrl && (
                      <div style={{ marginTop: 12 }}>
                        <a href={details.location.reviewUrl} target="_blank" rel="noopener" style={{ color: "var(--cyan)", fontWeight: 600, fontSize: 12.5 }}>Pedir avaliação ↗</a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Termos de busca */}
              {showKeywords && (
                <div className="card pad-lg tcard" style={{ marginTop: 16, "--tcard-accent": "var(--ink)" } as CSSProperties}>
                  <div className="card-head">
                    <div>
                      <div className="t">Termos de busca</div>
                      <div className="sub">
                        o que as pessoas pesquisaram antes de ver a ficha
                        {data?.keywords?.monthRange ? ` · ${data.keywords.monthRange.startMonth} → ${data.keywords.monthRange.endMonth}` : ""}
                      </div>
                    </div>
                  </div>
                  {keywords.slice(0, 12).map((k, i) => (
                    <BarRow key={i} k={`${i + 1}. ${k.keyword}`} v={k.impressions} max={kwMax} color={CY} formatted={fmt(k.impressions)} />
                  ))}
                </div>
              )}

              {/* Ficha (dados + fotos) */}
              {showFicha && (
                <div className="card pad-lg tcard" style={{ marginTop: 16, "--tcard-accent": RED } as CSSProperties}>
                  <div className="card-head">
                    <div>
                      <div className="t">Ficha</div>
                      <div className="sub">{details?.categories?.primaryCategory?.displayName || "Perfil da Empresa no Google"}</div>
                    </div>
                    {details?.location?.isVerified && <span className="badge">Verificada</span>}
                  </div>
                  <div className="mini" style={{ marginBottom: 4 }}>
                    <MiniStat l="Telefone" n={details?.phoneNumbers?.primaryPhone || "—"} />
                    <MiniStat l="Endereço" n={selLocObj?.address || locations.find((l) => l.id === activeLoc)?.address || "—"} />
                    {mapsUri && <MiniStat l="Maps" n={<a href={mapsUri} target="_blank" rel="noopener" style={{ color: "var(--cyan)" }}>abrir ↗</a>} />}
                    <MiniStat l="Fotos" n={fmt(mediaItems.length)} />
                  </div>
                  {mediaItems.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 8, marginTop: 12 }}>
                      {mediaItems.slice(0, 12).map((m) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={m.name}
                          src={m.thumbnailUrl || m.googleUrl}
                          alt="Foto da ficha"
                          loading="lazy"
                          style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 10, background: "var(--cream,#EDEDEC)" }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="insight" style={{ marginTop: 14 }}>
                    <div className="ib" style={{ background: "var(--label-3,#8E8E93)" }} />
                    <p>Edição da ficha (fotos, produtos, horários) pela plataforma — <b>em breve</b>. Por ora, edite direto no Perfil da Empresa no Google.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

// ── Avaliação individual + resposta do dono (escrita pelo USUÁRIO) ──
// A resposta vai para a Zernio (POST .../reply) e fica associada à ficha sincronizada.
// TODO(ia): sugerir/gerar resposta com IA (Dionísio) — resposta automática por IA é frente futura.
function ReviewItem({ review, accountId }: { review: GbpReview; accountId: string }) {
  const txt = (review.comment || "").replace(/\s*\(Translated by Google\)[\s\S]*$/i, "").replace(/\s+/g, " ").trim();
  const short = txt.length > 220 ? txt.slice(0, 220) + "…" : txt;
  const existing = review.reviewReply?.comment?.replace(/\s+/g, " ").trim() || null;

  const [reply, setReply] = useState<string | null>(existing);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const comment = draft.trim();
    if (!comment) { setError("Escreva uma resposta antes de enviar."); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/zernio/gbp/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", accountId, reviewId: review.id, comment }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.error) throw new Error(j?.error || "Falha ao enviar a resposta.");
      setReply(comment);
      setDraft("");
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid rgba(0,0,0,.06)", paddingTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{review.reviewer?.displayName || "Cliente"}</span>
        {review.rating != null && <Stars rating={review.rating} size={12} />}
      </div>
      {short && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--label-2,#6E6E73)" }}>{short}</p>}
      {review.createTime && (
        <span style={{ fontSize: 10.5, color: "var(--label-3,#8E8E93)" }}>
          {review.createTime.slice(0, 10).split("-").reverse().join("/")}
        </span>
      )}

      {/* Resposta publicada */}
      {reply && (
        <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "rgba(66,133,244,.06)", borderLeft: `2px solid ${CY}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: CY }}>Resposta do dono</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: GREEN }}>respondida ✓</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--label-2,#6E6E73)" }}>{reply}</p>
        </div>
      )}

      {/* Formulário de resposta (texto do usuário) */}
      {!reply && !open && (
        <button
          type="button"
          onClick={() => { setOpen(true); setError(null); }}
          style={{
            marginTop: 8, padding: "5px 12px", borderRadius: 99, cursor: "pointer",
            border: `1.5px solid ${CY}`, background: "transparent", color: CY, fontWeight: 650, fontSize: 12,
          }}
        >
          Responder
        </button>
      )}

      {!reply && open && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva a resposta pública a este cliente…"
            rows={3}
            disabled={sending}
            style={{
              width: "100%", resize: "vertical", padding: "8px 10px", borderRadius: 10,
              border: "1.5px solid rgba(0,0,0,.12)", fontSize: 12.5, fontFamily: "inherit",
              color: "var(--ink,#121111)", background: "var(--white,#fff)", boxSizing: "border-box",
            }}
          />
          {error && <div style={{ marginTop: 6, fontSize: 11.5, color: RED }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={send}
              disabled={sending || !draft.trim()}
              style={{
                padding: "6px 14px", borderRadius: 99, cursor: sending || !draft.trim() ? "default" : "pointer",
                border: "none", background: CY, color: "#fff", fontWeight: 650, fontSize: 12,
                opacity: sending || !draft.trim() ? 0.6 : 1,
              }}
            >
              {sending ? "Enviando…" : "Responder"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setDraft(""); setError(null); }}
              disabled={sending}
              style={{
                padding: "6px 14px", borderRadius: 99, cursor: "pointer",
                border: "1.5px solid rgba(0,0,0,.12)", background: "transparent",
                color: "var(--label-2,#6E6E73)", fontWeight: 600, fontSize: 12,
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
