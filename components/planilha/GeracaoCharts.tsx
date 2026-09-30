"use client";
// Gráficos de desempenho por canais (aba Geração) — replica os gráficos PIZZA da planilha.
// Duas roscas (donut): leads por FONTE (somando produtos) e leads por PRODUTO — total do ano exibido.
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { fmt } from "@/lib/format";
import type { PSection } from "@/lib/planilha/spec";
import type { TabData, Cell as PCell } from "@/lib/planilha/types";

const PALETTE = [
  "#FF001E", "#00BBC5", "#121111", "#FF9F0A", "#2FB457", "#7C5CFF", "#FF5CA8",
  "#0A84FF", "#8E8E93", "#BF5AF2", "#FFD60A", "#30D158", "#64D2FF", "#FF6B3D",
];

const yearTotal = (rd: { months: PCell[] } | undefined): number => {
  if (!rd) return 0;
  let t = 0;
  for (const m of rd.months) if (typeof m === "number") t += m;
  return t;
};

interface Slice { name: string; value: number }

function Donut({ title, data }: { title: string; data: Slice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const top = [...data].sort((a, b) => b.value - a.value);
  return (
    <div style={{ flex: "1 1 320px", minWidth: 300 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "var(--label-3)", textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 150, height: 150, flex: "0 0 150px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={top} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={70} paddingAngle={1.5} stroke="none">
                {top.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => { const num = Number(v); return [`${fmt(num)} (${total ? ((num / total) * 100).toFixed(1) : 0}%)`, String(n)]; }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          {top.slice(0, 8).map((d, i) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: PALETTE[i % PALETTE.length], flex: "0 0 9px" }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--label-2)" }}>{d.name}</span>
              <span className="tnum" style={{ fontWeight: 700, color: "var(--label)" }}>{fmt(d.value)}</span>
              <span className="tnum" style={{ color: "var(--label-3)", width: 42, textAlign: "right" }}>{((d.value / total) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GeracaoCharts({ data, sections, year }: { data: TabData; sections: PSection[]; year: number }) {
  const bySource: Record<string, number> = {};
  const byProduct: Slice[] = [];
  for (const sec of sections) {
    let prod = 0;
    for (const row of sec.rows) {
      if (row.strong) continue; // pula linha de TOTAL
      const v = yearTotal(data[row.key]);
      prod += v;
      bySource[row.label] = (bySource[row.label] || 0) + v;
    }
    if (prod > 0) byProduct.push({ name: sec.title, value: prod });
  }
  const sourceSlices = Object.entries(bySource).map(([name, value]) => ({ name, value })).filter((s) => s.value > 0);
  if (!byProduct.length && !sourceSlices.length) return null;

  return (
    <div className="pl-charts">
      <div className="pl-charts-h">Gráfico de desempenho por canais · {year}</div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Donut title="Leads por fonte" data={sourceSlices} />
        <Donut title="Leads por produto" data={byProduct} />
      </div>
    </div>
  );
}
