"use client";
// Quadro de widgets reutilizável, 2 modos:
//  - mode="grid": grade livre {x,y,w,h} (tipo ClickUp) — arrasta pra qualquer célula, redimensiona
//    largura E altura, compacta pra cima. Pros widgets uniformes (CRM, overview).
//  - mode="flow": fluxo por ordem, ALTURA AUTOMÁTICA (não se mexe na altura), só largura + posição.
//    Pros widgets grandes/retráteis (Canais Pagos, painéis de rede).
// Ambos: arrastar pela alça ⠿, largura em colunas (6), ocultar/mostrar, restaurar. Persiste por painel.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";

export interface WidgetDef { id: string; label: string; node: ReactNode; defaultSpan?: number; defaultH?: number }

const COLS = 6, GAP = 12, ROWH = 28, MINW = 2, MINH = 5, DEFH = 9;
const clampW = (n: number) => Math.max(MINW, Math.min(COLS, Math.round(n)));
const clampX = (x: number, w: number) => Math.max(0, Math.min(COLS - w, Math.round(x)));
const fracLabel = (w: number) => (w >= 6 ? "inteiro" : w >= 4 ? "2/3" : w === 3 ? "metade" : "1/3");

type Cell = { x: number; y: number; w: number; h: number };
const coll = (a: Cell, b: Cell) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
function compact(grid: Record<string, Cell>, ids: string[]): Record<string, Cell> {
  const items = ids.filter((id) => grid[id]).map((id) => ({ id, ...grid[id] })).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: (Cell & { id: string })[] = [];
  for (const it of items) { let y = 0; while (placed.some((p) => coll({ ...it, y }, p))) y++; placed.push({ ...it, y }); }
  const out: Record<string, Cell> = {};
  for (const p of placed) out[p.id] = { x: p.x, y: p.y, w: p.w, h: p.h };
  return out;
}

const sbtn: React.CSSProperties = { cursor: "pointer", border: "none", background: "transparent", color: "var(--label)", fontSize: 15, lineHeight: 1, padding: "0 4px", fontWeight: 700 };
const barCol = (active: boolean) => (active ? "var(--cyan)" : "color-mix(in srgb, var(--cyan) 50%, transparent)");

export function WidgetBoard({ panel, widgets, mode = "grid" }: { panel: string; widgets: WidgetDef[]; mode?: "grid" | "flow" }) {
  const layout = useStore((s) => s.widgetLayout[panel]);
  const setLayout = useStore((s) => s.setWidgetLayout);
  const [editing, setEditing] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = () => setNarrow(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const hidden = new Set(layout?.hidden ?? []);
  const savedOrder = (layout?.order ?? []).filter((id) => byId.has(id));
  const order = [...savedOrder, ...widgets.filter((w) => !savedOrder.includes(w.id)).map((w) => w.id)];
  const visible = order.filter((id) => !hidden.has(id));
  const hiddenList = order.filter((id) => hidden.has(id));

  const hide = (id: string) => setLayout(panel, { ...(layout ?? { hidden: [] }), hidden: [...hidden, id] });
  const show = (id: string) => setLayout(panel, { ...(layout ?? { hidden: [] }), hidden: [...hidden].filter((x) => x !== id) });

  // ── modo estreito (mobile): empilha, sem edição ──
  if (narrow) {
    return <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>{visible.map((id) => <div key={id}>{byId.get(id)!.node}</div>)}</div>;
  }

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
      {editing && <span style={{ fontSize: 12, color: "var(--label-3)", marginRight: "auto" }}>{mode === "grid" ? "Arraste ⠿ pra qualquer lugar · puxe as bordas ↔ / ↕ · 👁 oculta" : "Arraste ⠿ pra reposicionar · puxe a borda ↔ pra largura · 👁 oculta"}</span>}
      {editing && <button className="btn-link" type="button" onClick={() => setLayout(panel, { hidden: [], grid: undefined, order: widgets.map((w) => w.id), size: {}, height: {} })}>Restaurar padrão</button>}
      <button className="btn-link ig" type="button" onClick={() => setEditing((v) => !v)}>{editing ? "✓ Concluir" : "✎ Organizar"}</button>
    </div>
  );

  if (mode === "flow") return <FlowBoard {...{ panel, byId, order, visible, hiddenList, hidden, layout, setLayout, editing, header, hide, show, gridRef }} />;
  return <GridBoard {...{ panel, byId, visible, hiddenList, layout, setLayout, editing, header, hide, show, gridRef }} />;
}

// ══════════ MODE GRID (x,y,w,h livre) ══════════
function GridBoard({ panel, byId, visible, hiddenList, layout, setLayout, editing, header, hide, show, gridRef }: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [live, setLive] = useState<Record<string, Cell> | null>(null);
  const drag = useRef<{ id: string } | null>(null);
  const resize = useRef<{ id: string; axis: "x" | "y" | "xy" } | null>(null);

  const genDefault = (ids: string[]): Record<string, Cell> => {
    const g: Record<string, Cell> = {}; let x = 0, y = 0, rowH = 0;
    for (const id of ids) {
      const w = clampW(byId.get(id)?.defaultSpan ?? 3); const h = byId.get(id)?.defaultH ?? DEFH;
      if (x + w > COLS) { x = 0; y += rowH; rowH = 0; }
      g[id] = { x, y, w, h }; x += w; rowH = Math.max(rowH, h);
    }
    return g;
  };
  const buildGrid = (): Record<string, Cell> => {
    const stored = layout?.grid;
    if (!stored) return genDefault(visible);
    const g: Record<string, Cell> = {}; let maxY = 0;
    for (const id of visible) if (stored[id]) { g[id] = stored[id]; maxY = Math.max(maxY, stored[id].y + stored[id].h); }
    for (const id of visible) if (!g[id]) { g[id] = { x: 0, y: maxY, w: clampW(byId.get(id)?.defaultSpan ?? 3), h: byId.get(id)?.defaultH ?? DEFH }; maxY += g[id].h; }
    return g;
  };
  const grid = { ...buildGrid(), ...(live ?? {}) };
  const persistGrid = (g: Record<string, Cell>) => {
    const compacted = compact(g, visible);
    setLayout(panel, { ...(useStore.getState().widgetLayout[panel] ?? { hidden: [] }), hidden: [...(layout?.hidden ?? [])], grid: { ...(layout?.grid ?? {}), ...compacted } });
  };
  const setW = (id: string, w: number) => persistGrid({ ...grid, [id]: { ...grid[id], w: clampW(w), x: clampX(grid[id].x, clampW(w)) } });

  useEffect(() => {
    if (!editing) return;
    const onMove = (e: PointerEvent) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const colStep = (rect.width - GAP * (COLS - 1)) / COLS + GAP, rowStep = ROWH + GAP;
      if (drag.current) {
        const id = drag.current.id, cur = grid[id];
        const x = clampX((e.clientX - rect.left) / colStep - cur.w / 2 + 0.5, cur.w);
        const y = Math.max(0, Math.round((e.clientY - rect.top) / rowStep - cur.h / 2 + 0.5));
        setLive({ [id]: { ...cur, x, y } });
      } else if (resize.current) {
        const { id, axis } = resize.current, cur = grid[id]; let { w, h } = cur;
        if (axis !== "y") w = Math.max(MINW, Math.min(COLS - cur.x, Math.round((e.clientX - rect.left) / colStep - cur.x)));
        if (axis !== "x") h = Math.max(MINH, Math.round((e.clientY - rect.top) / rowStep - cur.y));
        setLive({ [id]: { ...cur, w, h } });
      }
    };
    const onUp = () => { if ((drag.current || resize.current) && live) persistGrid({ ...grid }); drag.current = null; resize.current = null; setLive(null); document.body.style.userSelect = ""; };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, live, layout]);

  return (
    <div>
      {header}
      <div ref={gridRef} className="wb-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))`, gridAutoRows: `${ROWH}px`, gap: GAP, marginBottom: 16 }}>
        {visible.map((id: string) => {
          const c = grid[id]; if (!c) return null; const w = byId.get(id)!;
          return (
            <div key={id} data-wid={id} style={{ gridColumn: `${c.x + 1} / span ${c.w}`, gridRow: `${c.y + 1} / span ${c.h}`, position: "relative", zIndex: (drag.current?.id === id || resize.current?.id === id) ? 5 : 1, opacity: drag.current?.id === id && live ? 0.75 : 1 }}>
              {editing && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, position: "absolute", top: 6, left: 8, right: 8, zIndex: 4, fontSize: 12, color: "var(--label-2)", background: "color-mix(in srgb, var(--white) 82%, transparent)", borderRadius: 8, padding: "2px 4px" }}>
                  <span onPointerDown={(e) => { e.preventDefault(); drag.current = { id }; document.body.style.userSelect = "none"; }} style={{ cursor: "grab", fontSize: 16, touchAction: "none", userSelect: "none" }} title="Arraste">⠿</span>
                  <b style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.label}</b>
                  <button type="button" onClick={() => setW(id, c.w - 1)} disabled={c.w <= MINW} style={sbtn} title="Estreitar">−</button>
                  <span style={{ fontSize: 11, color: "var(--label-3)", minWidth: 40, textAlign: "center" }}>{fracLabel(c.w)}</span>
                  <button type="button" onClick={() => setW(id, c.w + 1)} disabled={c.w >= COLS} style={sbtn} title="Alargar">+</button>
                  <button type="button" onClick={() => hide(id)} style={{ ...sbtn, fontSize: 13 }} title="Ocultar">👁</button>
                </div>
              )}
              <div className="wb-fill" style={{ height: "100%", overflow: "auto", borderRadius: 14, outline: editing ? "1.5px dashed color-mix(in srgb, var(--cyan) 40%, transparent)" : undefined, outlineOffset: 2 }}>{w.node}</div>
              {editing && (
                <>
                  <span onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); resize.current = { id, axis: "x" }; document.body.style.userSelect = "none"; }} title="Largura" style={{ position: "absolute", top: 0, right: -3, width: 12, height: "100%", cursor: "ew-resize", zIndex: 4, touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 4, height: 40, borderRadius: 999, background: barCol(resize.current?.id === id) }} /></span>
                  <span onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); resize.current = { id, axis: "y" }; document.body.style.userSelect = "none"; }} title="Altura" style={{ position: "absolute", left: 0, bottom: -3, height: 12, width: "100%", cursor: "ns-resize", zIndex: 4, touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ height: 4, width: 40, borderRadius: 999, background: barCol(resize.current?.id === id) }} /></span>
                  <span onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); resize.current = { id, axis: "xy" }; document.body.style.userSelect = "none"; }} title="Largura + altura" style={{ position: "absolute", right: -2, bottom: -2, width: 18, height: 18, cursor: "nwse-resize", zIndex: 5, touchAction: "none", borderRight: `3px solid ${barCol(resize.current?.id === id)}`, borderBottom: `3px solid ${barCol(resize.current?.id === id)}`, borderBottomRightRadius: 12 }} />
                </>
              )}
            </div>
          );
        })}
      </div>
      <HiddenTray {...{ editing, hiddenList, byId, show }} />
    </div>
  );
}

// ══════════ MODE FLOW (ordem + largura, ALTURA AUTOMÁTICA) ══════════
function FlowBoard({ panel, byId, order, visible, hiddenList, hidden, layout, setLayout, editing, header, hide, show, gridRef }: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const drag = useRef<{ id: string; drop: { id: string; after: boolean } | null } | null>(null);
  const resize = useRef<{ id: string } | null>(null);
  const [, force] = useState(0);

  const spanOf = (id: string) => clampW(layout?.size?.[id] ?? byId.get(id)?.defaultSpan ?? 3);
  const apply = (patch: any) => setLayout(panel, { ...(layout ?? { hidden: [] }), hidden: [...hidden], ...patch }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const setSpan = (id: string, w: number) => apply({ size: { ...(layout?.size ?? {}), [id]: clampW(w) } });
  const moveRel = (from: string, to: string, after: boolean) => {
    if (from === to) return;
    const a = order.filter((x: string) => x !== from);
    const ti = a.indexOf(to); if (ti < 0) return;
    a.splice(after ? ti + 1 : ti, 0, from);
    apply({ order: a });
  };

  useEffect(() => {
    if (!editing) return;
    const onMove = (e: PointerEvent) => {
      if (!gridRef.current) return;
      if (resize.current) {
        const rect = gridRef.current.getBoundingClientRect();
        const colStep = (rect.width - GAP * (COLS - 1)) / COLS + GAP;
        const el = gridRef.current.querySelector(`[data-wid="${resize.current.id}"]`) as HTMLElement | null;
        if (el) {
          const left = el.getBoundingClientRect().left;
          setSpan(resize.current.id, Math.round((e.clientX - left) / colStep));
        }
        return;
      }
      if (drag.current) {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const wrap = el?.closest("[data-wid]") as HTMLElement | null;
        const tid = wrap?.getAttribute("data-wid") || null;
        if (tid && tid !== drag.current.id) {
          const r = wrap!.getBoundingClientRect();
          const after = e.clientX > r.left + r.width / 2;
          drag.current.drop = { id: tid, after }; setDrop({ id: tid, after });
        } else { drag.current.drop = null; setDrop(null); }
      }
    };
    const onUp = () => {
      if (drag.current) { const { id, drop: dp } = drag.current; if (dp) moveRel(id, dp.id, dp.after); drag.current = null; setDragId(null); setDrop(null); }
      resize.current = null; force((n) => n + 1); document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, layout, order]);

  return (
    <div>
      {header}
      <div ref={gridRef} className="wb-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))`, gap: GAP, marginBottom: 16, alignItems: "start" }}>
        {visible.map((id: string) => {
          const w = byId.get(id)!; const span = spanOf(id);
          const isDropL = editing && drop?.id === id && !drop.after && dragId !== id;
          const isDropR = editing && drop?.id === id && drop.after && dragId !== id;
          return (
            <div key={id} data-wid={id} style={{ gridColumn: `span ${span}`, position: "relative", opacity: dragId === id ? 0.4 : 1 }}>
              {isDropL && <span style={{ position: "absolute", top: 24, bottom: 0, left: -9, width: 4, borderRadius: 999, background: "var(--cyan)", zIndex: 3 }} />}
              {isDropR && <span style={{ position: "absolute", top: 24, bottom: 0, right: -9, width: 4, borderRadius: 999, background: "var(--cyan)", zIndex: 3 }} />}
              {editing && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--label-2)" }}>
                  <span onPointerDown={(e) => { e.preventDefault(); drag.current = { id, drop: null }; setDragId(id); document.body.style.userSelect = "none"; }} style={{ cursor: "grab", fontSize: 16, touchAction: "none", userSelect: "none" }} title="Arraste">⠿</span>
                  <b style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.label}</b>
                  <button type="button" onClick={() => setSpan(id, span - 1)} disabled={span <= MINW} style={sbtn} title="Estreitar">−</button>
                  <span style={{ fontSize: 11, color: "var(--label-3)", minWidth: 40, textAlign: "center" }}>{fracLabel(span)}</span>
                  <button type="button" onClick={() => setSpan(id, span + 1)} disabled={span >= COLS} style={sbtn} title="Alargar">+</button>
                  <button type="button" onClick={() => hide(id)} style={{ ...sbtn, fontSize: 13 }} title="Ocultar">👁</button>
                </div>
              )}
              <div style={{ position: "relative", borderRadius: 14, outline: editing ? "1.5px dashed color-mix(in srgb, var(--cyan) 40%, transparent)" : undefined, outlineOffset: 2 }}>
                {w.node}
                {editing && (
                  <span onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); resize.current = { id }; document.body.style.userSelect = "none"; }} title="Largura" style={{ position: "absolute", top: 0, right: -3, width: 12, height: "100%", cursor: "ew-resize", zIndex: 4, touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 4, height: 40, borderRadius: 999, background: barCol(resize.current?.id === id) }} /></span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <HiddenTray {...{ editing, hiddenList, byId, show }} />
    </div>
  );
}

function HiddenTray({ editing, hiddenList, byId, show }: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!editing || !hiddenList.length) return null;
  return (
    <div className="card" style={{ padding: "12px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--label-3)", marginBottom: 8 }}>Widgets ocultos</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {hiddenList.map((id: string) => (
          <button key={id} className="btn-link" type="button" onClick={() => show(id)} style={{ padding: "4px 12px", border: "1px solid var(--hairline)", borderRadius: 999 }}>+ {byId.get(id)?.label}</button>
        ))}
      </div>
    </div>
  );
}
