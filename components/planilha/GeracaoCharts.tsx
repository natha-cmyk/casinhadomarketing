"use client";
// Gráficos de desempenho por canais (aba Geração) — UM gráfico PIZZA por MÊS (jan…dez),
// como na planilha. Dá pra ver, mês a mês, de onde vêm os leads (por fonte ou por produto).
import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { MONTHS } from "@/lib/scope";
import { fmt } from "@/lib/format";
import type { PSection } from "@/lib/planilha/spec";
import type { TabData, Cell as PCell } from "@/lib/planilha/types";

const PALETTE = [
  "#FF001E", "#00BBC5", "#121111", "#FF9F0A", "#2FB457", "#7C5CFF", "#FF5CA8",
  "#0A84FF", "#8E8E93", "#BF5AF2", "#FFD60A", "#30D158", "#64D2FF", "#FF6B3D", "#A2845E",
];
const monthVal = (rd: { months: PCell[] } | undefined, m: number): number => {
  const v = rd?.months[m];
  return typeof v === "number" ? v : 0;
};

export function GeracaoCharts({ data, sections, year }: { data: TabData; sections: PSection[]; year: number }) {
  const [dim, setDim] = useState<"fonte" | "produto">("fonte");

  // por mês: { categoria -> valor } conforme a dimensão escolhida
  const { months, cats, colors } = useMemo(() => {
    const months: Record<string, number>[] = Array.from({ length: 12 }, () => ({}));
    const catSet = new Set<string>();
    for (const sec of sections) {
      for (let m = 0; m < 12; m++) {
        if (dim === "produto") {
          let tot = 0;
          for (const row of sec.rows) { if (row.strong) continue; tot += monthVal(data[row.key], m); }
          if (tot > 0) { months[m][sec.title] = (months[m][sec.title] || 0) + tot; catSet.add(sec.title); }
        } else {
          for (const row of sec.rows) {
            if (row.strong) continue;
            const v = monthVal(data[row.key], m);
            if (v > 0) { months[m][row.label] = (months[m][row.label] || 0) + v; catSet.add(row.label); }
          }
        }
      }
    }
    const cats = [...catSet].sort();
    const colors = new Map<string, string>();
    cats.forEach((c, i) => colors.set(c, PALETTE[i % PALETTE.length]));
    return { months, cats, colors };
  }, [data, sections, dim]);

  const anyData = months.some((m) => Object.keys(m).length > 0);
  if (!anyData) return null;

  return (
    <div className="pl-charts">
      <div className="pl-charts-top">
        <div className="pl-charts-h">Desempenho por canais · mês a mês · {year}</div>
        <div className="pl-dimtabs">
          <button className={dim === "fonte" ? "on" : ""} onClick={() => setDim("fonte")}>Por fonte</button>
          <button className={dim === "produto" ? "on" : ""} onClick={() => setDim("produto")}>Por produto</button>
        </div>
      </div>

      {/* legenda compartilhada */}
      <div className="pl-charts-legend">
        {cats.map((c) => (
          <span key={c} className="pl-lg-item">
            <span className="pl-lg-dot" style={{ background: colors.get(c) }} />{c}
          </span>
        ))}
      </div>

      {/* 12 mini-roscas (uma por mês) */}
      <div className="pl-month-grid">
        {months.map((mm, m) => {
          const slices = Object.entries(mm).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
          const total = slices.reduce((s, x) => s + x.value, 0);
          return (
            <div key={m} className={"pl-month-chart" + (total ? "" : " empty")}>
              <div className="pl-mc-title">{MONTHS[m]}</div>
              <div className="pl-mc-donut">
                {total ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={slices} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={20} outerRadius={34} paddingAngle={1.5} stroke="none">
                        {slices.map((d) => <Cell key={d.name} fill={colors.get(d.name)} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => { const num = Number(v); return [`${fmt(num)} (${total ? ((num / total) * 100).toFixed(0) : 0}%)`, String(n)]; }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="pl-mc-empty">—</div>}
              </div>
              <div className="pl-mc-total tnum">{total ? fmt(total) : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
