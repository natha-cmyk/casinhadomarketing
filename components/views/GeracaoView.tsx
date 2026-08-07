"use client";
// Porta viewCanais (blueprint 1051-1068) + helpers combinedCanais/canalViz/canalVizCmp.
import { useStore } from "@/lib/store";
import { fmt, sum, pct } from "@/lib/format";
import { scopeLabelText } from "@/lib/scope";
import { pieChart, barChart } from "@/lib/charts";
import { CANAIS, CANAL_COLORS, canaisTotalYear } from "@/lib/seed-data";
import { PageHead, Card, Segmented, BarRow } from "@/components/ui";
import { Chart } from "@/components/Chart";
import { Ic } from "@/components/Ic";
import type { ReactNode } from "react";

type Entry = [string, number];

function CanalViz({
  title,
  sublabel,
  entries,
  type,
  cmp,
}: {
  title: string;
  sublabel: string;
  entries: Entry[];
  type: string;
  cmp?: ReactNode;
}) {
  const e = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = sum(e.map((x) => x[1]));
  const max = Math.max(...e.map((x) => x[1]), 1);

  let body: ReactNode;
  if (type === "lista") {
    body = (
      <>
        {e.map(([k, v]) => (
          <BarRow key={k} k={k} v={v} max={max} color={CANAL_COLORS[k] || "#9A9AA0"} formatted={fmt(v)} />
        ))}
      </>
    );
  } else if (type === "pizza") {
    const pd = e.map(([k, v]) => ({ label: k, v, color: CANAL_COLORS[k] || "#9A9AA0" }));
    body = (
      <div className="pie-wrap">
        <div dangerouslySetInnerHTML={{ __html: pieChart(pd, 196) }} />
        <div className="pie-legend">
          {pd.map((d) => (
            <div className="pl" key={d.label}>
              <i style={{ background: d.color }} />
              {d.label}
              <b className="tnum">{fmt(d.v)}</b>
              <span>{pct(d.v / total)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else {
    body = (
      <Chart
        svg={barChart(
          e.map((x) => x[0].replace("Programa de ", "")),
          e.map((x) => x[1]),
          e.map((x) => CANAL_COLORS[x[0]] || "#9A9AA0"),
          { h: 230 }
        )}
      />
    );
  }

  return (
    <div className="card pad-lg">
      <div className="card-head">
        <div>
          <div className="t">{title}</div>
          <div className="sub tnum">
            {total} leads · {sublabel}
          </div>
        </div>
        {cmp}
      </div>
      {body}
    </div>
  );
}

export function GeracaoView() {
  const s = useStore();
  const scope = { period: s.period, year: s.year, month: s.month, week: s.week, quarter: s.quarter };
  const vt = s.canaisView;
  const scopeLbl = scopeLabelText(scope);

  const canaisData = CANAIS[s.year] || CANAIS[2026];
  const combined: Record<string, number> = {};
  Object.values(canaisData).forEach((o) =>
    Object.entries(o).forEach(([k, v]) => (combined[k] = (combined[k] || 0) + v))
  );
  const combinedEntries = Object.entries(combined) as Entry[];

  const geralTot = sum(combinedEntries.map((e) => e[1]));
  const prev = canaisTotalYear(s.year - 1);
  const cmp =
    prev > 0 ? (
      <div className="cmp">
        <div className="row">
          <DeltaChipInline cur={geralTot} prev={prev} /> vs {s.year - 1} ({fmt(prev)})
        </div>
      </div>
    ) : null;

  const produtos = Object.entries(canaisData);

  return (
    <>
      <PageHead
        eyebrow="Comercial · Funil"
        title="Geração por Canais"
        desc={`De onde vêm os leads — geral e por produto (${produtos.length} linhas em ${s.year}). ${scopeLbl} · consolidado do ano.`}
        right={
          <Segmented
            small
            value={vt}
            onChange={(v) => s.set({ canaisView: v })}
            options={[
              { value: "lista", label: "Lista" },
              { value: "pizza", label: "Pizza" },
              { value: "colunas", label: "Colunas" },
            ]}
          />
        }
      />

      <div style={{ marginBottom: 16 }}>
        <CanalViz title="Geral no período" sublabel={"todas as origens · " + s.year} entries={combinedEntries} type={vt} cmp={cmp} />
      </div>

      <div
        className={`grid${produtos.length > 2 ? "" : " two-col"}`}
        style={produtos.length > 2 ? { gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" } : undefined}
      >
        {produtos.map(([nome, obj]) => (
          <CanalViz key={nome} title={nome} sublabel="por canal" entries={Object.entries(obj) as Entry[]} type={vt} />
        ))}
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="insight" style={{ border: 0, background: "transparent", padding: 0 }}>
          <div className="ib" style={{ background: "var(--ink)" }}>
            <Ic name="leads" />
          </div>
          <p>
            <b>Padrões distintos por produto.</b> No Escritório Virtual, <b>Parceria</b> domina a origem; em espaço/coworking, <b>cliente ativo</b> e{" "}
            <b>redes sociais</b> puxam o volume. O comparativo ao lado é ano-contra-ano; a quebra por semana/mês entra com a passada de dados por período.
          </p>
        </div>
      </Card>
    </>
  );
}

// deltaChip(cur,prev,null,true) do blueprint — chip up/down com % e delta absoluto.
function DeltaChipInline({ cur, prev }: { cur: number; prev: number }) {
  if (prev == null || prev === 0 || cur == null || isNaN(cur)) return <span className="chip flat">—</span>;
  const d = (cur - prev) / prev;
  const up = d >= 0;
  const dv = Math.abs(cur - prev);
  const num = ` · ${up ? "+" : "−"}${dv >= 10000 ? (dv / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : fmt(Math.round(dv))}`;
  return (
    <span className={`chip ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {(Math.abs(d) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%{num}
    </span>
  );
}
