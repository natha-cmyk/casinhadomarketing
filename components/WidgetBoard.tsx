"use client";
// Quadro de widgets maleável (estilo editor) — pointer events. Personalização ponto-a-ponto:
// ARRASTAR: segura a alça ⠿ e solta ANTES/DEPOIS de outro widget (metade esquerda = antes, direita = depois).
// LARGURA: puxa a borda direita (colunas 1/3..inteiro). ALTURA: puxa a borda inferior. CANTO: os dois.
// −/+ atalho de largura. Layout (ordem + span + altura + ocultos) persiste por painel.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";

export interface WidgetDef { id: string; label: string; node: ReactNode; defaultSpan?: number }

const COLS = 6, MIN = 2, MAX = 6, DEF = 3, GAP = 16, MINH = 160;
const clamp = (n: number) => Math.max(MIN, Math.min(MAX, Math.round(n)));
const fracLabel = (s: number) => (s >= 6 ? "inteiro" : s >= 4 ? "2/3" : s === 3 ? "metade" : "1/3");

type Axis = "x" | "y" | "xy";

export function WidgetBoard({ panel, widgets }: { panel: string; widgets: WidgetDef[] }) {
  const layout = useStore((s) => s.widgetLayout[panel]);
  const setLayout = useStore((s) => s.setWidgetLayout);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; drop: { id: string; after: boolean } | null } | null>(null);
  const resize = useRef<{ id: string; axis: Axis; startX: number; startY: number; startSpan: number; startH: number; step: number; lastSpan: number; el: HTMLElement } | null>(null);

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const compute = (lay = layout) => {
    const savedOrder = (lay?.order ?? []).filter((id) => byId.has(id));
    const order = [...savedOrder, ...widgets.filter((w) => !savedOrder.includes(w.id)).map((w) => w.id)];
    return { order, hidden: new Set(lay?.hidden ?? []) };
  };
  const { order, hidden } = compute();
  const spanOf = (id: string, lay = layout) => clamp(lay?.size?.[id] ?? byId.get(id)?.defaultSpan ?? DEF);
  const heightOf = (id: string, lay = layout) => lay?.height?.[id];
  const visible = order.filter((id) => !hidden.has(id));
  const hiddenList = order.filter((id) => hidden.has(id));

  const apply = (patch: Partial<{ order: string[]; size: Record<string, number>; height: Record<string, number>; hidden: string[] }>) => {
    const lay = useStore.getState().widgetLayout[panel];
    const { order: ord, hidden: hid } = compute(lay);
    setLayout(panel, {
      order: patch.order ?? ord,
      size: patch.size ?? { ...(lay?.size ?? {}) },
      height: patch.height ?? { ...(lay?.height ?? {}) },
      hidden: patch.hidden ?? [...hid],
    });
  };
  // insere `from` ANTES ou DEPOIS de `to` — posicionamento livre (não é só swap)
  const moveRel = (from: string, to: string, after: boolean) => {
    if (from === to) return;
    const { order: ord } = compute(useStore.getState().widgetLayout[panel]);
    const a = ord.filter((x) => x !== from);
    const ti = a.indexOf(to);
    if (ti < 0) return;
    a.splice(after ? ti + 1 : ti, 0, from);
    apply({ order: a });
  };
  const setSpan = (id: string, span: number) => apply({ size: { ...(useStore.getState().widgetLayout[panel]?.size ?? {}), [id]: clamp(span) } });
  const setHeight = (id: string, h: number) => apply({ height: { ...(useStore.getState().widgetLayout[panel]?.height ?? {}), [id]: Math.max(MINH, Math.round(h)) } });
  const hide = (id: string) => apply({ hidden: [...compute(useStore.getState().widgetLayout[panel]).hidden, id] });
  const show = (id: string) => apply({ hidden: [...compute(useStore.getState().widgetLayout[panel]).hidden].filter((x) => x !== id) });
  const reset = () => setLayout(panel, { order: widgets.map((w) => w.id), size: {}, height: {}, hidden: [] });

  useEffect(() => {
    if (!editing) return;
    const onMove = (e: PointerEvent) => {
      if (resize.current) {
        const r = resize.current;
        if (r.axis !== "y") {
          const next = clamp(r.startSpan + (e.clientX - r.startX) / r.step);
          if (next !== r.lastSpan) { r.lastSpan = next; setSpan(r.id, next); }
        }
        if (r.axis !== "x") setHeight(r.id, r.startH + (e.clientY - r.startY));
        return;
      }
      if (drag.current) {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const wrap = el?.closest("[data-wid]") as HTMLElement | null;
        const tid = wrap?.getAttribute("data-wid") || null;
        if (tid && tid !== drag.current.id) {
          const rect = wrap!.getBoundingClientRect();
          const after = e.clientX > rect.left + rect.width / 2; // metade direita = depois
          drag.current.drop = { id: tid, after };
          setDrop({ id: tid, after });
        } else {
          drag.current.drop = null;
          setDrop(null);
        }
      }
    };
    const onUp = () => {
      if (drag.current) {
        const { id, drop: dp } = drag.current;
        if (dp) moveRel(id, dp.id, dp.after);
        drag.current = null; setDragId(null); setDrop(null);
      }
      if (resize.current) { resize.current = null; setBusyId(null); }
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const startDrag = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    drag.current = { id, drop: null };
    setDragId(id);
    document.body.style.userSelect = "none";
  };
  const startResize = (e: React.PointerEvent, id: string, axis: Axis) => {
    e.preventDefault();
    e.stopPropagation();
    const gw = gridRef.current?.getBoundingClientRect().width ?? 600;
    const cell = (e.currentTarget as HTMLElement).closest("[data-wid]")?.querySelector(".wb-fill") as HTMLElement | null;
    const startH = cell?.getBoundingClientRect().height ?? MINH;
    const cur = spanOf(id);
    resize.current = { id, axis, startX: e.clientX, startY: e.clientY, startSpan: cur, startH, step: (gw + GAP) / COLS, lastSpan: cur, el: cell as HTMLElement };
    setBusyId(id);
    document.body.style.userSelect = "none";
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        {editing && <span style={{ fontSize: 12, color: "var(--label-3)", marginRight: "auto" }}>Arraste pela alça ⠿ (solta antes/depois) · puxe as bordas ↔ / ↕ · 👁 oculta</span>}
        {editing && <button className="btn-link" type="button" onClick={reset}>Restaurar padrão</button>}
        <button className="btn-link ig" type="button" onClick={() => setEditing((v) => !v)} title="Organizar widgets">
          {editing ? "✓ Concluir" : "✎ Organizar"}
        </button>
      </div>

      <div
        ref={gridRef}
        className={`wb-grid${editing ? " wb-editing" : ""}`}
        style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))`, gap: GAP, marginBottom: 16, alignItems: "start" }}
      >
        {visible.map((id) => {
          const w = byId.get(id)!;
          const span = spanOf(id);
          const h = heightOf(id);
          const isDropL = editing && drop?.id === id && !drop.after && dragId !== id;
          const isDropR = editing && drop?.id === id && drop.after && dragId !== id;
          return (
            <div key={id} data-wid={id} style={{ gridColumn: `span ${span}`, position: "relative", opacity: dragId === id ? 0.4 : 1 }}>
              {/* indicadores de solte (antes/depois) */}
              {isDropL && <span style={dropBar("left")} />}
              {isDropR && <span style={dropBar("right")} />}

              {editing && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--label-2)" }}>
                  <span onPointerDown={(e) => startDrag(e, id)} style={{ cursor: "grab", fontSize: 16, lineHeight: 1, padding: "0 4px", userSelect: "none", touchAction: "none" }} title="Arraste pra reposicionar" aria-label="Arrastar">⠿</span>
                  <b style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.label}</b>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--hairline)", borderRadius: 999, padding: "1px 4px" }}>
                    <button type="button" onClick={() => setSpan(id, span - 1)} disabled={span <= MIN} title="Estreitar" style={sbtn}>−</button>
                    <span style={{ fontSize: 11, minWidth: 44, textAlign: "center", color: "var(--label-3)" }}>{fracLabel(span)}</span>
                    <button type="button" onClick={() => setSpan(id, span + 1)} disabled={span >= MAX} title="Alargar" style={sbtn}>+</button>
                  </span>
                  {h != null && <button type="button" onClick={() => apply({ height: Object.fromEntries(Object.entries(useStore.getState().widgetLayout[panel]?.height ?? {}).filter(([k]) => k !== id)) })} title="Altura automática" style={{ ...sbtn, fontSize: 11 }}>auto↕</button>}
                  <button type="button" onClick={() => hide(id)} title="Ocultar" style={{ ...sbtn, fontSize: 13, padding: "2px 6px" }}>👁</button>
                </div>
              )}

              <div className="wb-fill" style={{ position: "relative", height: h ? `${h}px` : undefined, overflow: h ? "auto" : undefined, outline: editing ? "1.5px dashed color-mix(in srgb, var(--cyan) 40%, transparent)" : undefined, outlineOffset: 3, borderRadius: 14 }}>
                {w.node}
                {editing && (
                  <>
                    {/* borda direita = largura */}
                    <span onPointerDown={(e) => startResize(e, id, "x")} title="Puxe pra largura" style={{ position: "absolute", top: 0, right: -4, width: 14, height: "100%", cursor: "ew-resize", zIndex: 2, touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ width: 4, height: 40, borderRadius: 999, background: busyId === id ? "var(--cyan)" : "color-mix(in srgb, var(--cyan) 50%, transparent)" }} />
                    </span>
                    {/* borda inferior = altura */}
                    <span onPointerDown={(e) => startResize(e, id, "y")} title="Puxe pra altura" style={{ position: "absolute", left: 0, bottom: -4, height: 14, width: "100%", cursor: "ns-resize", zIndex: 2, touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ height: 4, width: 40, borderRadius: 999, background: busyId === id ? "var(--cyan)" : "color-mix(in srgb, var(--cyan) 50%, transparent)" }} />
                    </span>
                    {/* canto = os dois */}
                    <span onPointerDown={(e) => startResize(e, id, "xy")} title="Puxe pra ajustar largura e altura" style={{ position: "absolute", right: -2, bottom: -2, width: 18, height: 18, cursor: "nwse-resize", zIndex: 3, touchAction: "none", borderRight: `3px solid ${busyId === id ? "var(--cyan)" : "color-mix(in srgb, var(--cyan) 60%, transparent)"}`, borderBottom: `3px solid ${busyId === id ? "var(--cyan)" : "color-mix(in srgb, var(--cyan) 60%, transparent)"}`, borderBottomRightRadius: 12 }} />
                  </>
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
const dropBar = (side: "left" | "right"): React.CSSProperties => ({ position: "absolute", top: 24, bottom: 0, [side]: -9, width: 4, borderRadius: 999, background: "var(--cyan)", zIndex: 3 });
