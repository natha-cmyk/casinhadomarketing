"use client";
// Porta viewAds (blueprint 988-1037) + helpers periodColsAds/aggAds/fmtMetric/cellMetric/scopeMonths.
// Bloco 3: células read-only (edição inline vem depois) — mesma marcação, sem <input>.
import { useStore } from "@/lib/store";
import { fmt, money, pct, sum } from "@/lib/format";
import { scopeLabelText, roasClass, convClass, MONTHS, type Scope } from "@/lib/scope";
import { barChart } from "@/lib/charts";
import { ADS, ADS_METRICS, ADS_PLATS, type AdRow } from "@/lib/seed-data";
import { PageHead, Card, CardHead, KpiCard, Chip, Pill, Segmented } from "@/components/ui";
import { Chart } from "@/components/Chart";
import { Ic } from "@/components/Ic";
import type { ReactNode } from "react";

interface AdsCol {
  label: string;
  idx: number[];
  sel?: boolean;
  single?: boolean;
  month?: number;
}

function periodColsAds(cfg: Scope): AdsCol[] | null {
  const { period, quarter } = cfg;
  if (period === "ano") return [{ label: String(cfg.year), idx: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }];
  if (period === "trimestre")
    return [
      { label: "Q1", idx: [0, 1, 2] },
      { label: "Q2", idx: [3, 4, 5] },
      { label: "Q3", idx: [6, 7, 8] },
      { label: "Q4", idx: [9, 10, 11] },
    ].map((c, i) => ({ ...c, sel: i === quarter }));
  if (period === "semana") return null;
  return MONTHS.map((m, i) => ({ label: m, idx: [i], single: true, month: i, sel: i === cfg.month }));
}

function aggAds(ch: AdRow, idx: number[], metric: string): number | null {
  const val = (k: keyof AdRow) => idx.reduce((a, i) => a + (Number((ch[k] as number[])[i]) || 0), 0);
  const L = val("leads"), V = val("vendas"), R = val("receita"), I = val("invest");
  switch (metric) {
    case "leads": return L;
    case "vendas": return V;
    case "receita": return R;
    case "invest": return I;
    case "cpl": return L > 0 ? I / L : null;
    case "cac": return V > 0 ? I / V : null;
    case "roas": return I > 0 ? R / I : null;
    case "conv": return L > 0 ? V / L : null;
    default: return null;
  }
}

function fmtMetric(m: string, v: number | null): ReactNode {
  if (v == null || isNaN(v)) return <span style={{ color: "var(--label-3)" }}>—</span>;
  if (["receita", "invest", "cpl", "cac"].includes(m)) return money(v);
  if (m === "roas") return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "x";
  if (m === "conv") return pct(v);
  return fmt(v);
}

function CellMetric({ m, v }: { m: string; v: number | null }) {
  if (m === "roas" && v != null) return <Pill tier={roasClass(v)}>{v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x</Pill>;
  if (m === "conv" && v != null) return <Pill tier={convClass(v)}>{pct(v)}</Pill>;
  return <span className="tnum">{fmtMetric(m, v)}</span>;
}

function scopeMonths(cfg: Scope): number[] {
  const p = cfg.period;
  if (p === "mes" || p === "semana") return [cfg.month];
  if (p === "trimestre") return [cfg.quarter * 3, cfg.quarter * 3 + 1, cfg.quarter * 3 + 2];
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
}

export function AdsView() {
  const s = useStore();
  const scope: Scope = { period: s.period, year: s.year, month: s.month, week: s.week, quarter: s.quarter };

  const adsRows = ADS[s.year] || ADS[2026];
  const rows = adsRows.filter((c) => s.adsPlat === "todos" || c.plat === s.adsPlat);
  const metric = s.adsMetric;
  const cols = periodColsAds(scope);
  const all = scopeMonths(scope);

  const L = sum(rows.map((c) => aggAds(c, all, "leads") || 0));
  const V = sum(rows.map((c) => aggAds(c, all, "vendas") || 0));
  const R = sum(rows.map((c) => aggAds(c, all, "receita") || 0));
  const I = sum(rows.map((c) => aggAds(c, all, "invest") || 0));

  const chData = rows
    .map((c) => ({
      label: c.canal.replace(" Ads", "").replace("Programa de ", "") + " · " + c.produto.split(" ")[0],
      v: aggAds(c, all, metric) || 0,
    }))
    .sort((a, b) => b.v - a.v);
  const metricLbl = (ADS_METRICS.find((m) => m[0] === metric) || ["", ""])[1];

  return (
    <>
      <PageHead
        eyebrow="Comercial · Aquisição"
        title="Performance de Canais Pagos"
        desc="Canais com investimento — Google Ads e Meta Ads (mídia paga) e Programa de Parceria (ativação por comissão). Edite as entradas; CPL, CAC, ROAS e conversão calculam sozinhos."
      />

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Investimento" val={money(I)} foot={rows.length + " frentes"}>
          <Chip kind="flat">{scopeLabelText(scope)}</Chip>
        </KpiCard>
        <KpiCard lbl="Receita" val={money(R)} foot="retorno">
          {I > 0 ? (
            <Chip kind={R / I >= 1 ? "up" : "down"}>ROAS {(R / I).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}x</Chip>
          ) : (
            <Chip kind="flat">ROAS —</Chip>
          )}
        </KpiCard>
        <KpiCard lbl="Vendas" val={fmt(V)} foot={L > 0 ? "conversão " + pct(V / L) : ""}>
          <Chip kind="flat">{fmt(L)} leads</Chip>
        </KpiCard>
        <KpiCard lbl="CAC médio" val={money(V > 0 ? I / V : null)} foot="ponderado">
          <Chip kind="flat">custo/venda</Chip>
        </KpiCard>
      </div>

      <Card padLg style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="t">Desempenho por canal × produto</div>
            <div className="sub">Visão {s.period}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Segmented
              small
              value={s.adsPlat}
              onChange={(v) => s.set({ adsPlat: v })}
              options={ADS_PLATS.map(([value, label]) => ({ value, label }))}
            />
            <Segmented
              small
              value={metric}
              onChange={(v) => s.set({ adsMetric: v })}
              options={ADS_METRICS.map(([value, label]) => ({ value, label }))}
            />
          </div>
        </div>

        {!cols ? (
          <div className="empty" style={{ padding: "34px 10px" }}>
            <div className="e-ico">
              <Ic name="cal" />
            </div>
            <h3>Sem série semanal aqui</h3>
            <p>
              Google/Meta/Parceria vêm no grão mensal. Troque para <b>Mês</b> para ver e editar.
            </p>
          </div>
        ) : (
          <>
            <div className="tbl-scroll">
              <table className="data ads-grid">
                <thead>
                  <tr>
                    <th className="stick">Canal / Produto</th>
                    {cols.map((c, i) => (
                      <th key={i} style={c.sel ? { color: "var(--red)" } : undefined}>
                        {c.label}
                      </th>
                    ))}
                    <th style={{ borderLeft: "1px solid var(--hairline-2)" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const total = aggAds(c, all, metric);
                    return (
                      <tr key={c.id}>
                        <td className="stick">
                          <div className="canal-cell">
                            <b>{c.canal}</b>
                            <span>{c.produto}</span>
                          </div>
                        </td>
                        {cols.map((col, i) => (
                          <td key={i}>
                            <CellMetric m={metric} v={aggAds(c, col.idx, metric)} />
                          </td>
                        ))}
                        <td style={{ borderLeft: "1px solid var(--hairline-2)" }}>
                          <b>
                            <CellMetric m={metric} v={total} />
                          </b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="tfoot-note">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9A9AA0"
                strokeWidth={2}
                style={{ flex: "0 0 14px", marginTop: 1 }}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01M11 12h1v4h1" />
              </svg>
              ROAS/conversão na escala <span className="pill exc" style={{ margin: "0 2px" }}>excelente</span>
              <span className="pill bom" style={{ margin: "0 2px" }}>bom</span>
              <span className="pill ate" style={{ margin: "0 2px" }}>atenção</span>
              <span className="pill cri" style={{ margin: "0 2px" }}>crítico</span>. Edições ficam na sessão — persistência no Supabase.
            </div>
          </>
        )}
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <Card padLg>
          <CardHead title={metricLbl + " por canal"} sub={scopeLabelText(scope) + " · ordenado"} />
          <Chart svg={barChart(chData.map((d) => d.label), chData.map((d) => d.v), "#00BBC5", { h: 230 })} />
        </Card>
        <Card padLg>
          <CardHead title="Leitura de 2025 (jan–jun)" />
          <div className="insight" style={{ marginBottom: 10 }}>
            <div className="ib" style={{ background: "var(--cyan)" }}>
              <Ic name="leads" />
            </div>
            <p>
              <b>Parceria</b> é o motor de volume: 143 vendas com ~R$ 24,7k em comissões — coerente com a estratégia indicação-first.
            </p>
          </div>
          <div className="insight" style={{ marginBottom: 10 }}>
            <div className="ib" style={{ background: "var(--excelente)" }}>
              <Ic name="goal" />
            </div>
            <p>
              <b>Meta · Serviços de Espaço</b> lidera eficiência na mídia paga: menor CPL, melhor ROAS.
            </p>
          </div>
          <div className="insight">
            <div className="ib" style={{ background: "var(--atencao)" }}>
              <Ic name="ads" />
            </div>
            <p>
              <b>Google</b> está sem investimento lançado por mês. Preencha para CPL/CAC/ROAS calcularem.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
