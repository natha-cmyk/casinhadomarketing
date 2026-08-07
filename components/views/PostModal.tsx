"use client";
// Porta renderPostModal (blueprint 1475-1504) + savePost (1505-1515).
// Modal de criação/edição de post do calendário de conteúdo.
import { useState } from "react";
import { useStore, newId, type PostItem } from "@/lib/store";
import {
  CANAIS_POST,
  PERFIS_POST,
  PILARES_POST,
  FORMATOS_POST,
  FUNIL_POST,
  REDES,
} from "@/lib/seed-data";

const POST_STATUS: Record<string, { label: string; cor: string }> = {
  rascunho: { label: "Rascunho", cor: "#8E8E93" },
  agendado: { label: "Agendado", cor: "#00BBC5" },
  publicado: { label: "Publicado", cor: "#2FB457" },
  falhou: { label: "Falhou", cor: "#FF001E" },
};

interface Fields {
  data: string;
  hora: string;
  titulo: string;
  canal: string;
  formato: string;
  perfil: string;
  colab: string;
  pilar: string;
  funil: string;
  arquivo: string;
  legenda: string;
  cta: string;
  hashtags: string;
  status: string;
  contas: string[];
}

export function PostModal() {
  const pm = useStore((st) => st.postModal);
  const posts = useStore((st) => st.posts);
  const contasConn = useStore((st) => st.contas);
  const calMonth = useStore((st) => st.calMonth);
  const calYear = useStore((st) => st.calYear);
  const set = useStore((st) => st.set);
  const addPost = useStore((st) => st.addPost);
  const updatePost = useStore((st) => st.updatePost);
  const deletePost = useStore((st) => st.deletePost);

  const existing = pm && pm.mode === "edit" ? posts.find((x) => x.id === pm.id) : undefined;

  // Estado seed: post existente (edição) ou defaults do blueprint (novo).
  const [f, setF] = useState<Fields>(() => {
    if (pm && pm.mode === "edit" && existing) {
      return {
        data:
          String(existing.d).padStart(2, "0") +
          "/" +
          String(existing.m + 1).padStart(2, "0") +
          "/" +
          existing.y,
        hora: existing.hora,
        titulo: existing.titulo,
        canal: existing.canal,
        formato: existing.formato,
        perfil: existing.perfil,
        colab: existing.colab,
        pilar: existing.pilar,
        funil: existing.funil,
        arquivo: existing.arquivo,
        legenda: existing.legenda,
        cta: existing.cta,
        hashtags: existing.hashtags,
        status: existing.status,
        contas: [...(existing.contas || [])],
      };
    }
    const y = pm?.y ?? calYear;
    const m = pm?.m ?? calMonth;
    const d = pm?.d ?? 1;
    return {
      data: String(d).padStart(2, "0") + "/" + String(m + 1).padStart(2, "0") + "/" + y,
      hora: "09:00",
      titulo: "",
      canal: "Instagram",
      formato: "Reels",
      perfil: "Seahub",
      colab: "",
      pilar: "Espaços",
      funil: "Topo",
      arquivo: "",
      legenda: "",
      cta: "",
      hashtags: "",
      status: "rascunho",
      contas: [],
    };
  });

  if (!pm) return null;
  if (pm.mode === "edit" && !existing) return null;

  const upd = (patch: Partial<Fields>) => setF((prev) => ({ ...prev, ...patch }));

  const close = () => set({ postModal: null });

  const doSave = (forceStatus?: string) => {
    const dp = f.data.split("/").map((s) => parseInt(s, 10));
    const d = dp[0] || 1;
    const m = (dp[1] || calMonth + 1) - 1;
    const y = dp[2] || calYear;
    const base = {
      hora: f.hora,
      titulo: f.titulo || "(sem título)",
      canal: f.canal,
      formato: f.formato,
      perfil: f.perfil,
      colab: f.colab,
      pilar: f.pilar,
      funil: f.funil,
      arquivo: f.arquivo,
      legenda: f.legenda,
      cta: f.cta,
      hashtags: f.hashtags,
      status: forceStatus ?? f.status,
      contas: f.contas,
      y,
      m,
      d,
    };
    if (pm.mode === "edit" && pm.id) {
      updatePost(pm.id, base);
    } else {
      const post: PostItem = { id: newId("post"), ...base };
      addPost(post);
    }
    close();
  };

  const doDelete = () => {
    if (pm.id) deletePost(pm.id);
    close();
  };

  const conn = REDES.filter((r) => r.grupo !== "ads" && contasConn[r.id]);

  const sel = (id: string, arr: string[], val: string, onChange: (v: string) => void) => (
    <select className="field-edit" id={id} value={val} onChange={(e) => onChange(e.target.value)}>
      {arr.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );

  return (
    <div
      className="pm-back"
      id="pmBack"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="pm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <b>{pm.mode === "edit" ? "Editar post" : "Novo post"}</b>
          <button className="pm-x" id="pmClose" aria-label="Fechar" onClick={close}>
            ✕
          </button>
        </div>
        <div className="pm-body">
          <div className="pm-row">
            <div>
              <label className="field-lbl">Data</label>
              <input
                className="field-edit"
                id="pmData"
                value={f.data}
                placeholder="dd/mm/aaaa"
                onChange={(e) => upd({ data: e.target.value })}
              />
            </div>
            <div>
              <label className="field-lbl">Horário</label>
              <input
                className="field-edit"
                id="pmHora"
                value={f.hora}
                placeholder="hh:mm"
                onChange={(e) => upd({ hora: e.target.value })}
              />
            </div>
          </div>
          <label className="field-lbl">Título</label>
          <input
            className="field-edit"
            id="pmTitulo"
            value={f.titulo}
            placeholder="Título do post"
            onChange={(e) => upd({ titulo: e.target.value })}
          />
          <div className="pm-row">
            <div>
              <label className="field-lbl">Canal</label>
              {sel("pmCanal", CANAIS_POST, f.canal, (v) => upd({ canal: v }))}
            </div>
            <div>
              <label className="field-lbl">Formato</label>
              {sel("pmFormato", FORMATOS_POST, f.formato, (v) => upd({ formato: v }))}
            </div>
          </div>
          <div className="pm-row">
            <div>
              <label className="field-lbl">Perfil</label>
              {sel("pmPerfil", PERFIS_POST, f.perfil, (v) => upd({ perfil: v }))}
            </div>
            <div>
              <label className="field-lbl">Perfil colaborador</label>
              <select
                className="field-edit"
                id="pmColab"
                value={f.colab}
                onChange={(e) => upd({ colab: e.target.value })}
              >
                <option value="">— nenhum —</option>
                {PERFIS_POST.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="pm-row">
            <div>
              <label className="field-lbl">Pilar / categoria</label>
              {sel("pmPilar", PILARES_POST, f.pilar, (v) => upd({ pilar: v }))}
            </div>
            <div>
              <label className="field-lbl">Funil</label>
              {sel("pmFunil", FUNIL_POST, f.funil, (v) => upd({ funil: v }))}
            </div>
          </div>
          <label className="field-lbl">Capa / arquivo (png, jpeg, mp4, mov)</label>
          <input
            className="field-edit"
            id="pmArquivo"
            value={f.arquivo}
            placeholder="nome-do-arquivo.mp4"
            onChange={(e) => upd({ arquivo: e.target.value })}
          />
          <label className="field-lbl">Legenda</label>
          <textarea
            className="field-edit"
            id="pmLegenda"
            rows={3}
            placeholder="Legenda da publicação"
            value={f.legenda}
            onChange={(e) => upd({ legenda: e.target.value })}
          />
          <div className="pm-row">
            <div>
              <label className="field-lbl">CTA</label>
              <input
                className="field-edit"
                id="pmCta"
                value={f.cta}
                placeholder="Ex.: Agende uma visita"
                onChange={(e) => upd({ cta: e.target.value })}
              />
            </div>
            <div>
              <label className="field-lbl">Hashtags</label>
              <input
                className="field-edit"
                id="pmHash"
                value={f.hashtags}
                placeholder="#seahub"
                onChange={(e) => upd({ hashtags: e.target.value })}
              />
            </div>
          </div>
          <div className="pm-sched">
            <div className="pm-sched-h">Agendamento & publicação</div>
            <label className="field-lbl">Publicar em (contas conectadas)</label>
            {conn.length ? (
              <div className="pm-contas">
                {conn.map((r) => {
                  const chk = f.contas.includes(r.id);
                  return (
                    <label className="pm-conta" key={r.id}>
                      <input
                        type="checkbox"
                        data-pmconta={r.id}
                        checked={chk}
                        onChange={(e) =>
                          upd({
                            contas: e.target.checked
                              ? [...f.contas, r.id]
                              : f.contas.filter((x) => x !== r.id),
                          })
                        }
                      />
                      <span className="conta-dot" style={{ background: r.cor }} />
                      {r.label}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="pm-hint">
                Nenhuma conta conectada. Conecte na barra &quot;Contas conectadas&quot; (topo do
                calendário) para agendar publicação automática.
              </div>
            )}
            <label className="field-lbl">Status</label>
            <select
              className="field-edit"
              id="pmStatus"
              value={f.status}
              onChange={(e) => upd({ status: e.target.value })}
            >
              {Object.keys(POST_STATUS).map((k) => (
                <option key={k} value={k}>
                  {POST_STATUS[k].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="pm-foot">
          {pm.mode === "edit" ? (
            <button className="btn-link pm-del" id="pmDelete" onClick={doDelete}>
              Excluir
            </button>
          ) : (
            <span></span>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-link" id="pmCancel" onClick={close}>
              Cancelar
            </button>
            {/* TODO(zernio): disparo real de publicação */}
            <button className="btn-link pm-pub" id="pmPublish" onClick={() => doSave("publicado")}>
              Publicar agora
            </button>
            <button className="btn-link ig" id="pmSave" onClick={() => doSave()}>
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
