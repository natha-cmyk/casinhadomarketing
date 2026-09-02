"use client";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { META, TEMPORAL, usesCompare, viewForPath } from "@/lib/nav";
import { MONTHS, MONTHS_FULL, scopeLabelText, type Period, type Scope } from "@/lib/scope";

const PERIODS: { value: Period; label: string }[] = [
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano", label: "Ano" },
];
const YEARS = [2024, 2025, 2026];

export function Toolbar() {
  const pathname = usePathname();
  const view = viewForPath(pathname);
  const meta = META[view];
  const temporal = TEMPORAL.includes(view);

  const s = useStore();
  const scope: Scope = { period: s.period, year: s.year, month: s.month, week: s.week, quarter: s.quarter };

  const openNav = () => document.body.classList.toggle("nav-open");

  return (
    <>
      <div className="toolbar">
        <button className="menu-btn" onClick={openNav} aria-label="Menu" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <div className="tb-title">
          {meta?.title || meta?.label || "Painel"}
          {meta?.sub && <small>{meta.sub}</small>}
        </div>

        {temporal && (
        <>
        <div className="seg">
          {PERIODS.map((p) => (
            <button key={p.value} className={s.period === p.value ? "on" : ""} onClick={() => s.setPeriod(p.value)} type="button">
              {p.label}
            </button>
          ))}
        </div>

        {temporal && s.period === "mes" && (
          <select className="tb-select" value={s.month} onChange={(e) => s.setMonth(Number(e.target.value))} aria-label="Mês">
            {MONTHS_FULL.map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
        )}
        {temporal && s.period === "semana" && (
          <>
            <select className="tb-select" value={s.month} onChange={(e) => s.setMonth(Number(e.target.value))} aria-label="Mês">
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>
                  {m}
                </option>
              ))}
            </select>
            <select className="tb-select" value={s.week} onChange={(e) => s.setWeek(Number(e.target.value))} aria-label="Semana">
              {[0, 1, 2, 3].map((w) => (
                <option key={w} value={w}>
                  {"W" + (w + 1)}
                </option>
              ))}
            </select>
          </>
        )}
        {temporal && s.period === "trimestre" && (
          <select className="tb-select" value={s.quarter} onChange={(e) => s.setQuarter(Number(e.target.value))} aria-label="Trimestre">
            {[0, 1, 2, 3].map((q) => (
              <option key={q} value={q}>
                {"Q" + (q + 1)}
              </option>
            ))}
          </select>
        )}

        <div className="seg">
          {YEARS.map((y) => (
            <button key={y} className={s.year === y ? "on" : ""} onClick={() => s.setYear(y)} type="button">
              {y}
            </button>
          ))}
        </div>
        </>
        )}

        {usesCompare(view) && (
          <button className={`tb-toggle${s.scenario ? " on" : ""}`} onClick={s.toggleScenario} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v18M16 3v18M3 8h5M16 8h5M3 16h5M16 16h5" />
            </svg>
            Comparar
          </button>
        )}

        {temporal && <span className="updated">{scopeLabelText(scope)}</span>}
      </div>

      {s.scenario && usesCompare(view) && (() => {
        const cmpScope: Scope = { period: s.cmp.period, year: s.cmp.year, month: s.cmp.month, week: s.cmp.week, quarter: s.cmp.quarter };
        // "período anterior" = recua 1 unidade do escopo ATUAL (semana→semana, mês→mês…)
        const anterior = () => {
          const p = s.period;
          if (p === "ano") return s.setCmp({ period: "ano", year: s.year - 1 });
          if (p === "trimestre") { const q = s.quarter - 1; return q < 0 ? s.setCmp({ period: "trimestre", year: s.year - 1, quarter: 3 }) : s.setCmp({ period: "trimestre", year: s.year, quarter: q }); }
          if (p === "semana") { const w = s.week - 1; return w < 0 ? s.setCmp({ period: "semana", year: s.month === 0 ? s.year - 1 : s.year, month: (s.month + 11) % 12, week: 3 }) : s.setCmp({ period: "semana", year: s.year, month: s.month, week: w }); }
          return s.setCmp({ period: "mes", year: s.month === 0 ? s.year - 1 : s.year, month: (s.month + 11) % 12 });
        };
        const anoPassado = () => s.setCmp({ period: s.period, year: s.year - 1, month: s.month, week: s.week, quarter: s.quarter });
        return (
          <div className="scnbar scnbar-flex">
            <b>Comparar com</b>
            <div className="seg seg-sm">
              {PERIODS.map((p) => (
                <button key={p.value} className={s.cmp.period === p.value ? "on" : ""} onClick={() => s.setCmp({ period: p.value })} type="button">{p.label}</button>
              ))}
            </div>
            <select className="tb-select" value={s.cmp.year} onChange={(e) => s.setCmp({ year: Number(e.target.value) })} aria-label="Ano da comparação">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {(s.cmp.period === "mes" || s.cmp.period === "semana") && (
              <select className="tb-select" value={s.cmp.month} onChange={(e) => s.setCmp({ month: Number(e.target.value) })} aria-label="Mês da comparação">
                {MONTHS_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}
            {s.cmp.period === "semana" && (
              <select className="tb-select" value={s.cmp.week} onChange={(e) => s.setCmp({ week: Number(e.target.value) })} aria-label="Semana da comparação">
                {[0, 1, 2, 3].map((w) => <option key={w} value={w}>{"W" + (w + 1)}</option>)}
              </select>
            )}
            {s.cmp.period === "trimestre" && (
              <select className="tb-select" value={s.cmp.quarter} onChange={(e) => s.setCmp({ quarter: Number(e.target.value) })} aria-label="Trimestre da comparação">
                {[0, 1, 2, 3].map((q) => <option key={q} value={q}>{"Q" + (q + 1)}</option>)}
              </select>
            )}
            <button className="scn-preset" type="button" onClick={anterior} title="Período imediatamente anterior ao atual">período anterior</button>
            <button className="scn-preset" type="button" onClick={anoPassado} title="Mesmo período, um ano atrás">ano passado</button>
            <span className="scn-lbl">{scopeLabelText(scope)} <b>vs</b> {scopeLabelText(cmpScope)}</span>
          </div>
        );
      })()}
    </>
  );
}
