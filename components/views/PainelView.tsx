"use client";
// Portado de viewOverview (blueprint 1644-1693). Fidelidade 1:1.
// Bloco 3: NÃO filtramos por shownInd — renderizamos todos os blocos.
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { fmt, money, kfmt, sum } from "@/lib/format";
import { scopeLabelText, computeDelta, type Scope } from "@/lib/scope";
import { igMonthly, LEADS_M, canaisTotalYear, ADS, REDES, SOC } from "@/lib/seed-data";
import { barChart } from "@/lib/charts";
import { Chart } from "@/components/Chart";
import { Ic } from "@/components/Ic";
import { KpiCard, DeltaChip } from "@/components/ui";
import { pathForView } from "@/lib/nav";

const lastNZ = (a: number[]) => {
  for (let i = a.length - 1; i >= 0; i--) if (a[i] > 0) return a[i];
  return 0;
};
function scopeMonths(cfg: Scope): number[] {
  const p = cfg.period;
  if (p === "mes" || p === "semana") return [cfg.month];
  if (p === "trimestre") return [cfg.quarter * 3, cfg.quarter * 3 + 1, cfg.quarter * 3 + 2];
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
}

export function PainelView() {
  const s = useStore();
  const router = useRouter();
  const scope: Scope = { period: s.period, year: s.year, month: s.month, week: s.week, quarter: s.quarter };

  const y = s.year;
  const yrs = [2024, 2025, 2026];
  const segY = (yr: number) => lastNZ(igMonthly("totalSeguidores", yr));
  const seg = segY(y), segPrev = segY(y - 1);
  const views = sum(igMonthly("visualizacoes", y));
  const leads = canaisTotalYear(y), leadsPrev = canaisTotalYear(y - 1);
  const isAno = s.period === "ano";
  const sm = scopeMonths(scope);
  const lbl = scopeLabelText(scope);

  const segMon = igMonthly("totalSeguidores", y);
  const segTgt = isAno ? 11 : s.period === "trimestre" ? s.quarter * 3 + 2 : s.month;
  let segS = 0;
  for (let i = Math.min(segTgt, 11); i >= 0; i--) {
    if (segMon[i] > 0) { segS = segMon[i]; break; }
  }
  const viewsMon = igMonthly("visualizacoes", y);
  const viewsS = sm.reduce((a, mo) => a + (viewsMon[mo] || 0), 0);
  const leadsS = LEADS_M[y] ? sm.reduce((a, mo) => a + (LEADS_M[y][mo] || 0), 0) : canaisTotalYear(y);

  const adsY = ADS[y] || [];
  const sumSc = (k: string) =>
    sum(adsY.map((c) => sm.reduce((a, mo) => a + ((((c as unknown as Record<string, number[]>)[k] || [])[mo]) || 0), 0)));
  const adsInvest = sumSc("invest"), adsRec = sumSc("receita"), adsLd = sumSc("leads");
  const roas = adsInvest > 0 ? adsRec / adsInvest : 0;
  const leadsByYear = yrs.map(canaisTotalYear), segByYear = yrs.map(segY);
  const roasTxt = roas.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "x";

  const shortcut = (view: string, icn: string, title: string, val: string, sub: string) => (
    <button
      key={view}
      className="card go-view"
      onClick={() => router.push(pathForView(view))}
      style={{ textAlign: "left", cursor: "pointer", border: "1px solid var(--hairline)" }}
    >
      <div className="card-head">
        <div>
          <div className="t">{title}</div>
          <div className="sub">{sub}</div>
        </div>
        <span
          className="ib"
          style={{ width: 26, height: 26, borderRadius: 7, background: "var(--ink)", color: "#fff", display: "grid", placeItems: "center" }}
        >
          <Ic name={icn} />
        </span>
      </div>
      <div className="val tnum" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{val}</div>
    </button>
  );

  const ativas = REDES.filter((r) => s.redes[r.id]);
  const redeCard = (r: (typeof REDES)[number]): ReactNode => {
    let kp: [string, string][];
    if (r.id === "instagram") {
      kp = [["Seguidores", fmt(seg)], ["Visualizações", kfmt(views)]];
    } else {
      const soc = SOC[r.id];
      if (!soc || !soc.kpis) return null;
      kp = soc.kpis.slice(0, 2).map((k) => [k[0], k[1]] as [string, string]);
    }
    return (
      <button
        key={r.id}
        className="card go-view rede-mini"
        onClick={() => router.push(pathForView(r.id))}
        style={{ textAlign: "left", cursor: "pointer", borderLeft: `4px solid ${r.cor}` }}
      >
        <div className="rm-h">
          <span className="conta-dot" style={{ background: r.cor }} />
          {r.label}
        </div>
        <div className="rm-kpis">
          {kp.map((k, i) => (
            <div key={i}>
              <span className="rm-v tnum">{k[1]}</span>
              <span className="rm-l">{k[0]}</span>
            </div>
          ))}
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Visão geral · {y}</div>
          <h2>Painel</h2>
          <p>
            Resumo executivo — Instagram, geração, mídia paga e receita. <b>{scopeLabelText(scope)}</b>. Clique num bloco para abrir a aba.
          </p>
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Seguidores" val={fmt(segS)} foot={isAno ? (y === 2026 ? "parcial jan–jul" : "fim do ano") : lbl}>
          {isAno && segPrev > 0 ? (
            <div className="row">
              <DeltaChip delta={computeDelta(seg, segPrev, true)} /> vs {y - 1}
            </div>
          ) : null}
        </KpiCard>
        <KpiCard lbl="Leads gerados" val={fmt(leadsS)} foot={isAno ? "todas as origens" : lbl}>
          {isAno && leadsPrev > 0 ? (
            <div className="row">
              <DeltaChip delta={computeDelta(leads, leadsPrev, true)} /> vs {y - 1}
            </div>
          ) : null}
        </KpiCard>
        <KpiCard lbl="Investimento pago" val={money(adsInvest)} foot={`${fmt(adsLd)} leads · ROAS ${roasTxt}`} />
        <KpiCard lbl="MRR atual" val="R$ 374,6k" foot={isAno ? "1.301 contratos · Conexa" : "atual · não varia por período"} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
        <div className="card pad-lg">
          <div className="card-head">
            <div>
              <div className="t">Leads por ano</div>
              <div className="sub">geração consolidada</div>
            </div>
          </div>
          <Chart svg={barChart(yrs.map(String), leadsByYear, ["#9A9AA0", "#00BBC5", "#FF001E"], { h: 220, name: "Leads" })} />
        </div>
        <div className="card pad-lg">
          <div className="card-head">
            <div>
              <div className="t">Seguidores (fim do ano)</div>
              <div className="sub">evolução · 2026 parcial</div>
            </div>
          </div>
          <Chart svg={barChart(yrs.map(String), segByYear, ["#9A9AA0", "#00BBC5", "#FF001E"], { h: 220, name: "Seguidores" })} />
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--label-2)", margin: "2px 0 9px" }}>Atalhos</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        {shortcut("instagram", "ig", "Instagram", kfmt(views), "visualizações no ano")}
        {shortcut("canais", "leads", "Geração", fmt(leads), "leads no ano")}
        {shortcut("ads", "ads", "Canais Pagos", roasTxt, "ROAS no ano")}
        {shortcut("persona", "persona", "Persona", "39,4%", "conversão geral")}
        {shortcut("concorrencia", "vs", "Concorrência", "24", "players mapeados")}
      </div>

      {ativas.length ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--label-2)", margin: "16px 0 9px" }}>Redes sociais</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
            {ativas.map(redeCard)}
          </div>
        </>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="insight" style={{ border: 0, background: "transparent", padding: 0 }}>
          <div className="ib" style={{ background: "var(--ink)" }}>
            <Ic name="overview" />
          </div>
          <p>
            <b>Leitura rápida · {scopeLabelText(scope)}:</b> {leadsS > 0 ? fmt(leadsS) + " leads gerados" : "sem geração registrada"}, {kfmt(viewsS)} visualizações no Instagram e {segS > 0 ? fmt(segS) + " seguidores" : "—"}. A receita recorrente (R$ 374,6k MRR) vem sobretudo de Sala Privativa e Endereço Fiscal — detalhe na aba Persona.
          </p>
        </div>
      </div>
    </>
  );
}
