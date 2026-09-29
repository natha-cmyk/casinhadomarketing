"use client";
// Motor de renderização da PLANILHA ANUAL — replica 1:1 o template tradicional da Seahub.
// Dois regimes de coluna: SEMANAL (mês×[W1-W4+TOTAL]+Q+ano) e MENSAL (mês+Q+ano).
// Coluna de rótulos FIXA (sticky) à esquerda; cabeçalho fixo no topo. Destaca o período
// selecionado na barra de cima. Só apresentação — números vêm prontos (TabData). null = branco.
import { useMemo, type ReactNode } from "react";
import { MONTHS_FULL } from "@/lib/scope";
import { fmt, money, pct } from "@/lib/format";
import type { PSection, CellKind } from "@/lib/planilha/spec";
import type { Cell, TabData } from "@/lib/planilha/types";

interface Props {
  sections: PSection[]; // ESTRUTURA vinda do servidor
  weekly: boolean; // regime de colunas da aba/ano
  sub: string; // rótulo da célula-canto (nome da aba)
  data: TabData;
  year: number;
  scope: { period: "semana" | "mes" | "trimestre" | "ano"; month: number; quarter: number; week: number; year: number };
  showWeeks: boolean; // toggle do usuário (só vale nas abas weekly)
}

type Col =
  | { type: "w"; m: number; w: number; label: string }
  | { type: "month"; m: number; label: string }
  | { type: "q"; q: number; label: string }
  | { type: "year"; label: string };

const ADDITIVE: Record<CellKind, boolean> = { int: true, money: true, dec: true, pct: false, text: false };

function addSum(vals: Cell[]): Cell {
  let any = false, t = 0;
  for (const v of vals) if (typeof v === "number") { any = true; t += v; }
  return any ? t : null;
}
function fmtCell(v: Cell, kind: CellKind): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (kind === "money") return money(v);
  if (kind === "pct") return pct(v);
  if (kind === "dec") return fmt(v, 2);
  return fmt(v, 0);
}

export function PlanilhaAnual({ sections, weekly, sub, data, year, scope, showWeeks }: Props) {
  const effWeeks = weekly && showWeeks; // semanas só quando a aba é semanal E o toggle está ligado
  const monthSpan = effWeeks ? 5 : 1;

  const cols = useMemo<Col[]>(() => {
    const out: Col[] = [];
    for (let m = 0; m < 12; m++) {
      if (effWeeks) for (let w = 0; w < 4; w++) out.push({ type: "w", m, w, label: `W${w + 1}` });
      out.push({ type: "month", m, label: "TOTAL" });
      if (m % 3 === 2) out.push({ type: "q", q: (m - 2) / 3, label: `Q${(m - 2) / 3 + 1}` });
    }
    out.push({ type: "year", label: String(year) });
    return out;
  }, [effWeeks, year]);

  const sameYear = scope.year === year;
  const isSel = (c: Col): boolean => {
    if (!sameYear) return false;
    if (scope.period === "semana") return c.type === "w" && c.m === scope.month && c.w === scope.week;
    if (scope.period === "mes") return (c.type === "month" || c.type === "w") && "m" in c && c.m === scope.month;
    if (scope.period === "trimestre") return c.type === "q" && c.q === scope.quarter;
    return c.type === "year";
  };
  const cellVal = (key: string, kind: CellKind, c: Col): Cell => {
    const rd = data[key];
    if (!rd) return null;
    const additive = ADDITIVE[kind];
    const monthTotal = (m: number): Cell => rd.months[m] ?? (additive ? addSum(rd.weeks[m]) : null);
    if (c.type === "w") return rd.weeks[c.m]?.[c.w] ?? null;
    if (c.type === "month") return monthTotal(c.m);
    if (c.type === "q") return additive ? addSum([0, 1, 2].map((k) => monthTotal(c.q * 3 + k))) : null;
    return rd.year ?? (additive ? addSum([...Array(12)].map((_, m) => monthTotal(m))) : null);
  };
  const colClass = (c: Col): string => {
    const sel = isSel(c) ? " pl-sel" : "";
    if (c.type === "month") return "pl-total" + sel;
    if (c.type === "q") return "pl-q" + sel;
    if (c.type === "year") return "pl-year" + sel;
    return "pl-w" + (c.type === "w" && c.w === 0 ? " pl-wfirst" : "") + sel;
  };

  const totalCols = 1 + cols.length;
  const headSpan = effWeeks ? 2 : 1;

  return (
    <div className="planilha-wrap">
      <table className="planilha">
        <thead>
          {/* linha 1 — grupos de mês + Q + ano */}
          <tr>
            <th className="pl-corner" rowSpan={headSpan}>{sub}</th>
            {(() => {
              const cells: ReactNode[] = [];
              for (let m = 0; m < 12; m++) {
                cells.push(
                  <th key={`mh-${m}`} className="pl-monthhead" colSpan={monthSpan}>
                    {MONTHS_FULL[m]}
                  </th>
                );
                if (m % 3 === 2) {
                  const q = (m - 2) / 3;
                  cells.push(<th key={`qh-${q}`} className="pl-q pl-qhead" rowSpan={headSpan}>Q{q + 1}</th>);
                }
              }
              cells.push(<th key="yh" className="pl-year pl-yearhead" rowSpan={headSpan}>{year}</th>);
              return cells;
            })()}
          </tr>
          {/* linha 2 — W1-W4 + TOTAL sob cada mês (só no modo semanal) */}
          {effWeeks && (
            <tr>
              {cols
                .filter((c) => c.type === "w" || c.type === "month")
                .map((c, i) => (
                  <th key={`sub-${i}`} className={colClass(c)}>
                    {c.type === "month" ? "TOTAL" : c.label}
                  </th>
                ))}
            </tr>
          )}
        </thead>
        <tbody>
          {sections.map((sec) => (
            <FragmentSection key={sec.title}>
              <tr className="pl-band">
                <th className="pl-bandlabel">{sec.title}</th>
                <td className="pl-bandfill" colSpan={totalCols - 1} />
              </tr>
              {sec.rows.map((row) => (
                <tr key={row.key} className={row.strong ? "pl-strong" : undefined}>
                  <th className="pl-rowlabel" title={row.hint}>
                    {row.label}
                    {row.hint ? <span className="pl-hint">ⓘ</span> : null}
                  </th>
                  {cols.map((c, i) => {
                    const v = cellVal(row.key, row.kind, c);
                    return (
                      <td key={i} className={colClass(c) + (v == null ? " pl-empty" : "")}>
                        {fmtCell(v, row.kind)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </FragmentSection>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// wrapper só p/ agrupar band + linhas sem div (mantém <table> válida)
function FragmentSection({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
