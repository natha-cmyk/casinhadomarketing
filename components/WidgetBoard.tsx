"use client";
// Quadro de widgets arrastável + redimensionável, reutilizável por painel.
// Layout (ordem + tamanho sm/lg + ocultos) persiste por painel em store.widgetLayout.
// Modo "Organizar": arrasta pra reordenar, alterna tamanho (metade/inteiro) e oculta/mostra.
import { useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";

export interface WidgetDef {
  id: string;
  label: string;
  node: ReactNode;
  defaultSize?: "sm" | "lg"; // sm = meia largura; lg = largura inteira
}

export function WidgetBoard({ panel, widgets }: { panel: string; widgets: WidgetDef[] }) {
  const layout = useStore((s) => s.widgetLayout[panel]);
  const setLayout = useStore((s) => s.setWidgetLayout);
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const byId = new Map(widgets.map((w) => [w.id, w]));
  // ordem efetiva: a salva (filtrando ids que ainda existem) + widgets novos no fim
  const savedOrder = (layout?.order ?? []).filter((id) => byId.has(id));
  const order = [...savedOrder, ...widgets.filter((w) => !savedOrder.includes(w.id)).map((w) => w.id)];
  const hidden = new Set(layout?.hidden ?? []);
  const sizeOf = (id: string): "sm" | "lg" => layout?.size?.[id] ?? byId.get(id)?.defaultSize ?? "sm";
  const visible = order.filter((id) => !hidden.has(id));
  const hiddenList = order.filter((id) => hidden.has(id));

  const persist = (patch: Partial<{ order: string[]; size: Record<string, "sm" | "lg">; hidden: string[] }>) =>
    setLayout(panel, {
      order: patch.order ?? order,
      size: patch.size ?? { ...(layout?.size ?? {}) },
      hidden: patch.hidden ?? [...hidden],
    });

  const move = (from: string, to: string) => {
    if (from === to) return;
    const arr = [...order];
    const fi = arr.indexOf(from), ti = arr.indexOf(to);
    if (fi < 0 || ti < 0) return;
    arr.splice(fi, 1);
    arr.splice(ti, 0, from);
    persist({ order: arr });
  };
  const toggleSize = (id: string) => persist({ size: { ...(layout?.size ?? {}), [id]: sizeOf(id) === "lg" ? "sm" : "lg" } });
  const hide = (id: string) => persist({ hidden: [...hidden, id] });
  const show = (id: string) => persist({ hidden: [...hidden].filter((x) => x !== id) });
  const reset = () => setLayout(panel, { order: widgets.map((w) => w.id), size: {}, hidden: [] });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12 }}>
        {editing && <button className="btn-link" type="button" onClick={reset}>Restaurar padrão</button>}
        <button className="btn-link" type="button" onClick={() => setEditing((e) => !e)} title="Arrastar, redimensionar e ocultar widgets">
          {editing ? "✓ Concluir" : "✎ Organizar"}
        </button>
      </div>

      <div className={`wb-grid${editing ? " wb-editing" : ""}`} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16, marginBottom: 16, alignItems: "start" }}>
        {visible.map((id) => {
          const w = byId.get(id)!;
          const lg = sizeOf(id) === "lg";
          return (
            <div
              key={id}
              style={{ gridColumn: lg ? "1 / -1" : "auto", position: "relative" }}
              draggable={editing}
              onDragStart={() => setDragId(id)}
              onDragOver={(e) => { if (editing) e.preventDefault(); }}
              onDrop={() => { if (editing && dragId) move(dragId, id); setDragId(null); }}
              className={editing && dragId === id ? "wb-dragging" : ""}
            >
              {editing && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, color: "var(--label-2)" }}>
                  <span style={{ cursor: "grab", fontSize: 14 }} title="Arrastar">⠿</span>
                  <b style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.label}</b>
                  <button className="btn-link" type="button" onClick={() => toggleSize(id)} title={lg ? "Metade da largura" : "Largura inteira"} style={{ padding: "2px 8px" }}>
                    {lg ? "◧ Metade" : "▭ Inteiro"}
                  </button>
                  <button className="btn-link" type="button" onClick={() => hide(id)} title="Ocultar" style={{ padding: "2px 8px" }}>Ocultar</button>
                </div>
              )}
              <div style={editing ? { outline: "1.5px dashed color-mix(in srgb, var(--cyan) 45%, transparent)", outlineOffset: 3, borderRadius: 14 } : undefined}>
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
