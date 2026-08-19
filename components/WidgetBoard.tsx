"use client";
// Quadro de widgets arrastável + redimensionável (estilo ClickUp), reutilizável por painel.
// Grid de 6 colunas: cada widget ocupa de 2 (1/3) a 6 (inteiro) colunas. Layout (ordem +
// tamanho + ocultos) persiste por painel em store.widgetLayout.
// Modo "Organizar": ALÇA (⠿) arrasta pra reordenar; −/+ mudam a largura; olho oculta/mostra.
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";

export interface WidgetDef {
  id: string;
  label: string;
  node: ReactNode;
  defaultSpan?: number; // 2..6 colunas (de 6). 2=1/3, 3=1/2, 6=inteiro
}

const COLS = 6, MIN = 2, MAX = 6, DEF = 3;
const clamp = (n: number) => Math.max(MIN, Math.min(MAX, Math.round(n)));
const fracLabel = (span: number) => (span >= 6 ? "inteiro" : span >= 4 ? "2/3" : span === 3 ? "metade" : "1/3");

export function WidgetBoard({ panel, widgets }: { panel: string; widgets: WidgetDef[] }) {
  const layout = useStore((s) => s.widgetLayout[panel]);
  const setLayout = useStore((s) => s.setWidgetLayout);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const savedOrder = (layout?.order ?? []).filter((id) => byId.has(id));
  const order = [...savedOrder, ...widgets.filter((w) => !savedOrder.includes(w.id)).map((w) => w.id)];
  const hidden = new Set(layout?.hidden ?? []);
  const spanOf = (id: string) => clamp(layout?.size?.[id] ?? byId.get(id)?.defaultSpan ?? DEF);
  const visible = order.filter((id) => !hidden.has(id));
  const hiddenList = order.filter((id) => hidden.has(id));

  const persist = (patch: Partial<{ order: string[]; size: Record<string, number>; hidden: string[] }>) =>
    setLayout(panel, {
      order: patch.order ?? order,
      size: patch.size ?? { ...(layout?.size ?? {}) },
      hidden: patch.hidden ?? [...hidden],
    });
  const move = (from: string, to: string) => {
    if (from === to) return;
    const a = [...order];
    const fi = a.indexOf(from), ti = a.indexOf(to);
    if (fi < 0 || ti < 0) return;
    a.splice(fi, 1);
    a.splice(ti, 0, from);
    persist({ order: a });
  };
  const setSpan = (id: string, span: number) => persist({ size: { ...(layout?.size ?? {}), [id]: clamp(span) } });
  const hide = (id: string) => persist({ hidden: [...hidden, id] });
  const show = (id: string) => persist({ hidden: [...hidden].filter((x) => x !== id) });
  const reset = () => setLayout(panel, { order: widgets.map((w) => w.id), size: {}, hidden: [] });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        {editing && <span style={{ fontSize: 12, color: "var(--label-3)", marginRight: "auto" }}>Arraste pela alça ⠿ · use −/+ pra largura · 👁 oculta</span>}
        {editing && <button className="btn-link" type="button" onClick={reset}>Restaurar padrão</button>}
        <button className="btn-link ig" type="button" onClick={() => setEditing((e) => !e)} title="Organizar widgets">
          {editing ? "✓ Concluir" : "✎ Organizar"}
        </button>
      </div>

      <div
        className={`wb-grid${editing ? " wb-editing" : ""}`}
        style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, minmax(0,1fr))`, gridAutoFlow: "row dense", gap: 16, marginBottom: 16, alignItems: "start" }}
      >
        {visible.map((id) => {
          const w = byId.get(id)!;
          const span = spanOf(id);
          const isOver = editing && overId === id && dragId !== id;
          return (
            <div
              key={id}
              style={{ gridColumn: `span ${span}`, position: "relative" }}
              onDragOver={(e) => { if (editing && dragId) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverId(id); } }}
              onDragLeave={() => { if (overId === id) setOverId(null); }}
              onDrop={(e) => { if (editing && dragId) { e.preventDefault(); move(dragId, id); } setDragId(null); setOverId(null); }}
            >
              {editing && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--label-2)" }}>
                  <span
                    draggable
                    onDragStart={(e) => { setDragId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); }}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    style={{ cursor: "grab", fontSize: 16, lineHeight: 1, padding: "0 4px", userSelect: "none" }}
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
              <div style={{ outline: isOver ? "2px solid var(--cyan)" : editing ? "1.5px dashed color-mix(in srgb, var(--cyan) 40%, transparent)" : undefined, outlineOffset: 3, borderRadius: 14, transition: "outline .1s" }}>
                {w.node}
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
