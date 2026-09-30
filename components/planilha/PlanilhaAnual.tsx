"use client";
// Motor de renderização da PLANILHA ANUAL — replica 1:1 o template tradicional da Seahub.
// Dois regimes de coluna: SEMANAL (mês×[W1-W4+TOTAL]+Q+ano) e MENSAL (mês+Q+ano).
// Coluna de rótulos FIXA (sticky) à esquerda; cabeçalho fixo no topo. Destaca o período
// selecionado na barra de cima. Só apresentação — números vêm prontos (TabData). null = branco.
import { useMemo, type ReactNode } from "react";
import { MONTHS, MONTHS_FULL, computeDelta, type Delta } from "@/lib/scope";
import { fmt, money, pct } from "@/lib/format";
import type { PSection, PRow, CellKind } from "@/lib/planilha/spec";
import type { Cell, TabData } from "@/lib/planilha/types";

interface Props {
  sections: PSection[]; // ESTRUTURA vinda do servidor
  weekly: boolean; // regime de colunas da aba/ano
  data: TabData;
  year: number;
  scope: { period: "semana" | "mes" | "trimestre" | "ano"; month: number; quarter: number; week: number; year: number };
  showWeeks: boolean; // toggle do usuário (só vale nas abas weekly)
  editMode?: boolean; // preenchimento manual: célula de mês vira input
  onEdit?: (rowKey: string, kind: CellKind, monthIdx: number, raw: string) => void;
  cmpMode?: "off" | "ano" | "mes"; // comparação: Δ vs ano anterior (na coluna do ano ou de cada mês)
  cmpData?: TabData; // dados do ano anterior (mesmas chaves)
  focusMonth?: number | null; // modo foco: destaca só este mês (0-11), desfoca os outros
  fontSize?: "sm" | "md" | "lg"; // tamanho da fonte da tabela
}

// valor mostrado no input de edição (mês, semana=-1) conforme o tipo
function editStr(v: Cell, kind: CellKind): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (kind === "pct") return String(Math.round(v * 1000) / 10); // fração -> percentual (20.3)
  return String(v);
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

export function PlanilhaAnual({ sections, weekly, data, year, scope, showWeeks, editMode = false, onEdit, cmpMode = "off", cmpData, focusMonth = null, fontSize = "md" }: Props) {
  const effWeeks = weekly && showWeeks && !editMode; // no modo edição, colapsa pra visão mensal (edita o mês)
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
  const valOf = (src: TabData, key: string, kind: CellKind, c: Col): Cell => {
    const rd = src[key];
    if (!rd) return null;
    const additive = ADDITIVE[kind];
    const monthTotal = (m: number): Cell => rd.months[m] ?? (additive ? addSum(rd.weeks[m]) : null);
    if (c.type === "w") return rd.weeks[c.m]?.[c.w] ?? null;
    if (c.type === "month") return monthTotal(c.m);
    if (c.type === "q") return additive ? addSum([0, 1, 2].map((k) => monthTotal(c.q * 3 + k))) : null;
    return rd.year ?? (additive ? addSum([...Array(12)].map((_, m) => monthTotal(m))) : null);
  };
  const cellVal = (key: string, kind: CellKind, c: Col): Cell => valOf(data, key, kind, c);
  // Δ vs ano anterior — na coluna do ANO (cmpMode=ano) ou em cada TOTAL de mês (cmpMode=mes)
  const deltaCell = (key: string, kind: CellKind, c: Col): Delta | null => {
    // sem Δ em texto nem em % (variação de percentual sobre percentual confunde)
    if (cmpMode === "off" || !cmpData || kind === "text" || kind === "pct") return null;
    // Δ Ano marca trimestres (Q) e o ano — mais visível. Δ Mês marca cada total de mês.
    const want = cmpMode === "ano" ? c.type === "year" || c.type === "q" : cmpMode === "mes" && c.type === "month";
    if (!want) return null;
    const cur = valOf(data, key, kind, c), prev = valOf(cmpData, key, kind, c);
    if (typeof cur !== "number" || typeof prev !== "number") return null;
    return computeDelta(cur, prev, true);
  };
  const content = (v: Cell, kind: CellKind, key: string, c: Col): ReactNode => {
    const d = deltaCell(key, kind, c);
    if (!d) return fmtCell(v, kind);
    return (
      <>
        <span>{fmtCell(v, kind)}</span>
        <span className={"pl-delta pl-d-" + d.kind}>{d.pctLabel}{d.numLabel ? ` ${d.numLabel}` : ""}</span>
      </>
    );
  };
  // modo foco: desfoca colunas de meses que não são o foco (semanas e total do mês)
  const dimCol = (c: Col): boolean => focusMonth != null && (c.type === "w" || c.type === "month") && c.m !== focusMonth;
  const colClass = (c: Col): string => {
    const sel = isSel(c) ? " pl-sel" : "";
    const dim = dimCol(c) ? " pl-dim" : "";
    if (c.type === "month") return "pl-total" + sel + dim;
    if (c.type === "q") return "pl-q" + sel;
    if (c.type === "year") return "pl-year" + sel;
    return "pl-w" + (c.type === "w" && c.w === 0 ? " pl-wfirst" : "") + sel + dim;
  };

  const totalCols = 1 + cols.length;
  const headSpan = effWeeks ? 2 : 1;

  // células de uma linha. Linha de seção MENSAL em visão semanal: o valor do mês ocupa o mês
  // inteiro (colSpan), sem as colunas W1-W4 vazias. Demais: uma célula por coluna (com input no modo edição).
  const cellsForRow = (row: PRow, secMonthly: boolean): ReactNode[] => {
    if (effWeeks && secMonthly) {
      const out: ReactNode[] = [];
      for (let m = 0; m < 12; m++) {
        const mc: Col = { type: "month", m, label: "TOTAL" };
        const v = cellVal(row.key, row.kind, mc);
        out.push(
          <td key={`m${m}`} colSpan={monthSpan} className={colClass(mc) + " pl-mcell" + (v == null ? " pl-empty" : "")}>
            {content(v, row.kind, row.key, mc)}
          </td>
        );
        if (m % 3 === 2) {
          const q = (m - 2) / 3;
          const qc: Col = { type: "q", q, label: `Q${q + 1}` };
          const qv = cellVal(row.key, row.kind, qc);
          out.push(<td key={`q${q}`} className={colClass(qc) + (qv == null ? " pl-empty" : "")}>{content(qv, row.kind, row.key, qc)}</td>);
        }
      }
      const yc: Col = { type: "year", label: String(year) };
      const yv = cellVal(row.key, row.kind, yc);
      out.push(<td key="y" className={colClass(yc) + (yv == null ? " pl-empty" : "")}>{content(yv, row.kind, row.key, yc)}</td>);
      return out;
    }
    return cols.map((c, i) => {
      const v = cellVal(row.key, row.kind, c);
      if (editMode && onEdit && c.type === "month") {
        return (
          <td key={i} className="pl-total pl-editcell">
            <input
              key={`${year}:${row.key}:${c.m}`}
              className="pl-input"
              defaultValue={editStr(v, row.kind)}
              inputMode={row.kind === "text" ? "text" : "decimal"}
              onBlur={(e) => onEdit(row.key, row.kind, c.m, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          </td>
        );
      }
      return (
        <td key={i} className={colClass(c) + (v == null ? " pl-empty" : "")}>
          {content(v, row.kind, row.key, c)}
        </td>
      );
    });
  };

  // canto fixo (mês/período do escopo) — sem rowSpan (rowSpan+sticky quebra ao rolar)
  const cornerTop =
    focusMonth != null ? MONTHS[focusMonth]
      : scope.year !== year ? "Ano"
        : scope.period === "mes" ? MONTHS[scope.month]
          : scope.period === "trimestre" ? `Q${scope.quarter + 1}`
            : scope.period === "semana" ? `S${scope.week + 1}`
              : "Ano";

  return (
    <div className="planilha-wrap">
      <table className={"planilha pl-sz-" + fontSize}>
        <thead>
          {/* linha 1 — canto (mês/período) + grupos de mês + Q + ano */}
          <tr>
            <th className="pl-corner pl-corner-a">
              <span className="pl-corner-lbl">{cornerTop}</span>
              {!effWeeks && <span className="pl-corner-sub">{year}</span>}
            </th>
            {(() => {
              const cells: ReactNode[] = [];
              for (let m = 0; m < 12; m++) {
                cells.push(
                  <th key={`mh-${m}`} className={"pl-monthhead" + (focusMonth != null && m !== focusMonth ? " pl-dim" : "")} colSpan={monthSpan}>
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
          {/* linha 2 — canto (ano) + W1-W4 + TOTAL sob cada mês (só no modo semanal) */}
          {effWeeks && (
            <tr>
              <th className="pl-corner pl-corner-b"><span className="pl-corner-sub">{year}</span></th>
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
                  {cellsForRow(row, !!sec.monthly)}
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
