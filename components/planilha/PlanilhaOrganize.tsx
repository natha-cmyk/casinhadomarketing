"use client";
// Painel "Organizar" da planilha: ocultar/mostrar, reordenar (↑/↓) e adicionar indicadores manuais.
// Só personalização — a estrutura padrão (fiel à planilha) continua sendo o default.
import { useState } from "react";
import type { PSection, CellKind } from "@/lib/planilha/spec";

const KIND_LABEL: Record<CellKind, string> = { int: "Número", dec: "Decimal", pct: "Percentual", money: "R$ (dinheiro)", text: "Texto" };

interface Props {
  sections: PSection[]; // completas (com custom + ocultas visíveis)
  hidden: Set<string>;
  customKeys: Set<string>;
  onToggleHide: (key: string) => void;
  onMove: (sectionTitle: string, key: string, dir: -1 | 1) => void;
  onAddCustom: (c: { section: string; label: string; kind: CellKind }) => void;
  onRemoveCustom: (key: string) => void;
}

export function PlanilhaOrganize({ sections, hidden, customKeys, onToggleHide, onMove, onAddCustom, onRemoveCustom }: Props) {
  const [sec, setSec] = useState<string>(sections[0]?.title || "");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<CellKind>("int");

  const add = () => {
    const l = label.trim();
    if (!l) return;
    onAddCustom({ section: sec || "PERSONALIZADOS", label: l, kind });
    setLabel("");
  };

  return (
    <div className="pl-org">
      <div className="pl-org-h">Organizar indicadores — oculte, reordene ou adicione. O padrão continua fiel à planilha.</div>
      <div className="pl-org-grid">
        {sections.map((s) => (
          <div key={s.title} className="pl-org-sec">
            <div className="pl-org-sect">{s.title}</div>
            {s.rows.map((r, i) => {
              const isHidden = hidden.has(r.key);
              const isCustom = customKeys.has(r.key);
              return (
                <div key={r.key} className={"pl-org-row" + (isHidden ? " off" : "")}>
                  <button className="pl-org-eye" onClick={() => onToggleHide(r.key)} title={isHidden ? "Mostrar" : "Ocultar"}>
                    {isHidden ? "🚫" : "👁"}
                  </button>
                  <span className="pl-org-lbl">{r.label}{isCustom ? <em> · manual</em> : null}</span>
                  <button className="pl-org-mv" onClick={() => onMove(s.title, r.key, -1)} disabled={i === 0} title="Subir">↑</button>
                  <button className="pl-org-mv" onClick={() => onMove(s.title, r.key, 1)} disabled={i === s.rows.length - 1} title="Descer">↓</button>
                  {isCustom ? <button className="pl-org-rm" onClick={() => onRemoveCustom(r.key)} title="Remover indicador manual">✕</button> : <span style={{ width: 22 }} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="pl-org-add">
        <b>+ Indicador manual:</b>
        <select value={sec} onChange={(e) => setSec(e.target.value)}>
          {sections.map((s) => <option key={s.title} value={s.title}>{s.title}</option>)}
          <option value="PERSONALIZADOS">PERSONALIZADOS (nova seção)</option>
        </select>
        <input placeholder="Nome do indicador" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <select value={kind} onChange={(e) => setKind(e.target.value as CellKind)}>
          {(Object.keys(KIND_LABEL) as CellKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <button className="pl-org-addbtn" onClick={add}>Adicionar</button>
      </div>
    </div>
  );
}
