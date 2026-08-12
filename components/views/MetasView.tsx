"use client";
// Construtor de OKR — sempre editável. Objetivo do ano + Áreas (setores) + Key Results.
// Estado vem da store (s.okr); persistência é automática (Hydrator salva quando okr muda).
// Multi-tenant: workspace novo começa vazio (sem seed).
import { useStore } from "@/lib/store";
import { PageHead } from "@/components/ui";
import type { StatusTier } from "@/lib/scope";

// Cor por área — rotaciona os tiers de status só para dar variação visual aos setores.
const TIERS: StatusTier[] = ["bom", "exc", "ate", "cri"];
const VARC: Record<StatusTier, string> = {
  bom: "var(--bom)",
  exc: "var(--excelente)",
  ate: "var(--atencao)",
  cri: "var(--critico)",
};

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
  gap: 12,
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="field-lbl" style={{ margin: "0 0 4px" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export default function MetasView() {
  const okr = useStore((s) => s.okr);
  const setObjetivo = useStore((s) => s.setObjetivo);
  const setAreaNome = useStore((s) => s.setAreaNome);
  const addArea = useStore((s) => s.addArea);
  const removeArea = useStore((s) => s.removeArea);
  const addKr = useStore((s) => s.addKr);
  const removeKr = useStore((s) => s.removeKr);
  const setKr = useStore((s) => s.setKr);

  const total = okr.areas.reduce((sum, a) => sum + a.krs.length, 0);
  const vazio = !okr.objetivo.trim() && okr.areas.length === 0;

  return (
    <>
      <PageHead
        eyebrow="Comercial"
        title="Metas 2026"
        desc={
          vazio
            ? "Monte o OKR do ano: defina o objetivo e crie setores com seus Key Results."
            : `${total} ${total === 1 ? "Key Result" : "Key Results"} em ${okr.areas.length} ${
                okr.areas.length === 1 ? "setor" : "setores"
              }. Tudo salva automaticamente.`
        }
      />

      {/* Objetivo do ano */}
      <div className="card pad-lg" style={{ marginBottom: 18 }}>
        <label className="field-lbl">Objetivo do ano</label>
        <textarea
          className="field-edit"
          rows={3}
          value={okr.objetivo}
          placeholder="Ex.: Consolidar a Seahub como referência de coworking em Natal, dobrando a base de membros ativos."
          onChange={(e) => setObjetivo(e.target.value)}
        />
        <p style={{ margin: "9px 2px 0", fontSize: 12, color: "var(--label-3)", lineHeight: 1.5 }}>
          A grande ambição do ano. Os Key Results abaixo são as métricas que provam que você chegou lá.
        </p>
      </div>

      {/* Setores + Key Results */}
      {okr.areas.map((a, ai) => {
        const c = TIERS[ai % TIERS.length];
        return (
          <div key={a.id} style={{ marginBottom: 22 }}>
            <div className="me-ahead" style={{ marginBottom: 12 }}>
              <span className="dot" style={{ background: VARC[c], width: 9, height: 9, flex: "0 0 9px" }} />
              <input
                className="me-in me-aname"
                value={a.nome}
                placeholder="Nome do setor (ex.: Marketing)"
                onChange={(e) => setAreaNome(a.id, e.target.value)}
              />
              <span className="badge">
                {a.krs.length} {a.krs.length === 1 ? "KR" : "KRs"}
              </span>
              <button type="button" className="me-rmarea" onClick={() => removeArea(a.id)}>
                Remover setor
              </button>
            </div>

            <div style={GRID}>
              {a.krs.map((k) => (
                <div key={k.id} className="card meta-ec" style={{ padding: "14px 15px", gap: 11 }}>
                  <div className="me-top" style={{ justifyContent: "space-between" }}>
                    <span className="field-lbl" style={{ margin: 0, color: VARC[c] }}>
                      Key Result
                    </span>
                    <button
                      type="button"
                      className="me-x"
                      aria-label="Remover Key Result"
                      onClick={() => removeKr(a.id, k.id)}
                    >
                      ✕
                    </button>
                  </div>

                  <Field label="Descrição">
                    <textarea
                      className="me-in me-kr"
                      rows={2}
                      value={k.kr}
                      placeholder="Ex.: Aumentar leads qualificados vindos do Instagram"
                      onChange={(e) => setKr(a.id, k.id, { kr: e.target.value })}
                    />
                  </Field>

                  <div className="me-row2" style={{ gap: 9 }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Alvo">
                        <input
                          className="me-in tnum"
                          style={{ fontWeight: 700 }}
                          value={k.alvo}
                          placeholder="Ex.: 120"
                          onChange={(e) => setKr(a.id, k.id, { alvo: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div style={{ flex: "0 0 96px" }}>
                      <Field label="Unidade">
                        <input
                          className="me-in"
                          value={k.un}
                          placeholder="/mês, %"
                          onChange={(e) => setKr(a.id, k.id, { un: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="me-row2" style={{ gap: 9 }}>
                    <div style={{ flex: 1 }}>
                      <Field label="Tag">
                        <input
                          className="me-in"
                          value={k.tag}
                          placeholder="Ex.: SEO · IA"
                          onChange={(e) => setKr(a.id, k.id, { tag: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Field label="Responsável">
                        <input
                          className="me-in"
                          value={k.resp}
                          placeholder="Ex.: José"
                          onChange={(e) => setKr(a.id, k.id, { resp: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              ))}

              <button type="button" className="card meta-addkr" onClick={() => addKr(a.id)}>
                ＋ Novo KR
              </button>
            </div>
          </div>
        );
      })}

      {/* Adicionar setor / estado inicial */}
      {vazio ? (
        <div
          className="card pad-lg"
          style={{ textAlign: "center", display: "grid", placeItems: "center", gap: 12, padding: "34px 24px" }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.2px" }}>Comece pelo primeiro setor</div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--label-2)", maxWidth: 420, lineHeight: 1.5 }}>
            Defina o objetivo do ano acima e crie setores (Marketing, Comercial, Operação…). Cada setor guarda seus
            Key Results.
          </p>
          <button type="button" className="btn-link ig" onClick={() => addArea()}>
            ＋ Adicionar setor
          </button>
        </div>
      ) : (
        <button type="button" className="btn-link meta-newarea" onClick={() => addArea()}>
          ＋ Novo setor
        </button>
      )}
    </>
  );
}
