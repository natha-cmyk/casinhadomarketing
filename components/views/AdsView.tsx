"use client";
// Canais Pagos — dashboard de mídia paga real (Zernio) + canais manuais.
// Geral no topo (consolidado), cada ad account como painel minimizável, tabela de
// campanhas, e canal pago manual (completo). Conexões espelham o Calendário.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore, newId, type ManualAd } from "@/lib/store";
import { PageHead, KpiCard } from "@/components/ui";
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
}
interface AdCampaign { name: string; spend: number; impressions: number; clicks: number; ctr: number; leads: number }
interface AdAccountData {
  zernioAccountId: string; platform: string; id: string; name: string; currency: string;
  totals: AdTotals | null; campaigns: AdCampaign[];
}

// cache de módulo (stale-while-revalidate) por intervalo
const ADS_CACHE = new Map<string, AdAccountData[]>();

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// CTR já vem em pontos percentuais (1.19 = 1,19%); pct() espera fração, então dividimos
const pctv = (percent: number) => pct((Number(percent) || 0) / 100);

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
    fetch(`/api/zernio/ads?since=${range.since}&until=${range.until}`)
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

  // canais manuais no escopo
  const manualInScope = manualAds.filter((m) => scopeMonths.some(([y, mo]) => y === m.ano && mo === m.mes));

  // consolidado geral (Zernio + manual)
  const geral = emptyTotals();
  (data || []).forEach((a) => {
    if (!a.totals) return;
    geral.spend += a.totals.spend; geral.impressions += a.totals.impressions; geral.clicks += a.totals.clicks;
    geral.reach += a.totals.reach; geral.linkClicks += a.totals.linkClicks; geral.leads += a.totals.leads;
    geral.messaging += a.totals.messaging; geral.purchases += a.totals.purchases;
  });
  manualInScope.forEach((m) => {
    geral.spend += m.gasto; geral.impressions += m.impressoes; geral.clicks += m.cliques; geral.leads += m.conversoes;
  });
  geral.ctr = geral.impressions ? (geral.clicks / geral.impressions) * 100 : 0;
  geral.cpc = geral.clicks ? geral.spend / geral.clicks : 0;
  geral.cpm = geral.impressions ? (geral.spend / geral.impressions) * 1000 : 0;
  geral.cpl = geral.leads ? geral.spend / geral.leads : 0;

  const nothing = !loading && !err && (data || []).length === 0 && manualInScope.length === 0;

  return (
    <>
      <PageHead
        eyebrow="COMERCIAL · AQUISIÇÃO"
        title="Canais Pagos"
        desc="Investimento, CPL e desempenho de campanhas — mídia paga conectada (Zernio) + canais informados à mão."
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
          {/* Geral */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div className="t">Investimento geral da empresa</div>
              <span className="badge">{range.since} → {range.until}</span>
            </div>
            <div className="grid kpis">
              <KpiCard lbl="Investimento" val={money(geral.spend)} />
              <KpiCard lbl="Leads / conversões" val={fmt(geral.leads)} />
              <KpiCard lbl="Custo por lead" val={geral.cpl ? money(geral.cpl) : "—"} />
              <KpiCard lbl="Impressões" val={kfmt(geral.impressions)} />
              <KpiCard lbl="Cliques" val={fmt(geral.clicks)} />
              <KpiCard lbl="CTR" val={pctv(geral.ctr)} />
              <KpiCard lbl="CPC" val={geral.cpc ? money(geral.cpc) : "—"} />
              <KpiCard lbl="CPM" val={geral.cpm ? money(geral.cpm) : "—"} />
            </div>
          </div>

          {/* Painéis por ad account (minimizados) */}
          {(data || []).map((a) => {
            const t = a.totals || emptyTotals();
            const open = !!openAcct[a.id];
            return (
              <div className={`card pad-lg${open ? " open" : ""}`} key={a.id} style={{ marginBottom: 12 }}>
                <div className="card-head" style={{ marginBottom: open ? 14 : 0, cursor: "pointer" }} onClick={() => setOpenAcct((o) => ({ ...o, [a.id]: !o[a.id] }))}>
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
                    <div className="grid kpis" style={{ marginBottom: 14 }}>
                      <KpiCard lbl="Investimento" val={money(t.spend)} />
                      <KpiCard lbl="Leads" val={fmt(t.leads)} />
                      <KpiCard lbl="Custo/lead" val={t.cpl ? money(t.cpl) : "—"} />
                      <KpiCard lbl="Conversas" val={fmt(t.messaging)} />
                      <KpiCard lbl="Impressões" val={kfmt(t.impressions)} />
                      <KpiCard lbl="Alcance" val={kfmt(t.reach)} />
                      <KpiCard lbl="Cliques no link" val={fmt(t.linkClicks)} />
                      <KpiCard lbl="CTR" val={pctv(t.ctr)} />
                      <KpiCard lbl="CPC" val={t.cpc ? money(t.cpc) : "—"} />
                      <KpiCard lbl="CPM" val={t.cpm ? money(t.cpm) : "—"} />
                      <KpiCard lbl="Frequência" val={fmt(t.frequency, 1)} />
                      <KpiCard lbl="Compras" val={fmt(t.purchases)} />
                    </div>
                    {a.campaigns.length > 0 && <CampanhaTable campaigns={a.campaigns} />}
                  </>
                )}
              </div>
            );
          })}

          {/* Canais manuais */}
          {manualInScope.length > 0 && (
            <div className="card" style={{ marginTop: 4 }}>
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

function CampanhaTable({ campaigns, manual }: { campaigns: AdCampaign[]; manual?: boolean }) {
  return (
    <div className="rel-scroll">
      <table className="rel-tbl ads-tbl">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>{manual ? "Canal / campanha" : "Campanha"}</th>
            <th>Investimento</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>Leads</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c, i) => (
            <tr key={i}>
              <td className="rel-prod" style={{ textAlign: "left", maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</td>
              <td className="tnum">{money(c.spend)}</td>
              <td className="tnum">{kfmt(c.impressions)}</td>
              <td className="tnum">{fmt(c.clicks)}</td>
              <td className="tnum">{pctv(c.ctr)}</td>
              <td className="tnum">{fmt(c.leads)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
