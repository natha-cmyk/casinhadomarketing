"use client";
// Portado de viewMetas (blueprint 1080-1131) — OKR 2026 por área, leitura + edição.
// OKR agora é estado editável na store (s.okr); toggle de edição em s.metasEdit.
import { useStore } from "@/lib/store";
import { PageHead } from "@/components/ui";
import { Ic } from "@/components/Ic";
import type { StatusTier } from "@/lib/scope";

// Mapa de cor por área (blueprint linha 1081) → tier de status; fallback cyan ("bom").
const COL: Record<string, StatusTier> = {
  Marketing: "bom",
  Comunidade: "cri",
  "Comercial / Imobiliário": "ate",
  "Eficiência / Operação": "exc",
};
const VARC: Record<StatusTier, string> = {
  bom: "var(--bom)",
  cri: "var(--critico)",
  ate: "var(--atencao)",
  exc: "var(--excelente)",
};

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(215px,1fr))",
  gap: 12,
};

export default function MetasView() {
  const okr = useStore((s) => s.okr);
  const editing = useStore((s) => s.metasEdit);
  const set = useStore((s) => s.set);
  const setObjetivo = useStore((s) => s.setObjetivo);
  const setAreaNome = useStore((s) => s.setAreaNome);
  const addArea = useStore((s) => s.addArea);
  const removeArea = useStore((s) => s.removeArea);
  const addKr = useStore((s) => s.addKr);
  const removeKr = useStore((s) => s.removeKr);
  const setKr = useStore((s) => s.setKr);

  const total = okr.areas.reduce((sum, a) => sum + a.krs.length, 0);

  const editBtn = (
    <button
      type="button"
      className={`btn-link${editing ? " ig" : ""}`}
      id="metasEditBtn"
      onClick={() => set({ metasEdit: !editing })}
    >
      {editing ? "✓ Concluir edição" : "✎ Editar"}
    </button>
  );

  return (
    <>
      <PageHead
        eyebrow="Comercial"
        title="Metas 2026"
        desc={`Key Results do OKR (fonte: ClickUp · lista SEAHUB OKR 2026). ${total} metas ativas, agrupadas por área.`}
        right={editBtn}
      />

      {/* Objetivo do ano */}
      {editing ? (
        <div className="card pad-lg" style={{ marginBottom: 18 }}>
          <label className="field-lbl">Objetivo do ano</label>
          <textarea
            className="me-in"
            rows={3}
            value={okr.objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
          />
        </div>
      ) : (
        <div className="card pad-lg" style={{ marginBottom: 18 }}>
          <div className="insight" style={{ border: 0, background: "transparent", padding: 0 }}>
            <div className="ib" style={{ background: "var(--bom)" }}>
              <Ic name="goal" />
            </div>
            <p>
              <b>Objetivo do ano:</b> {okr.objetivo}
            </p>
          </div>
        </div>
      )}

      {/* Seções por área */}
      {okr.areas.map((a) => {
        const c: StatusTier = COL[a.nome] || "bom";
        return (
          <div key={a.id} style={{ marginBottom: 20 }}>
            {editing ? (
              <div className="me-ahead">
                <span className="dot" style={{ background: VARC[c], width: 9, height: 9 }} />
                <input
                  className="me-in me-aname"
                  value={a.nome}
                  placeholder="Nome da área"
                  onChange={(e) => setAreaNome(a.id, e.target.value)}
                />
                <button type="button" className="me-rmarea" onClick={() => removeArea(a.id)}>
                  Remover área
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px 11px" }}>
                <span className="dot" style={{ background: VARC[c], width: 9, height: 9 }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: "-.2px" }}>{a.nome}</h3>
                <span className="badge">{a.krs.length} KR</span>
              </div>
            )}

            <div style={GRID}>
              {a.krs.map((k) =>
                editing ? (
                  <div key={k.id} className="card meta-ec" style={{ padding: "13px 14px" }}>
                    <div className="me-top">
                      <input
                        className="me-in"
                        value={k.tag}
                        placeholder="tag (ex.: IA · SEO)"
                        onChange={(e) => setKr(a.id, k.id, { tag: e.target.value })}
                      />
                      <button
                        type="button"
                        className="me-x"
                        aria-label="Remover KR"
                        onClick={() => removeKr(a.id, k.id)}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="me-row2">
                      <input
                        className="me-in me-alvo tnum"
                        value={k.alvo}
                        placeholder="alvo"
                        onChange={(e) => setKr(a.id, k.id, { alvo: e.target.value })}
                      />
                      <input
                        className="me-in me-un"
                        value={k.un}
                        placeholder="un."
                        onChange={(e) => setKr(a.id, k.id, { un: e.target.value })}
                      />
                    </div>
                    <textarea
                      className="me-in me-kr"
                      rows={2}
                      value={k.kr}
                      placeholder="descrição do KR"
                      onChange={(e) => setKr(a.id, k.id, { kr: e.target.value })}
                    />
                    <input
                      className="me-in"
                      value={k.resp}
                      placeholder="responsável"
                      onChange={(e) => setKr(a.id, k.id, { resp: e.target.value })}
                    />
                  </div>
                ) : (
                  <div key={k.id} className="card" style={{ padding: "15px 16px" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 11, minHeight: 20 }}>
                      <span className={`pill ${c}`}>{a.nome.split(" ")[0]}</span>
                      {k.tag ? <span className="chip flat">{k.tag}</span> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 7 }}>
                      <b className="tnum" style={{ fontSize: 27, letterSpacing: "-.6px", lineHeight: 1 }}>
                        {k.alvo}
                      </b>
                      {k.un ? (
                        <span style={{ color: "var(--label-2)", fontSize: 13, fontWeight: 600 }}>{k.un}</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.35, color: "var(--label)" }}>{k.kr}</div>
                    <div
                      style={{
                        marginTop: 11,
                        paddingTop: 10,
                        borderTop: "1px solid var(--hairline)",
                        fontSize: 11.5,
                        color: "var(--label-3)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span className="dot" style={{ background: VARC[c] }} />
                      {k.resp || "—"}
                    </div>
                  </div>
                )
              )}
              {editing ? (
                <button type="button" className="card meta-addkr" onClick={() => addKr(a.id)}>
                  + Novo KR
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      {editing ? (
        <button type="button" className="btn-link meta-newarea" id="metasNewArea" onClick={() => addArea()}>
          + Nova área / categoria
        </button>
      ) : null}

      <div className="tfoot-note" style={{ marginTop: 16 }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9A9AA0"
          strokeWidth={2}
          style={{ flex: "0 0 14px", marginTop: 1 }}
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M11 12h1v4h1" />
        </svg>
        {editing ? (
          "Modo edição — mudanças ficam na sessão (persistência no Supabase). Clique em Concluir para voltar à leitura."
        ) : (
          <span>
            Estes são os <b>alvos (Key Results)</b>. O <b>realizado / progresso</b> vem do acompanhamento mensal de OKR
            (Growth) no ClickUp — quando virar dado, ligo o progresso aqui.
          </span>
        )}
      </div>
    </>
  );
}
