// Aplica a personalização (ocultar / ordenar / indicadores manuais) sobre a estrutura da aba.
// showHidden=true mantém as linhas ocultas na lista (pro modo Organizar); false remove (exibição normal).
import type { PSection, PRow } from "./spec";
import type { PlanilhaConfig } from "./types";

export function applyConfig(sections: PSection[], config: PlanilhaConfig, showHidden: boolean): PSection[] {
  const hidden = new Set(config.hidden || []);
  const customBySection: Record<string, PRow[]> = {};
  for (const c of config.custom || []) {
    (customBySection[c.section] ??= []).push({ key: c.key, label: c.label, kind: c.kind });
  }
  const pending = new Set(Object.keys(customBySection));

  const build = (title: string, baseRows: PRow[]): PSection | null => {
    let rows = [...baseRows];
    if (customBySection[title]) { rows = rows.concat(customBySection[title]); pending.delete(title); }
    const ord = config.order?.[title];
    if (ord && ord.length) {
      const idx = new Map(ord.map((k, i) => [k, i]));
      rows = rows.map((r, i) => ({ r, i })).sort((a, b) => {
        const ia = idx.has(a.r.key) ? (idx.get(a.r.key) as number) : 1000 + a.i;
        const ib = idx.has(b.r.key) ? (idx.get(b.r.key) as number) : 1000 + b.i;
        return ia - ib;
      }).map((x) => x.r);
    }
    if (!showHidden) rows = rows.filter((r) => !hidden.has(r.key));
    if (!rows.length && !showHidden) return null;
    return { title, rows, monthly: undefined };
  };

  const out: PSection[] = [];
  for (const sec of sections) {
    const s = build(sec.title, sec.rows);
    if (s) { s.monthly = sec.monthly; out.push(s); }
  }
  // seções novas criadas só por indicadores manuais
  for (const title of pending) {
    const s = build(title, []);
    if (s) out.push(s);
  }
  return out;
}
