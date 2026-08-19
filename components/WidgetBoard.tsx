"use client";
// Quadro de widgets maleável (estilo editor) — pointer events (não HTML5 DnD, que é frágil).
// ARRASTAR: segura a alça ⠿ e move o mouse; solta sobre outro widget pra reordenar.
// REDIMENSIONAR: puxa a borda direita com o ponteiro (largura em colunas, 1/3 → inteiro).
// −/+ continuam como atalho. Layout (ordem + span 2..6 + ocultos) persiste por painel.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";

export interface WidgetDef {
  id: string;
  label: string;
  node: ReactNode;
  defaultSpan?: number; // 2..6 colunas (de 6). 2=1/3, 3=1/2, 4=2/3, 6=inteiro
}

const COLS = 6, MIN = 2, MAX = 6, DEF = 3, GAP = 16;
const clamp = (n: number) => Math.max(MIN, Math.min(MAX, Math.round(n)));
const fracLabel = (s: number) => (s >= 6 ? "inteiro" : s >= 4 ? "2/3" : s === 3 ? "metade" : "1/3");

export function WidgetBoard({ panel, widgets }: { panel: string; widgets: WidgetDef[] }) {
  const layout = useStore((s) => s.widgetLayout[panel]);
  const setLayout = useStore((s) => s.setWidgetLayout);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; overId: string | null } | null>(null);
  const resize = useRef<{ id: string; startX: number; startSpan: number; step: number; last: number } | null>(null);

  const byId = new Map(widgets.map((w) => [w.id, w]));

  // computa ordem/hidden/span SEMPRE do estado mais recente (evita closure velha nos handlers)
  const compute = (lay = layout) => {
    const savedOrder = (lay?.order ?? []).filter((id) => byId.has(id));
    const order = [...savedOrder, ...widgets.filter((w) => !savedOrder.includes(w.id)).map((w) => w.id)];
    const hidden = new Set(lay?.hidden ?? []);
    return { order, hidden };
  };
  const { order, hidden } = compute();
  const spanOf = (id: string, lay = layout) => clamp(lay?.size?.[id] ?? byId.get(id)?.defaultSpan ?? DEF);
  const visible = order.filter((id) => !hidden.has(id));
  const hiddenList = order.filter((id) => hidden.has(id));

  // aplica mudança lendo o estado MAIS RECENTE do store
  const apply = (patch: Partial<{ order: string[]; size: Record<string, number>; hidden: string[] }>) => {
    const lay = useStore.getState().widgetLayout[panel];
    const { order: ord, hidden: hid } = compute(lay);
    setLayout(panel, {
      order: patch.order ?? ord,
      size: patch.size ?? { ...(lay?.size ?? {}) },
      hidden: patch.hidden ?? [...hid],
    });
  };
  const move = (from: string, to: string) => {
    if (from === to) return;
    const { order: ord } = compute(useStore.getState().widgetLayout[panel]);
    const a = [...ord];
    const fi = a.indexOf(from), ti = a.indexOf(to);
    if (fi < 0 || ti < 0) return;
    a.splice(fi, 1);
    a.splice(ti, 0, from);
    apply({ order: a });
  };
  const setSpan = (id: string, span: number) => {
    const lay = useStore.getState().widgetLayout[panel];
    apply({ size: { ...(lay?.size ?? {}), [id]: clamp(span) } });
  };
  const hide = (id: string) => apply({ hidden: [...compute(useStore.getState().widgetLayout[panel]).hidden, id] });
  const show = (id: string) => apply({ hidden: [...compute(useStore.getState().widgetLayout[panel]).hidden].filter((x) => x !== id) });
  const reset = () => setLayout(panel, { order: widgets.map((w) => w.id), size: {}, hidden: [] });

  // listeners globais de pointer (registrados 1x enquanto edita)
  useEffect(() => {
    if (!editing) return;
    const onMove = (e: PointerEvent) => {
      if (resize.current) {
        const d = e.clientX - resize.current.startX;
        const next = clamp(resize.current.startSpan + d / resize.current.step);
        if (next !== resize.current.last) {
          resize.current.last = next;
          setSpan(resize.current.id, next);
        }
        return;
      }
      if (drag.current) {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const wrap = el?.closest("[data-wid]");
        const over = wrap?.getAttribute("data-wid") || null;
        drag.current.overId = over;
        setOverId(over);
      }
    };
    const onUp = () => {
      if (drag.current) {
        const { id, overId: ov } = drag.current;
        if (ov && ov !== id) move(id, ov);
        drag.current = null;
        setDragId(null);
        setOverId(null);
      }
      if (resize.current) {
        resize.current = null;
        setResizingId(null);
      }
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    drag.current = { id, overId: null };
    setDragId(id);
    document.body.style.userSelect = "none";
  };
  const startResize = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const w = gridRef.current?.getBoundingClientRect().width ?? 600;
    const step = (w + GAP) / COLS; // px por coluna (inclui o gap)
    const cur = spanOf(id);
    resize.current = { id, startX: e.clientX, startSpan: cur, step, last: cur };
    setResizingId(id);
    document.body.style.userSelect = "none";
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        {editing && <span style={{ fontSize: 12, color: "var(--label-3)", marginRight: "auto" }}>Arraste pela alça ⠿ · puxe a borda direita ↔ pra largura · 👁 oculta</span>}
        {editing && <button className="btn-link" type="button" onClick={reset}>Restaurar padrão</button>}
        <button className="btn-link ig" type="button" onClick={() => setEditing((v) => !v)} title="Organizar widgets">
          {editing ? "✓ Concluir" : "✎ Organizar"}
        </button>
      </div>

      <div
        ref={gridRef}
        className={`wb-grid${editing ? " wb-editing" : ""}`}
        style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))`, gridAutoFlow: "row dense", gap: GAP, marginBottom: 16, alignItems: "start" }}
      >
        {visible.map((id) => {
          const w = byId.get(id)!;
          const span = spanOf(id);
          const isOver = editing && overId === id && dragId !== id;
          const isDragged = dragId === id;
          const isResizing = resizingId === id;
          return (
            <div
              key={id}
              data-wid={id}
              style={{ gridColumn: `span ${span}`, position: "relative", opacity: isDragged ? 0.45 : 1 }}
            >
              {editing && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--label-2)" }}>
                  <span
                    onPointerDown={(e) => startDrag(e, id)}
                    style={{ cursor: "grab", fontSize: 16, lineHeight: 1, padding: "0 4px", userSelect: "none", touchAction: "none" }}
                    title="Arraste pra reordenar"
                    aria-label="Arrastar"
                  >⠿</span>
                  <b style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.label}</b>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--hairline)", borderRadius: 999, padding: "1px 4px" }}>
                    <button type="button" onClick={() => setSpan(id, span - 1)} disabled={span <= MIN} title="Diminuir" style={sbtn}>−</button>
                    <span style={{ fontSize: 11, minWidth: 44, textAlign: "center", color: "var(--label-3)" }}>{fracLabel(span)}</span>
                    <button type="button" onClick={() => setSpan(id, span + 1)} disabled={span >= MAX} title="Aumentar" style={sbtn}>+</button>
                  </span>
                  <button type="button" onClick={() => hide(id)} title="Ocultar" style={{ ...sbtn, fontSize: 13, padding: "2px 6px" }}>👁</button>
                </div>
              )}
              <div style={{ position: "relative", outline: isOver ? "2px solid var(--cyan)" : editing ? "1.5px dashed color-mix(in srgb, var(--cyan) 40%, transparent)" : undefined, outlineOffset: 3, borderRadius: 14 }}>
                {w.node}
                {editing && (
                  // alça de redimensionar (borda direita) — puxe com o mouse
                  <span
                    onPointerDown={(e) => startResize(e, id)}
                    title="Puxe pra redimensionar"
                    style={{
                      position: "absolute", top: 0, right: -3, width: 12, height: "100%",
                      cursor: "ew-resize", display: "flex", alignItems: "center", justifyContent: "center",
                      touchAction: "none", zIndex: 2,
                    }}
                  >
                    <span style={{ width: 4, height: 34, borderRadius: 999, background: isResizing ? "var(--cyan)" : "color-mix(in srgb, var(--cyan) 55%, transparent)" }} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && hiddenList.length > 0 && (
        <div className="card" style={{ padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--label-3)", marginBottom: 8 }}>Widgets ocultos</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {hiddenList.map((id) => (
              <button key={id} className="btn-link" type="button" onClick={() => show(id)} style={{ padding: "4px 12px", border: "1px solid var(--hairline)", borderRadius: 999 }}>
                + {byId.get(id)?.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const sbtn: React.CSSProperties = { cursor: "pointer", border: "none", background: "transparent", color: "var(--label)", fontSize: 15, lineHeight: 1, padding: "0 4px", fontWeight: 700 };
