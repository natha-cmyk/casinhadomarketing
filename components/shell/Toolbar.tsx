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

      {s.scenario && usesCompare(view) && (
        <div className="scnbar">
          <b>Cenário</b> · comparando {scopeLabelText(scope)} com {s.cmp.year} —{" "}
          {MONTHS_FULL[s.cmp.month]} {s.cmp.year}
        </div>
      )}
    </>
  );
}
