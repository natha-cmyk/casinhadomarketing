"use client";
// Quadro de widgets em GRID LIVRE (tipo ClickUp/react-grid-layout). Cada widget tem
// coordenadas {x,y,w,h} numa grade de 6 colunas × linhas de 28px. Modo "Organizar":
// ARRASTA a alça ⠿ pra QUALQUER célula (inclusive espaços vazios); PUXA as bordas pra
// redimensionar (largura em colunas, altura em linhas). Ao soltar, compacta pra cima
// (sem sobreposição, preenche buracos). Layout persiste por painel.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";

export interface WidgetDef { id: string; label: string; node: ReactNode; defaultSpan?: number; defaultH?: number }

const COLS = 6, GAP = 12, ROWH = 28, MINW = 2, MINH = 5, DEFH = 9;
const clampW = (n: number) => Math.max(MINW, Math.min(COLS, Math.round(n)));
const clampX = (x: number, w: number) => Math.max(0, Math.min(COLS - w, Math.round(x)));
const fracLabel = (w: number) => (w >= 6 ? "inteiro" : w >= 4 ? "2/3" : w === 3 ? "metade" : "1/3");

type Cell = { x: number; y: number; w: number; h: number };
const coll = (a: Cell, b: Cell) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// compacta pra cima: empacota respeitando ordem (y, x), sem sobreposição, preenchendo buracos
function compact(grid: Record<string, Cell>, ids: string[]): Record<string, Cell> {
  const items = ids.filter((id) => grid[id]).map((id) => ({ id, ...grid[id] })).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: (Cell & { id: string })[] = [];
  for (const it of items) {
    let y = 0;
    while (placed.some((p) => coll({ ...it, y }, p))) y++;
    placed.push({ ...it, y });
  }
  const out: Record<string, Cell> = {};
  for (const p of placed) out[p.id] = { x: p.x, y: p.y, w: p.w, h: p.h };
  return out;
}

export function WidgetBoard({ panel, widgets }: { panel: string; widgets: WidgetDef[] }) {
  const layout = useStore((s) => s.widgetLayout[panel]);
  const setLayout = useStore((s) => s.setWidgetLayout);
  const [editing, setEditing] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [live, setLive] = useState<Record<string, Cell> | null>(null); // override durante arrasto/resize
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string } | null>(null);
  const resize = useRef<{ id: string; axis: "x" | "y" | "xy" } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const hidden = new Set(layout?.hidden ?? []);
  const savedOrder = (layout?.order ?? []).filter((id) => byId.has(id));
  const order = [...savedOrder, ...widgets.filter((w) => !savedOrder.includes(w.id)).map((w) => w.id)];
  const visible = order.filter((id) => !hidden.has(id));
  const hiddenList = order.filter((id) => hidden.has(id));

  // gera grid padrão a partir de defaultSpan (empacota 2 por linha ~)
  const genDefault = (ids: string[]): Record<string, Cell> => {
    const g: Record<string, Cell> = {};
    let x = 0, y = 0, rowH = 0;
    for (const id of ids) {
      const w = clampW(byId.get(id)?.defaultSpan ?? 3);
      const h = byId.get(id)?.defaultH ?? DEFH;
      if (x + w > COLS) { x = 0; y += rowH; rowH = 0; }
      g[id] = { x, y, w, h };
      x += w; rowH = Math.max(rowH, h);
    }
    return g;
  };
  // grid efetivo: salvo (+ novos widgets anexados no fim) ou padrão; live sobrepõe durante interação
  const buildGrid = (): Record<string, Cell> => {
    const stored = layout?.grid;
    if (!stored) return genDefault(visible);
    const g: Record<string, Cell> = {};
    let maxY = 0;
    for (const id of visible) if (stored[id]) { g[id] = stored[id]; maxY = Math.max(maxY, stored[id].y + stored[id].h); }
    // widgets visíveis sem coordenada → anexa no fim
    for (const id of visible) if (!g[id]) { g[id] = { x: 0, y: maxY, w: clampW(byId.get(id)?.defaultSpan ?? 3), h: byId.get(id)?.defaultH ?? DEFH }; maxY += g[id].h; }
    return g;
  };
  const grid = { ...buildGrid(), ...(live ?? {}) };

  const persistGrid = (g: Record<string, Cell>) => {
    const compacted = compact(g, visible);
    setLayout(panel, { ...(useStore.getState().widgetLayout[panel] ?? { hidden: [] }), hidden: [...hidden], grid: { ...(layout?.grid ?? {}), ...compacted } });
  };
  const hide = (id: string) => setLayout(panel, { ...(layout ?? { hidden: [] }), hidden: [...hidden, id] });
  const show = (id: string) => setLayout(panel, { ...(layout ?? { hidden: [] }), hidden: [...hidden].filter((x) => x !== id) });
  const reset = () => setLayout(panel, { hidden: [], grid: undefined, order: widgets.map((w) => w.id), size: {}, height: {} });
  const setW = (id: string, w: number) => { const g = { ...grid, [id]: { ...grid[id], w: clampW(w), x: clampX(grid[id].x, clampW(w)) } }; persistGrid(g); };

  useEffect(() => {
    if (!editing) return;
    const step = () => {
      const rect = gridRef.current!.getBoundingClientRect();
      return { rect, colStep: (rect.width - GAP * (COLS - 1)) / COLS + GAP, rowStep: ROWH + GAP };
    };
    const onMove = (e: PointerEvent) => {
      if (!gridRef.current) return;
      const { rect, colStep, rowStep } = step();
      if (drag.current) {
        const id = drag.current.id;
        const cur = grid[id];
        const x = clampX((e.clientX - rect.left) / colStep - cur.w / 2 + 0.5, cur.w);
        const y = Math.max(0, Math.round((e.clientY - rect.top) / rowStep - cur.h / 2 + 0.5));
        setLive({ [id]: { ...cur, x, y } });
      } else if (resize.current) {
        const { id, axis } = resize.current;
        const cur = grid[id];
        let { w, h } = cur;
        if (axis !== "y") w = Math.max(MINW, Math.min(COLS - cur.x, Math.round((e.clientX - rect.left) / colStep - cur.x)));
        if (axis !== "x") h = Math.max(MINH, Math.round((e.clientY - rect.top) / rowStep - cur.y));
        setLive({ [id]: { ...cur, w, h } });
      }
    };
    const onUp = () => {
      if ((drag.current || resize.current) && live) persistGrid({ ...grid });
      drag.current = null; resize.current = null; setLive(null);
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, live, layout]);

  const startDrag = (e: React.PointerEvent, id: string) => { e.preventDefault(); drag.current = { id }; document.body.style.userSelect = "none"; };
  const startResize = (e: React.PointerEvent, id: string, axis: "x" | "y" | "xy") => { e.preventDefault(); e.stopPropagation(); resize.current = { id, axis }; document.body.style.userSelect = "none"; };

  // ── modo estreito: empilha tudo, sem edição ──
  if (narrow) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
        {visible.map((id) => <div key={id}>{byId.get(id)!.node}</div>)}
      </div>
    );
  }

  const handleBar = (active: boolean) => (active ? "var(--cyan)" : "color-mix(in srgb, var(--cyan) 50%, transparent)");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        {editing && <span style={{ fontSize: 12, color: "var(--label-3)", marginRight: "auto" }}>Arraste ⠿ pra qualquer lugar (inclusive espaços vazios) · puxe as bordas ↔ / ↕ · 👁 oculta</span>}
        {editing && <button className="btn-link" type="button" onClick={reset}>Restaurar padrão</button>}
        <button className="btn-link ig" type="button" onClick={() => setEditing((v) => !v)}>{editing ? "✓ Concluir" : "✎ Organizar"}</button>
      </div>

      <div ref={gridRef} className="wb-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))`, gridAutoRows: `${ROWH}px`, gap: GAP, marginBottom: 16 }}>
        {visible.map((id) => {
          const c = grid[id];
          if (!c) return null;
          const w = byId.get(id)!;
          const active = (drag.current?.id === id || resize.current?.id === id) && !!live;
          return (
            <div key={id} data-wid={id} style={{ gridColumn: `${c.x + 1} / span ${c.w}`, gridRow: `${c.y + 1} / span ${c.h}`, position: "relative", zIndex: active ? 5 : 1, opacity: drag.current?.id === id && live ? 0.75 : 1 }}>
              {editing && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, position: "absolute", top: 6, left: 8, right: 8, zIndex: 4, fontSize: 12, color: "var(--label-2)", background: "color-mix(in srgb, var(--white) 82%, transparent)", borderRadius: 8, padding: "2px 4px", backdropFilter: "blur(2px)" }}>
                  <span onPointerDown={(e) => startDrag(e, id)} style={{ cursor: "grab", fontSize: 16, touchAction: "none", userSelect: "none" }} title="Arraste">⠿</span>
                  <b style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.label}</b>
                  <button type="button" onClick={() => setW(id, c.w - 1)} disabled={c.w <= MINW} style={sbtn} title="Estreitar">−</button>
                  <span style={{ fontSize: 11, color: "var(--label-3)", minWidth: 40, textAlign: "center" }}>{fracLabel(c.w)}</span>
                  <button type="button" onClick={() => setW(id, c.w + 1)} disabled={c.w >= COLS} style={sbtn} title="Alargar">+</button>
                  <button type="button" onClick={() => hide(id)} style={{ ...sbtn, fontSize: 13 }} title="Ocultar">👁</button>
                </div>
              )}
              <div className="wb-fill" style={{ height: "100%", overflow: "auto", borderRadius: 14, outline: editing ? "1.5px dashed color-mix(in srgb, var(--cyan) 40%, transparent)" : undefined, outlineOffset: 2, position: "relative" }}>
                {w.node}
              </div>
              {editing && (
                <>
                  <span onPointerDown={(e) => startResize(e, id, "x")} title="Largura" style={{ position: "absolute", top: 0, right: -3, width: 12, height: "100%", cursor: "ew-resize", zIndex: 4, touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ width: 4, height: 40, borderRadius: 999, background: handleBar(resize.current?.id === id) }} /></span>
                  <span onPointerDown={(e) => startResize(e, id, "y")} title="Altura" style={{ position: "absolute", left: 0, bottom: -3, height: 12, width: "100%", cursor: "ns-resize", zIndex: 4, touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ height: 4, width: 40, borderRadius: 999, background: handleBar(resize.current?.id === id) }} /></span>
                  <span onPointerDown={(e) => startResize(e, id, "xy")} title="Largura + altura" style={{ position: "absolute", right: -2, bottom: -2, width: 18, height: 18, cursor: "nwse-resize", zIndex: 5, touchAction: "none", borderRight: `3px solid ${handleBar(resize.current?.id === id)}`, borderBottom: `3px solid ${handleBar(resize.current?.id === id)}`, borderBottomRightRadius: 12 }} />
                </>
              )}
            </div>
          );
        })}
      </div>

      {editing && hiddenList.length > 0 && (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--label-3)", marginBottom: 8 }}>Widgets ocultos</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {hiddenList.map((id) => (
              <button key={id} className="btn-link" type="button" onClick={() => show(id)} style={{ padding: "4px 12px", border: "1px solid var(--hairline)", borderRadius: 999 }}>+ {byId.get(id)?.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sbtn: React.CSSProperties = { cursor: "pointer", border: "none", background: "transparent", color: "var(--label)", fontSize: 15, lineHeight: 1, padding: "0 4px", fontWeight: 700 };
