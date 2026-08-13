"use client";
// Canais Pagos — dashboard de mídia paga real (Zernio) + canais manuais.
// Geral no topo (consolidado), cada ad account como painel minimizável, tabela de
// campanhas, e canal pago manual (completo). Conexões espelham o Calendário.
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore, newId, type ManualAd } from "@/lib/store";
import { PageHead, KpiCard, MiniStat } from "@/components/ui";
import { ConexoesGrid } from "@/components/ConexoesGrid";
import { Ic } from "@/components/Ic";
import { Spinner } from "@/components/Spinner";
import { REDES } from "@/lib/seed-data";
import { fmt, money, pct, kfmt } from "@/lib/format";
import { daysInMonth, type Period } from "@/lib/scope";

// ── tipos da rota /api/zernio/ads ──
interface AdTotals {
  spend: number; impressions: number; clicks: number;
  ctr: number; cpc: number; cpm: number; reach: number; frequency: number;
  linkClicks: number; leads: number; messaging: number; purchases: number; cpl: number;
  landingViews: number; postEngagement: number; reactions: number; comments: number; videoViews: number;
}
// campanha rica (level=campaign). Campos essenciais sempre presentes; os demais podem faltar
// (ex.: linhas de "canais manuais" só têm o núcleo) — a expansão degrada com fallback.
interface AdCampaign {
  name: string; spend: number; impressions: number; clicks: number; ctr: number; leads: number;
  objective?: string; cpc?: number; cpm?: number; reach?: number; frequency?: number;
  inlineLinkClicks?: number; forms?: number; messaging?: number; landingViews?: number; cpl?: number;
}
interface AdAccountData {
  zernioAccountId: string; platform: string; id: string; name: string; currency: string;
  totals: AdTotals | null; campaigns: AdCampaign[];
}

// objective (Meta) → rótulo PT curto
const OBJETIVO_PT: Record<string, string> = {
  OUTCOME_LEADS: "Leads", OUTCOME_TRAFFIC: "Tráfego", OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_SALES: "Vendas", OUTCOME_AWARENESS: "Reconhecimento", OUTCOME_APP_PROMOTION: "App",
  LINK_CLICKS: "Tráfego", POST_ENGAGEMENT: "Engajamento", PAGE_LIKES: "Curtidas",
  LEAD_GENERATION: "Leads", CONVERSIONS: "Conversões", REACH: "Alcance",
  BRAND_AWARENESS: "Reconhecimento", VIDEO_VIEWS: "Vídeo", MESSAGES: "Mensagens", PRODUCT_CATALOG_SALES: "Vendas",
};
const objetivoPt = (o?: string) => (o ? OBJETIVO_PT[o] || o.replace(/^OUTCOME_/, "").toLowerCase() : "—");

// cache de módulo (stale-while-revalidate) por intervalo
const ADS_CACHE = new Map<string, AdAccountData[]>();

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// CTR já vem em pontos percentuais (1.19 = 1,19%); pct() espera fração, então dividimos
const pctv = (percent: number) => pct((Number(percent) || 0) / 100);
// ISO (YYYY-MM-DD) → dd/mm, para a narrativa
const ddmm = (isoStr: string) => `${isoStr.slice(8, 10)}/${isoStr.slice(5, 7)}`;

// frase automática do consolidado — só inclui orações com dado (>0)
function narrativaGeral(g: AdTotals, since: string, until: string): string | null {
  const parts: string[] = [];
  if (g.spend > 0) parts.push(`investiu ${money(g.spend)} em mídia paga`);
  if (g.leads > 0) parts.push(`gerou ${fmt(g.leads)} leads${g.cpl > 0 ? ` a ${money(g.cpl)} cada` : ""}`);
  if (g.ctr > 0) parts.push(`registrou CTR de ${pctv(g.ctr)}`);
  if (g.impressions > 0) parts.push(`somou ${kfmt(g.impressions)} impressões`);
  if (!parts.length) return null;
  const body = parts.length === 1
    ? parts[0]
    : parts.slice(0, -1).join(", ") + " e " + parts[parts.length - 1];
  return `No período de ${ddmm(since)} a ${ddmm(until)}, a empresa ${body}.`;
}

function dateRange(scope: { period: Period; year: number; month: number; quarter: number }) {
  const { period, year, month, quarter } = scope;
  let since: Date, until: Date;
  if (period === "trimestre") {
    since = new Date(year, quarter * 3, 1);
    until = new Date(year, quarter * 3 + 2, daysInMonth(year, quarter * 3 + 2));
  } else if (period === "ano") {
    since = new Date(year, 0, 1);
    until = new Date(year, 11, 31);
  } else {
    since = new Date(year, month, 1);
    until = new Date(year, month, daysInMonth(year, month));
  }
  return { since: iso(since), until: iso(until) };
}

// meses (y,m) dentro do escopo — pra filtrar os canais manuais
function monthsInScope(scope: { period: Period; year: number; month: number; quarter: number }): [number, number][] {
  const { period, year, month, quarter } = scope;
  if (period === "ano") return Array.from({ length: 12 }, (_, m) => [year, m] as [number, number]);
  if (period === "trimestre") return [0, 1, 2].map((i) => [year, quarter * 3 + i] as [number, number]);
  return [[year, month]];
}

const emptyTotals = (): AdTotals => ({
  spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, reach: 0, frequency: 0,
  linkClicks: 0, leads: 0, messaging: 0, purchases: 0, cpl: 0,
  landingViews: 0, postEngagement: 0, reactions: 0, comments: 0, videoViews: 0,
});

export function AdsView() {
  const s = useStore();
  const zernioAccounts = useStore((st) => st.zernioAccounts);
  const manualAds = useStore((st) => st.manualAds);

  const hasAdsConn = zernioAccounts.some((a) => a.adsStatus === "connected" || a.adsStatus === "active");
  const range = useMemo(() => dateRange(s), [s.period, s.year, s.month, s.quarter]); // eslint-disable-line react-hooks/exhaustive-deps
  const scopeMonths = useMemo(() => monthsInScope(s), [s.period, s.year, s.month, s.quarter]); // eslint-disable-line react-hooks/exhaustive-deps

  const [data, setData] = useState<AdAccountData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conxOpen, setConxOpen] = useState(false);
  const [openAcct, setOpenAcct] = useState<Record<string, boolean>>({});
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (!hasAdsConn) { setData([]); return; }
    const key = `${range.since}|${range.until}`;
    let alive = true;
    const cached = ADS_CACHE.get(key);
    if (cached) { setData(cached); setLoading(false); } else { setLoading(true); }
    setErr(null);
    fetch(`/api/zernio/ads?since=${range.since}&until=${range.until}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.ok && Array.isArray(d.accounts)) { ADS_CACHE.set(key, d.accounts); setData(d.accounts); }
        else if (!cached) setErr(d?.error || "Falha ao carregar mídia paga.");
      })
      .catch((e) => alive && !cached && setErr(String(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [hasAdsConn, range.since, range.until]);

  const manualCampaigns = useStore((st) => st.manualCampaigns);

  // canais manuais no escopo
  const manualInScope = manualAds.filter((m) => scopeMonths.some(([y, mo]) => y === m.ano && mo === m.mes));
  // dados manuais por campanha no escopo (vendas/receita/leads qualificados)
  const manualCampInScope = manualCampaigns.filter((m) => scopeMonths.some(([y, mo]) => y === m.ano && mo === m.mes));
  const manualRes = manualCampInScope.reduce(
    (acc, m) => ({ vendas: acc.vendas + m.vendas, receita: acc.receita + m.receita, leadsQualificados: acc.leadsQualificados + m.leadsQualificados }),
    { vendas: 0, receita: 0, leadsQualificados: 0 }
  );

  // consolidado geral (Zernio + manual)
  const geral = emptyTotals();
  (data || []).forEach((a) => {
    if (!a.totals) return;
    geral.spend += a.totals.spend; geral.impressions += a.totals.impressions; geral.clicks += a.totals.clicks;
    geral.reach += a.totals.reach; geral.linkClicks += a.totals.linkClicks; geral.leads += a.totals.leads;
    geral.messaging += a.totals.messaging; geral.purchases += a.totals.purchases; geral.landingViews += a.totals.landingViews;
  });
  manualInScope.forEach((m) => {
    geral.spend += m.gasto; geral.impressions += m.impressoes; geral.clicks += m.cliques; geral.leads += m.conversoes;
  });
  geral.ctr = geral.impressions ? (geral.clicks / geral.impressions) * 100 : 0;
  geral.cpc = geral.clicks ? geral.spend / geral.clicks : 0;
  geral.cpm = geral.impressions ? (geral.spend / geral.impressions) * 1000 : 0;
  geral.cpl = geral.leads ? geral.spend / geral.leads : 0;
  geral.frequency = geral.reach ? geral.impressions / geral.reach : 0;

  const nothing = !loading && !err && (data || []).length === 0 && manualInScope.length === 0;

  return (
    <>
      <PageHead
        eyebrow="COMERCIAL · AQUISIÇÃO"
        title="Canais Pagos"
        desc="Investimento, CPL e desempenho de campanhas — mídia paga conectada + canais informados à mão."
        right={
          <button className="btn-link ig" onClick={() => setShowManual((v) => !v)} type="button">
            <Ic name="upload" /> Canal manual
          </button>
        }
      />

      {/* Contas de anúncio conectadas — minimizada (espelha o Calendário) */}
      <div className={`card pad-lg${conxOpen ? " open" : ""}`} style={{ marginBottom: 14 }}>
        <div className="card-head" style={{ marginBottom: conxOpen ? 14 : 0, cursor: "pointer" }} onClick={() => setConxOpen((o) => !o)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div className="t">Contas de anúncio conectadas</div>
            {!conxOpen && (
              (data && data.length) ? (
                <div className="cc-conx-mini">
                  {REDES.filter((r) => r.grupo === "ads" && r.id === "metaads").map((r) => (
                    <span key={r.id} className="cc-conx-ico" style={{ background: r.cor }} title={r.label}>
                      <Ic name="facebook" />
                    </span>
                  ))}
                </div>
              ) : (
                <span className="cc-conx-none">nenhuma conectada</span>
              )
            )}
          </div>
          <span className="badge">{(data || []).length}</span>
          <svg className="acc-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ transform: conxOpen ? "rotate(180deg)" : "none", transition: ".18s", color: "var(--label-3)" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        {conxOpen && <ConexoesGrid grupos={["ads"]} />}
      </div>

      {showManual && <ManualForm onClose={() => setShowManual(false)} />}

      {loading && <Spinner texto="Carregando mídia paga…" />}
      {err && <div className="auth-err">{err}</div>}

      {nothing && !showManual && (
        <div className="empty">
          <div className="e-ico">📣</div>
          <h3>Sem investimento no período</h3>
          <p>
            Conecte uma conta de anúncio acima (ou em{" "}
            <Link href="/personalizacao" style={{ color: "var(--cyan)", fontWeight: 650 }}>Personalização → Conexões</Link>),
            ou adicione um <b>canal manual</b> pelo botão acima.
          </p>
        </div>
      )}

      {!loading && !err && (geral.spend > 0 || geral.impressions > 0) && (
        <>
          {/* Narrativa geral + KPIs-herói (acento vermelho) */}
          <div className="card pad-lg" style={{ marginBottom: 16, borderLeft: "3px solid var(--red)" }}>
            <div className="card-head" style={{ marginBottom: 12 }}>
              <div className="t">Investimento geral da empresa</div>
              <span className="badge">{ddmm(range.since)} → {ddmm(range.until)}</span>
            </div>
            {narrativaGeral(geral, range.since, range.until) && (
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "var(--label-1)", margin: "0 0 16px", maxWidth: 720 }}>
                {narrativaGeral(geral, range.since, range.until)}
              </p>
            )}
            <div className="grid kpis">
              <KpiCard lbl="Investimento" val={money(geral.spend)} foot="mídia paga no período" />
              <KpiCard lbl="Leads / conversões" val={fmt(geral.leads)} foot="resultados atribuídos" />
              <KpiCard lbl="Custo por lead" val={geral.cpl ? money(geral.cpl) : "—"} foot="CPL médio" />
              <KpiCard lbl="CTR" val={pctv(geral.ctr)} foot={`${kfmt(geral.impressions)} impressões`} />
            </div>

            {/* Indicadores agrupados por tema — soma de todas as contas + manual */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--hairline)" }}>
              <ThemeGroup title="Investimento" color="var(--red)">
                <MiniStat l="Investimento" n={money(geral.spend)} />
                <MiniStat l="CPC" n={geral.cpc ? money(geral.cpc) : "—"} />
                <MiniStat l="CPM" n={geral.cpm ? money(geral.cpm) : "—"} />
              </ThemeGroup>
              <ThemeGroup title="Alcance" color="var(--cyan)">
                <MiniStat l="Impressões" n={kfmt(geral.impressions)} />
                <MiniStat l="Alcance" n={geral.reach ? kfmt(geral.reach) : "—"} />
                <MiniStat l="Frequência" n={geral.frequency ? fmt(geral.frequency, 1) : "—"} />
              </ThemeGroup>
              <ThemeGroup title="Conversão" color="var(--excelente)">
                <MiniStat l="Leads" n={fmt(geral.leads)} />
                <MiniStat l="Custo/lead" n={geral.cpl ? money(geral.cpl) : "—"} />
                <MiniStat l="Conversas" n={fmt(geral.messaging)} />
                <MiniStat l="Page views (LP)" n={fmt(geral.landingViews)} />
                {geral.purchases > 0 && <MiniStat l="Compras" n={fmt(geral.purchases)} />}
                {manualRes.vendas > 0 && <MiniStat l="Vendas (manual)" n={fmt(manualRes.vendas)} />}
                {manualRes.receita > 0 && <MiniStat l="Receita (manual)" n={money(manualRes.receita)} />}
                {manualRes.leadsQualificados > 0 && <MiniStat l="Leads qualif. (manual)" n={fmt(manualRes.leadsQualificados)} />}
              </ThemeGroup>
            </div>
          </div>

          {/* Painéis por ad account — indicadores agrupados por tema */}
          {(data || []).map((a) => (
            <AdAccountPanel
              key={a.id}
              a={a}
              open={!!openAcct[a.id]}
              onToggle={() => setOpenAcct((o) => ({ ...o, [a.id]: !o[a.id] }))}
            />
          ))}

          {/* Canais manuais */}
          {manualInScope.length > 0 && (
            <div className="card" style={{ marginTop: 4, borderLeft: "3px solid var(--atencao)" }}>
              <div className="card-head"><div className="t">Canais manuais</div><span className="badge">{manualInScope.length}</span></div>
              <CampanhaTable
                manual
                campaigns={manualInScope.map((m) => ({
                  name: `${m.nome}${m.campanha ? " · " + m.campanha : ""}`,
                  spend: m.gasto, impressions: m.impressoes, clicks: m.cliques,
                  ctr: m.impressoes ? (m.cliques / m.impressoes) * 100 : m.ctr, leads: m.conversoes,
                }))}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

// bloco temático: título colorido + border-left do tema + MiniStats num .mini
function ThemeGroup({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: ".3px", textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div className="mini">{children}</div>
    </div>
  );
}

// painel de uma ad account — minimizável; expandido mostra indicadores agrupados por tema
// + narrativa própria + tabela de campanhas com filtro de busca
function AdAccountPanel({ a, open, onToggle }: { a: AdAccountData; open: boolean; onToggle: () => void }) {
  const t = a.totals || emptyTotals();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = query ? a.campaigns.filter((c) => c.name.toLowerCase().includes(query)) : a.campaigns;

  return (
    <div className={`card pad-lg${open ? " open" : ""}`} style={{ marginBottom: 12 }}>
      <div className="card-head" style={{ marginBottom: open ? 14 : 0, cursor: "pointer" }} onClick={onToggle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span className="cc-conx-ico" style={{ background: "#1877F2" }}><Ic name="facebook" /></span>
          <div style={{ minWidth: 0 }}>
            <div className="t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
            <div className="sub">Meta Ads · {a.currency} · {money(t.spend)} · {fmt(t.leads)} leads</div>
          </div>
        </div>
        <span className="badge">{a.campaigns.length} camp.</span>
        <svg className="acc-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ transform: open ? "rotate(180deg)" : "none", transition: ".18s", color: "var(--label-3)" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      {open && (
        <>
          {/* narrativa da conta */}
          <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--label-2)", margin: "0 0 14px" }}>
            <b style={{ color: "var(--label-1)" }}>{a.name}</b> investiu {money(t.spend)} e trouxe {fmt(t.leads)} leads
            {t.cpl > 0 ? <> (CPL {money(t.cpl)})</> : null}.
          </p>

          {/* indicadores agrupados por tema */}
          <ThemeGroup title="Investimento" color="var(--red)">
            <MiniStat l="Investimento" n={money(t.spend)} />
            <MiniStat l="CPC" n={t.cpc ? money(t.cpc) : "—"} />
            <MiniStat l="CPM" n={t.cpm ? money(t.cpm) : "—"} />
          </ThemeGroup>

          <ThemeGroup title="Alcance" color="var(--cyan)">
            <MiniStat l="Impressões" n={kfmt(t.impressions)} />
            <MiniStat l="Alcance" n={kfmt(t.reach)} />
            <MiniStat l="Frequência" n={fmt(t.frequency, 1)} />
          </ThemeGroup>

          <ThemeGroup title="Engajamento" color="var(--ink)">
            <MiniStat l="Engaj. de posts" n={fmt(t.postEngagement)} />
            <MiniStat l="Reações" n={fmt(t.reactions)} />
            <MiniStat l="Comentários" n={fmt(t.comments)} />
            <MiniStat l="Views de vídeo" n={fmt(t.videoViews)} />
          </ThemeGroup>

          <ThemeGroup title="Conversão" color="var(--excelente)">
            <MiniStat l="Leads" n={fmt(t.leads)} />
            <MiniStat l="Custo/lead" n={t.cpl ? money(t.cpl) : "—"} />
            <MiniStat l="Conversas" n={fmt(t.messaging)} />
            <MiniStat l="Page views (LP)" n={fmt(t.landingViews)} />
            <MiniStat l="Compras" n={fmt(t.purchases)} />
          </ThemeGroup>

          {/* tabela de campanhas com filtro */}
          {a.campaigns.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div className="card-head" style={{ marginBottom: 10 }}>
                <div className="t" style={{ fontSize: 13 }}>Campanhas</div>
                <input
                  className="field-edit"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filtrar campanhas…"
                  style={{ maxWidth: 240 }}
                  aria-label="Filtrar campanhas por nome"
                />
              </div>
              {query && (
                <div className="sub" style={{ fontSize: 12, color: "var(--label-3)", marginBottom: 8 }}>
                  {filtered.length} de {a.campaigns.length} campanhas
                </div>
              )}
              {filtered.length > 0
                ? <CampanhaTable campaigns={filtered} adAccountId={a.id} />
                : <div className="sub" style={{ fontSize: 12.5, color: "var(--label-3)" }}>Nenhuma campanha corresponde a “{q}”.</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Lista de campanhas em linhas EXPANDÍVEIS. Colunas essenciais sempre visíveis
// (Campanha · Objetivo · Investimento · CTR · Leads); clicar expande a viz agrupada.
function CampanhaTable({ campaigns, manual, adAccountId }: { campaigns: AdCampaign[]; manual?: boolean; adAccountId?: string }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const colSpan = manual ? 5 : 6;
  return (
    <div className="rel-scroll">
      <table className="rel-tbl ads-tbl">
        <thead>
          <tr>
            <th style={{ width: 26 }} aria-hidden />
            <th style={{ textAlign: "left" }}>{manual ? "Canal / campanha" : "Campanha"}</th>
            {!manual && <th style={{ textAlign: "left" }}>Objetivo</th>}
            <th>Investimento</th><th>CTR</th><th>Leads</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => {
            const isOpen = !!open[i];
            return (
              <Fragment key={i}>
                <tr onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))} style={{ cursor: "pointer" }}>
                  <td style={{ textAlign: "center" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: ".18s", color: "var(--label-3)", verticalAlign: "middle" }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </td>
                  <td className="rel-prod" style={{ textAlign: "left", maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</td>
                  {!manual && (
                    <td style={{ textAlign: "left" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--cyan)", background: "rgba(0,187,197,.10)", padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
                        {objetivoPt(c.objective)}
                      </span>
                    </td>
                  )}
                  <td className="tnum">{money(c.spend)}</td>
                  <td className="tnum">{pctv(c.ctr)}</td>
                  <td className="tnum">{fmt(c.leads)}</td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={colSpan} style={{ padding: 0, background: "rgba(0,0,0,.02)" }}>
                      <CampaignExpand c={c} adAccountId={adAccountId} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// destaque por objetivo — mostra primeiro o que importa pra aquele tipo de campanha
function highlightFor(c: AdCampaign, cpl: number): { l: string; n: React.ReactNode }[] {
  const o = c.objective || "";
  if (o === "OUTCOME_LEADS" || o === "LEAD_GENERATION")
    return [{ l: "Leads", n: fmt(c.leads) }, { l: "Custo/lead", n: cpl ? money(cpl) : "—" }, { l: "Formulários", n: c.forms != null ? fmt(c.forms) : "—" }];
  if (o === "OUTCOME_ENGAGEMENT" || o === "POST_ENGAGEMENT" || o === "MESSAGES")
    return [{ l: "Conversas", n: c.messaging != null ? fmt(c.messaging) : "—" }, { l: "Cliques", n: fmt(c.clicks) }, { l: "CTR", n: pctv(c.ctr) }];
  if (o === "OUTCOME_TRAFFIC" || o === "LINK_CLICKS")
    return [{ l: "Cliques no link", n: c.inlineLinkClicks != null ? fmt(c.inlineLinkClicks) : fmt(c.clicks) }, { l: "CTR", n: pctv(c.ctr) }, { l: "CPC", n: c.cpc ? money(c.cpc) : "—" }];
  if (o === "OUTCOME_AWARENESS" || o === "REACH" || o === "BRAND_AWARENESS")
    return [{ l: "Alcance", n: c.reach ? kfmt(c.reach) : "—" }, { l: "Impressões", n: kfmt(c.impressions) }, { l: "Frequência", n: c.frequency ? fmt(c.frequency, 1) : "—" }];
  return [{ l: "Investimento", n: money(c.spend) }, { l: "CTR", n: pctv(c.ctr) }, { l: "Leads", n: fmt(c.leads) }];
}

// conteúdo da linha expandida — grupos temáticos + dados manuais da campanha
function CampaignExpand({ c, adAccountId }: { c: AdCampaign; adAccountId?: string }) {
  const s = useStore();
  const manualCampaigns = useStore((st) => st.manualCampaigns);
  const removeManualCampaign = useStore((st) => st.removeManualCampaign);
  const [formOpen, setFormOpen] = useState(false);

  const months = monthsInScope(s);
  const linked = adAccountId
    ? manualCampaigns.filter((m) => m.adAccountId === adAccountId && m.campaignName === c.name && months.some(([y, mo]) => y === m.ano && mo === m.mes))
    : [];
  const mAgg = linked.reduce(
    (a, m) => ({ vendas: a.vendas + m.vendas, receita: a.receita + m.receita, leadsQualificados: a.leadsQualificados + m.leadsQualificados }),
    { vendas: 0, receita: 0, leadsQualificados: 0 }
  );

  const cpl = c.cpl ?? (c.leads ? c.spend / c.leads : 0);
  const destaque = highlightFor(c, cpl);

  return (
    <div style={{ padding: "14px 16px 8px" }}>
      {/* destaque por objetivo */}
      <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: 14 }}>
        {destaque.map((d, i) => (
          <div key={i}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".3px", textTransform: "uppercase", color: "var(--label-3)" }}>{d.l}</div>
            <div className="tnum" style={{ fontSize: 19, fontWeight: 700, color: "var(--label)", marginTop: 2 }}>{d.n}</div>
          </div>
        ))}
      </div>

      <ThemeGroup title="Investimento" color="var(--red)">
        <MiniStat l="Investimento" n={money(c.spend)} />
        <MiniStat l="CPC" n={c.cpc ? money(c.cpc) : "—"} />
        <MiniStat l="CPM" n={c.cpm ? money(c.cpm) : "—"} />
      </ThemeGroup>
      <ThemeGroup title="Alcance" color="var(--cyan)">
        <MiniStat l="Impressões" n={kfmt(c.impressions)} />
        <MiniStat l="Alcance" n={c.reach ? kfmt(c.reach) : "—"} />
        <MiniStat l="Frequência" n={c.frequency ? fmt(c.frequency, 1) : "—"} />
      </ThemeGroup>
      <ThemeGroup title="Engajamento" color="var(--ink)">
        <MiniStat l="Cliques" n={fmt(c.clicks)} />
        <MiniStat l="Cliques no link" n={c.inlineLinkClicks != null ? fmt(c.inlineLinkClicks) : "—"} />
      </ThemeGroup>
      <ThemeGroup title="Conversão" color="var(--excelente)">
        <MiniStat l="Leads" n={fmt(c.leads)} />
        <MiniStat l="Custo/lead" n={cpl ? money(cpl) : "—"} />
        <MiniStat l="Formulários" n={c.forms != null ? fmt(c.forms) : "—"} />
        <MiniStat l="Conversas" n={c.messaging != null ? fmt(c.messaging) : "—"} />
        <MiniStat l="Page views (LP)" n={c.landingViews != null ? fmt(c.landingViews) : "—"} />
      </ThemeGroup>

      {(mAgg.vendas > 0 || mAgg.receita > 0 || mAgg.leadsQualificados > 0) && (
        <ThemeGroup title="Manual" color="var(--atencao)">
          {mAgg.vendas > 0 && <MiniStat l="Vendas" n={fmt(mAgg.vendas)} />}
          {mAgg.receita > 0 && <MiniStat l="Receita" n={money(mAgg.receita)} />}
          {mAgg.leadsQualificados > 0 && <MiniStat l="Leads qualificados" n={fmt(mAgg.leadsQualificados)} />}
        </ThemeGroup>
      )}

      {/* input manual por campanha (só campanhas reais, com ad account) */}
      {adAccountId && (
        <div style={{ marginTop: 2 }}>
          {!formOpen ? (
            <button className="btn-link ig" type="button" onClick={() => setFormOpen(true)}>+ dados manuais</button>
          ) : (
            <ManualCampaignForm adAccountId={adAccountId} campaignName={c.name} onClose={() => setFormOpen(false)} />
          )}
          {linked.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {linked.map((m) => (
                <div className="toggle-row" key={m.id}>
                  <div className="tinfo">
                    <b>{MESES[m.mes]}/{m.ano}</b>
                    <span>
                      {[
                        m.vendas ? `${fmt(m.vendas)} vendas` : null,
                        m.receita ? money(m.receita) : null,
                        m.leadsQualificados ? `${fmt(m.leadsQualificados)} LQ` : null,
                      ].filter(Boolean).join(" · ") || "—"}
                      {m.obs ? ` · ${m.obs}` : ""}
                    </span>
                  </div>
                  <button className="x" type="button" onClick={() => removeManualCampaign(m.id)} aria-label="Remover">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ManualCampaignForm({ adAccountId, campaignName, onClose }: { adAccountId: string; campaignName: string; onClose: () => void }) {
  const s = useStore();
  const addManualCampaign = useStore((st) => st.addManualCampaign);
  const [f, setF] = useState({ ano: s.year, mes: s.month, vendas: 0, receita: 0, leadsQualificados: 0, obs: "" });
  const nnum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

  function salvar() {
    addManualCampaign({
      id: newId("mcamp"), adAccountId, campaignName,
      ano: f.ano, mes: f.mes,
      vendas: f.vendas, receita: f.receita, leadsQualificados: f.leadsQualificados, obs: f.obs.trim(),
    });
    onClose();
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="card-head" style={{ marginBottom: 8 }}>
        <div className="t" style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Dados manuais · {campaignName}</div>
        <button className="btn-link" type="button" onClick={onClose}>Fechar</button>
      </div>
      <div className="pm-hint" style={{ marginBottom: 10 }}>O que o Meta não entrega — vendas, receita e leads qualificados. Entra no consolidado geral.</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        <Field lbl="Mês">
          <select className="field-edit" value={f.mes} onChange={(e) => setF((p) => ({ ...p, mes: Number(e.target.value) }))}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </Field>
        <Field lbl="Ano"><input className="field-edit" type="number" value={f.ano} onChange={(e) => setF((p) => ({ ...p, ano: Number(e.target.value) }))} /></Field>
        <Field lbl="Vendas"><input className="field-edit" inputMode="numeric" onChange={(e) => setF((p) => ({ ...p, vendas: nnum(e.target.value) }))} placeholder="0" /></Field>
        <Field lbl="Receita (R$)"><input className="field-edit" inputMode="decimal" onChange={(e) => setF((p) => ({ ...p, receita: nnum(e.target.value) }))} placeholder="0,00" /></Field>
        <Field lbl="Leads qualificados"><input className="field-edit" inputMode="numeric" onChange={(e) => setF((p) => ({ ...p, leadsQualificados: nnum(e.target.value) }))} placeholder="0" /></Field>
        <Field lbl="Observação"><input className="field-edit" value={f.obs} onChange={(e) => setF((p) => ({ ...p, obs: e.target.value }))} placeholder="opcional" /></Field>
      </div>
      <div style={{ marginTop: 10 }}>
        <button className="btn-link ig" type="button" onClick={salvar}>+ Salvar dados</button>
      </div>
    </div>
  );
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function ManualForm({ onClose }: { onClose: () => void }) {
  const addManualAd = useStore((st) => st.addManualAd);
  const manualAds = useStore((st) => st.manualAds);
  const removeManualAd = useStore((st) => st.removeManualAd);
  const s = useStore();
  const [f, setF] = useState<Partial<ManualAd>>({
    nome: "", plataforma: "Meta Ads", ano: s.year, mes: s.month, campanha: "",
    gasto: 0, impressoes: 0, cliques: 0, ctr: 0, cpc: 0, cpm: 0, conversoes: 0,
  });
  const set = (patch: Partial<ManualAd>) => setF((p) => ({ ...p, ...patch }));
  const nnum = (v: string) => Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;

  function salvar() {
    if (!f.nome?.trim()) return;
    const gasto = f.gasto || 0, impressoes = f.impressoes || 0, cliques = f.cliques || 0;
    addManualAd({
      id: newId("mad"), nome: f.nome.trim(), plataforma: f.plataforma || "Manual",
      ano: f.ano ?? s.year, mes: f.mes ?? s.month, campanha: f.campanha || "",
      gasto, impressoes, cliques, conversoes: f.conversoes || 0,
      ctr: f.ctr || (impressoes ? (cliques / impressoes) * 100 : 0),
      cpc: f.cpc || (cliques ? gasto / cliques : 0),
      cpm: f.cpm || (impressoes ? (gasto / impressoes) * 1000 : 0),
    });
    setF((p) => ({ ...p, nome: "", campanha: "", gasto: 0, impressoes: 0, cliques: 0, ctr: 0, cpc: 0, cpm: 0, conversoes: 0 }));
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div className="t">Canal pago manual</div>
        <button className="btn-link" onClick={onClose} type="button">Fechar</button>
      </div>
      <div className="pm-hint" style={{ marginBottom: 10 }}>Informe o desempenho à mão — alimenta o consolidado geral. CTR/CPC/CPM são calculados se deixar em branco.</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <Field lbl="Nome do canal"><input className="field-edit" value={f.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Parceria influencer" /></Field>
        <Field lbl="Plataforma"><input className="field-edit" value={f.plataforma} onChange={(e) => set({ plataforma: e.target.value })} /></Field>
        <Field lbl="Campanha"><input className="field-edit" value={f.campanha} onChange={(e) => set({ campanha: e.target.value })} placeholder="opcional" /></Field>
        <Field lbl="Mês">
          <select className="field-edit" value={f.mes} onChange={(e) => set({ mes: Number(e.target.value) })}>
            {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </Field>
        <Field lbl="Ano"><input className="field-edit" type="number" value={f.ano} onChange={(e) => set({ ano: Number(e.target.value) })} /></Field>
        <Field lbl="Investimento (R$)"><input className="field-edit" inputMode="decimal" onChange={(e) => set({ gasto: nnum(e.target.value) })} placeholder="0,00" /></Field>
        <Field lbl="Impressões"><input className="field-edit" inputMode="numeric" onChange={(e) => set({ impressoes: nnum(e.target.value) })} placeholder="0" /></Field>
        <Field lbl="Cliques"><input className="field-edit" inputMode="numeric" onChange={(e) => set({ cliques: nnum(e.target.value) })} placeholder="0" /></Field>
        <Field lbl="Leads / conversões"><input className="field-edit" inputMode="numeric" onChange={(e) => set({ conversoes: nnum(e.target.value) })} placeholder="0" /></Field>
        <Field lbl="CTR (%)"><input className="field-edit" inputMode="decimal" onChange={(e) => set({ ctr: nnum(e.target.value) })} placeholder="auto" /></Field>
        <Field lbl="CPC (R$)"><input className="field-edit" inputMode="decimal" onChange={(e) => set({ cpc: nnum(e.target.value) })} placeholder="auto" /></Field>
        <Field lbl="CPM (R$)"><input className="field-edit" inputMode="decimal" onChange={(e) => set({ cpm: nnum(e.target.value) })} placeholder="auto" /></Field>
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn-link ig" onClick={salvar} type="button">+ Adicionar canal</button>
      </div>

      {manualAds.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="ind-h" style={{ marginBottom: 6 }}>Canais manuais cadastrados</div>
          {manualAds.map((m) => (
            <div className="toggle-row" key={m.id}>
              <div className="tinfo">
                <b>{m.nome} <span style={{ color: "var(--label-3)", fontWeight: 500 }}>· {MESES[m.mes]}/{m.ano}</span></b>
                <span>{m.plataforma} · {money(m.gasto)} · {fmt(m.conversoes)} leads</span>
              </div>
              <button className="x" onClick={() => removeManualAd(m.id)} aria-label="Remover" type="button">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ lbl, children }: { lbl: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-lbl">{lbl}</label>
      {children}
    </div>
  );
}
